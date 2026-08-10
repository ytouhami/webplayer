import { error } from '@sveltejs/kit';
import { verifySignedUrl } from '$lib/server/stream-proxy';
import type { UserSession } from '$lib/server/session';
import type { RequestHandler } from './$types';

const SEGMENT_TIMEOUT_MS = 20000;
const PLAYER_USER_AGENT = 'VLC/3.0.20 LibVLC/3.0.20';

function redactCreds(target: string, session: UserSession): string {
	let out = target;
	if (session.username) out = out.split(session.username).join('***');
	if (session.password) out = out.split(session.password).join('***');
	return out;
}

const TS_PACKET_SIZE = 188;
const TS_SYNC_BYTE = 0x47;
const SYNC_PEEK_BYTES = 8192;
const MIN_ALIGNED_PACKETS = 8;

// Some provider edge servers prepend a few dozen/hundred bytes of junk
// before the actual MPEG-TS packet stream starts (observed directly via
// curl against the real provider — a real, complete, correctly-aligned TS
// stream begins at a non-zero, per-segment-variable offset). hls.js's
// demuxer expects byte 0 of the response to be a valid sync byte and
// doesn't scan forward to resync, so that leading junk alone is enough to
// make an otherwise-perfectly-good segment fail to parse. Scanning for the
// offset with a long run of correctly-spaced sync bytes and trimming
// everything before it fixes this without needing to know why the
// provider sends it.
function findTsSyncOffset(buf: Uint8Array): number {
	const maxOffset = Math.min(TS_PACKET_SIZE, buf.length);
	for (let offset = 0; offset < maxOffset; offset++) {
		let packets = 0;
		for (let i = offset; i < buf.length && buf[i] === TS_SYNC_BYTE; i += TS_PACKET_SIZE) {
			packets++;
			if (packets >= MIN_ALIGNED_PACKETS) return offset;
		}
	}
	return 0;
}

async function stripLeadingGarbage(
	body: ReadableStream<Uint8Array>
): Promise<{ stream: ReadableStream<Uint8Array>; offset: number; peekedBytes: number }> {
	const reader = body.getReader();
	const chunks: Uint8Array[] = [];
	let total = 0;
	let upstreamDone = false;

	while (total < SYNC_PEEK_BYTES) {
		const { done, value } = await reader.read();
		if (done) {
			upstreamDone = true;
			break;
		}
		chunks.push(value);
		total += value.length;
	}

	const head = new Uint8Array(total);
	let pos = 0;
	for (const chunk of chunks) {
		head.set(chunk, pos);
		pos += chunk.length;
	}

	const offset = findTsSyncOffset(head);
	const trimmedHead = offset > 0 ? head.subarray(offset) : head;

	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			if (trimmedHead.length > 0) controller.enqueue(trimmedHead);
			if (upstreamDone) controller.close();
		},
		async pull(controller) {
			const { done, value } = await reader.read();
			if (done) {
				controller.close();
				return;
			}
			controller.enqueue(value);
		},
		cancel(reason) {
			reader.cancel(reason);
		}
	});

	return { stream, offset, peekedBytes: total };
}

let requestCounter = 0;

export const GET: RequestHandler = async ({ url, locals }) => {
	const reqId = ++requestCounter;
	const session = locals.userSession;
	if (!session) throw error(401, 'Not authenticated');

	const target = url.searchParams.get('u');
	const sig = url.searchParams.get('sig');
	if (!target || !sig || !verifySignedUrl(target, sig)) {
		console.error(`[stream][seg#${reqId}] rejected: invalid/missing signature`);
		throw error(403, 'Invalid or missing signature');
	}

	const safeUrl = redactCreds(target, session);
	console.log(`[stream][seg#${reqId}] requesting ${safeUrl}`);
	const startedAt = Date.now();

	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), SEGMENT_TIMEOUT_MS);

	try {
		const response = await fetch(target, {
			signal: controller.signal,
			headers: { 'User-Agent': PLAYER_USER_AGENT }
		});
		clearTimeout(timeout);
		const elapsed = Date.now() - startedAt;

		console.log(
			`[stream][seg#${reqId}] upstream responded HTTP ${response.status} in ${elapsed}ms, content-type=${response.headers.get('content-type')}, content-length=${response.headers.get('content-length')}`
		);

		if (!response.ok || !response.body) {
			console.error(`[stream][seg#${reqId}] FAILED: HTTP ${response.status} for ${safeUrl}`);
			// Passes the provider's actual status through instead of masking it
			// as our own 502 — hls.js surfaces this code in its error payload,
			// so the real cause (403 rejected, 404 gone, upstream 5xx, etc.)
			// shows up directly in the player's on-page diagnostics.
			throw error(response.status >= 400 && response.status <= 599 ? response.status : 502, `Provider returned HTTP ${response.status}`);
		}

		const { stream, offset, peekedBytes } = await stripLeadingGarbage(response.body);
		console.log(
			`[stream][seg#${reqId}] OK — peeked ${peekedBytes} bytes, sync offset=${offset}${offset > 0 ? ' (trimmed)' : ''}`
		);

		return new Response(stream, {
			headers: {
				'content-type': response.headers.get('content-type') ?? 'video/mp2t',
				'cache-control': 'no-store'
			}
		});
	} catch (err) {
		clearTimeout(timeout);
		if (err && typeof err === 'object' && 'status' in err) throw err;
		console.error(`[stream][seg#${reqId}] EXCEPTION for ${safeUrl}: ${err instanceof Error ? err.stack ?? err.message : err}`);
		throw error(502, 'Failed to reach provider');
	}
};
