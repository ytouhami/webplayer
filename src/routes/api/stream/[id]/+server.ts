import { error } from '@sveltejs/kit';
import { fetchAndRewritePlaylist } from '$lib/server/stream-proxy';
import type { UserSession } from '$lib/server/session';
import type { RequestHandler } from './$types';

const CHANNEL_ID = /^\d+$/;

// hls.js re-polls a live playlist every ~1 target-duration to discover new
// segments — completely standard HLS live behavior, not something we can
// turn off without breaking live segment discovery. Without this cache,
// every single one of those polls re-hit the provider's origin
// /live/{user}/{pass}/{id}.m3u8 endpoint from scratch, which redirects to
// a token-bearing edge server. Re-resolving that redirect from origin
// repeatedly — as opposed to resolving it once and then polling the
// already-resolved edge URL directly for subsequent updates, which is
// what other IPTV clients (e.g. IBO Player) evidently do — turned out to
// be why two devices on the same account watching the same channel
// through this app would fight over the connection even though the
// provider allows genuine concurrent streams (confirmed directly: it
// works fine through other apps, only breaks through this proxy).
const EDGE_URL_TTL_MS = 60_000;
const edgeUrlCache = new Map<string, { url: string; expiresAt: number }>();

function edgeCacheKey(session: UserSession, channelId: string): string {
	return `${session.hostUrl}::${session.username}::${channelId}`;
}

export const GET: RequestHandler = async ({ params, locals }) => {
	const session = locals.userSession;
	if (!session) throw error(401, 'Not authenticated');

	const { id } = params;
	if (!id || !CHANNEL_ID.test(id)) throw error(400, 'Invalid channel id');

	const base = session.hostUrl.replace(/\/+$/, '');
	const originUrl = `${base}/live/${encodeURIComponent(session.username)}/${encodeURIComponent(session.password)}/${id}.m3u8`;

	const key = edgeCacheKey(session, id);
	const cached = edgeUrlCache.get(key);
	const targetUrl = cached && cached.expiresAt > Date.now() ? cached.url : originUrl;

	let result: { playlist: string; finalUrl: string };
	try {
		result = await fetchAndRewritePlaylist(targetUrl);
	} catch (err) {
		if (targetUrl === originUrl) throw err;
		// Cached edge URL stopped working (token expired, edge server
		// rotated, etc.) — fall back to a fresh origin resolution instead
		// of surfacing an error for what's just a normal cache miss.
		edgeUrlCache.delete(key);
		result = await fetchAndRewritePlaylist(originUrl);
	}

	edgeUrlCache.set(key, { url: result.finalUrl, expiresAt: Date.now() + EDGE_URL_TTL_MS });

	return new Response(result.playlist, {
		headers: {
			'content-type': 'application/vnd.apple.mpegurl',
			'cache-control': 'no-store'
		}
	});
};
