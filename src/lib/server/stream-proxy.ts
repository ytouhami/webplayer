import { createHmac, timingSafeEqual } from 'node:crypto';
import { error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

const PLAYLIST_TIMEOUT_MS = 8000;
const PLAYER_USER_AGENT = 'VLC/3.0.20 LibVLC/3.0.20';

// Prevents /api/stream/segment from being usable as an open SSRF proxy: it
// only ever fetches URLs that we ourselves generated while rewriting a
// playlist, verified by this signature — never an arbitrary attacker-
// supplied URL. Reuses AUTH_SECRET since this is the same threat model as
// the admin session cookie (tamper-evidence, not confidentiality).
function secret(): string {
	if (!env.AUTH_SECRET) {
		throw new Error('Missing required env var AUTH_SECRET');
	}
	return env.AUTH_SECRET;
}

export function signUrl(url: string): string {
	return createHmac('sha256', secret()).update(url).digest('hex');
}

export function verifySignedUrl(url: string, signature: string): boolean {
	const expected = signUrl(url);
	const a = Buffer.from(signature);
	const b = Buffer.from(expected);
	return a.length === b.length && timingSafeEqual(a, b);
}

function redactPath(rawUrl: string): string {
	try {
		const u = new URL(rawUrl);
		return `${u.host}${u.pathname.replace(/\/[^/]+\/[^/]+\//, '/***/***/')}`;
	} catch {
		return '(unparseable url)';
	}
}

let requestCounter = 0;

// Fetches an HLS media playlist from the provider and rewrites each segment
// line into a signed /api/stream/segment URL, so playback works from both
// /live (live edge) and /catchup (timeshift) — same provider redirect/mixed
// -content handling either way, just a different source playlist URL.
//
// skipSegments drops that many leading (#EXTINF, uri) pairs before
// rewriting — added for catch-up, where the provider's segment index 0
// consistently 502s (confirmed directly against the provider: genuine,
// reproducible backend failure specific to that one segment, unrelated to
// anything on our side). Not used for /live.
export async function fetchAndRewritePlaylist(providerUrl: string, skipSegments = 0): Promise<string> {
	const reqId = ++requestCounter;
	const safeUrl = redactPath(providerUrl);
	console.log(`[stream][playlist#${reqId}] requesting ${safeUrl}`);
	const startedAt = Date.now();

	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), PLAYLIST_TIMEOUT_MS);

	let playlist: string;
	let finalUrl: string;
	try {
		const response = await fetch(providerUrl, {
			signal: controller.signal,
			headers: { 'User-Agent': PLAYER_USER_AGENT }
		});
		const elapsed = Date.now() - startedAt;
		console.log(
			`[stream][playlist#${reqId}] upstream responded HTTP ${response.status} in ${elapsed}ms, redirected-to=${redactPath(response.url)}, content-type=${response.headers.get('content-type')}`
		);
		if (!response.ok) {
			console.error(`[stream][playlist#${reqId}] FAILED: HTTP ${response.status} for ${safeUrl}`);
			// Passes the provider's real status through (not our own 502
			// wrapper) so hls.js's manifestLoadError payload — surfaced in the
			// player's on-page diagnostics — shows the actual cause.
			throw error(response.status >= 400 && response.status <= 599 ? response.status : 502, `Provider returned HTTP ${response.status}`);
		}
		playlist = await response.text();
		finalUrl = response.url;
	} catch (err) {
		if (err && typeof err === 'object' && 'status' in err) throw err;
		console.error(`[stream][playlist#${reqId}] EXCEPTION for ${safeUrl}: ${err instanceof Error ? err.stack ?? err.message : err}`);
		throw error(502, 'Failed to reach provider');
	} finally {
		clearTimeout(timeout);
	}

	if (!playlist.trimStart().startsWith('#EXTM3U')) {
		console.error(`[stream][playlist#${reqId}] provider did not return a playlist, got: ${playlist.slice(0, 300)}`);
		throw error(502, 'Provider did not return a valid stream playlist');
	}

	const segmentCount = playlist.split('\n').filter((l) => l.trim() && !l.trim().startsWith('#')).length;
	console.log(`[stream][playlist#${reqId}] OK — ${segmentCount} segment line(s)`);

	const proxySegment = (rawUri: string): string => {
		const absolute = new URL(rawUri, finalUrl).href;
		const sig = signUrl(absolute);
		return `/api/stream/segment?u=${encodeURIComponent(absolute)}&sig=${sig}`;
	};

	const rewrittenLines: string[] = [];
	let segmentsSkipped = 0;
	let pendingExtinf: string | null = null;

	for (const line of playlist.split('\n')) {
		const trimmed = line.trim();
		if (!trimmed) {
			rewrittenLines.push(line);
			continue;
		}

		if (trimmed.startsWith('#')) {
			if (trimmed.startsWith('#EXTINF') && segmentsSkipped < skipSegments) {
				// Hold this EXTINF line back — only emitted if its paired
				// segment URI (next non-comment line) also ends up skipped, so
				// we drop the whole (EXTINF, uri) pair together.
				pendingExtinf = line;
				continue;
			}
			if (trimmed.startsWith('#EXT-X-MEDIA-SEQUENCE:') && skipSegments > 0) {
				const n = Number(trimmed.slice('#EXT-X-MEDIA-SEQUENCE:'.length));
				rewrittenLines.push(`#EXT-X-MEDIA-SEQUENCE:${Number.isFinite(n) ? n + skipSegments : skipSegments}`);
				continue;
			}
			// #EXT-X-KEY (decryption key) and #EXT-X-MAP (fMP4 init segment)
			// carry their own URI="..." attribute that also needs proxying —
			// left as a raw provider URL, the browser can't fetch it (mixed
			// content/CORS), so encrypted segments never get decrypted and
			// fail to parse even though the segment fetches themselves "work".
			if (trimmed.startsWith('#EXT-X-KEY') || trimmed.startsWith('#EXT-X-MAP')) {
				rewrittenLines.push(line.replace(/URI="([^"]+)"/, (_match, uri) => `URI="${proxySegment(uri)}"`));
				continue;
			}
			rewrittenLines.push(line);
			continue;
		}

		// A segment URI line, paired with the EXTINF just before it.
		if (pendingExtinf !== null) {
			pendingExtinf = null;
			segmentsSkipped++;
			continue;
		}
		rewrittenLines.push(proxySegment(trimmed));
	}

	if (segmentsSkipped > 0) {
		console.log(`[stream][playlist#${reqId}] skipped ${segmentsSkipped} leading segment(s)`);
	}

	return rewrittenLines.join('\n');
}
