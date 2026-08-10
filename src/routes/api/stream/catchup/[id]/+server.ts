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
	const rewritten = await fetchAndRewritePlaylist(providerUrl);

	return new Response(rewritten, {
		headers: {
			'content-type': 'application/vnd.apple.mpegurl',
			'cache-control': 'no-store'
		}
	});
};
