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

// Fetches an HLS media playlist from the provider and rewrites each segment
// line into a signed /api/stream/segment URL, so playback works from both
// /live (live edge) and /catchup (timeshift) — same provider redirect/mixed
// -content handling either way, just a different source playlist URL.
export async function fetchAndRewritePlaylist(providerUrl: string): Promise<string> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), PLAYLIST_TIMEOUT_MS);

	let playlist: string;
	let finalUrl: string;
	try {
		const response = await fetch(providerUrl, {
			signal: controller.signal,
			headers: { 'User-Agent': PLAYER_USER_AGENT }
		});
		if (!response.ok) {
			throw error(502, `Provider returned HTTP ${response.status}`);
		}
		playlist = await response.text();
		finalUrl = response.url;
	} catch (err) {
		if (err && typeof err === 'object' && 'status' in err) throw err;
		console.error(`[stream] playlist fetch failed: ${err instanceof Error ? err.message : err}`);
		throw error(502, 'Failed to reach provider');
	} finally {
		clearTimeout(timeout);
	}

	return playlist
		.split('\n')
		.map((line) => {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith('#')) return line;

			const absolute = new URL(trimmed, finalUrl).href;
			const sig = signUrl(absolute);
			return `/api/stream/segment?u=${encodeURIComponent(absolute)}&sig=${sig}`;
		})
		.join('\n');
}
