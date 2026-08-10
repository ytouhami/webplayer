import { error } from '@sveltejs/kit';
import { buildTimeshiftUrl } from '$lib/server/iptv';
import { fetchAndRewritePlaylist } from '$lib/server/stream-proxy';
import type { RequestHandler } from './$types';

const CHANNEL_ID = /^\d+$/;

export const GET: RequestHandler = async ({ params, url, locals }) => {
	const session = locals.userSession;
	if (!session) throw error(401, 'Not authenticated');

	const { id } = params;
	if (!id || !CHANNEL_ID.test(id)) throw error(400, 'Invalid channel id');

	const start = Number(url.searchParams.get('start'));
	const duration = Number(url.searchParams.get('duration'));
	if (!Number.isFinite(start) || start <= 0 || !Number.isFinite(duration) || duration <= 0) {
		throw error(400, 'Invalid start/duration');
	}

	const providerUrl = buildTimeshiftUrl(session, Number(id), start, duration);
	console.log(
		`[catchup] stream ${id}: start=${new Date(start * 1000).toISOString()} duration=${duration}min`
	);
	// Full, unredacted URL (includes plaintext credentials) — server logs
	// only, deliberately not sent to the client. Requested for direct
	// debugging; keep this out of any client-visible log/response.
	console.log(`[catchup] full provider URL: ${providerUrl}`);
	// Segment index 0 consistently fails on this provider's backend
	// (confirmed via direct testing — genuine, reproducible 502, not
	// something on our side), so skip it and start from segment 1.
	const rewritten = await fetchAndRewritePlaylist(providerUrl, 1);

	return new Response(rewritten, {
		headers: {
			'content-type': 'application/vnd.apple.mpegurl',
			'cache-control': 'no-store'
		}
	});
};
