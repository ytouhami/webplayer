import { error } from '@sveltejs/kit';
import { verifySignedUrl } from '$lib/server/stream-proxy';
import type { RequestHandler } from './$types';

const SEGMENT_TIMEOUT_MS = 20000;
const PLAYER_USER_AGENT = 'VLC/3.0.20 LibVLC/3.0.20';

export const GET: RequestHandler = async ({ url, locals }) => {
	if (!locals.userSession) throw error(401, 'Not authenticated');

	const target = url.searchParams.get('u');
	const sig = url.searchParams.get('sig');
	if (!target || !sig || !verifySignedUrl(target, sig)) {
		throw error(403, 'Invalid or missing signature');
	}

	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), SEGMENT_TIMEOUT_MS);

	try {
		const response = await fetch(target, {
			signal: controller.signal,
			headers: { 'User-Agent': PLAYER_USER_AGENT }
		});
		clearTimeout(timeout);

		if (!response.ok || !response.body) {
			throw error(502, `Provider returned HTTP ${response.status}`);
		}

		return new Response(response.body, {
			headers: {
				'content-type': response.headers.get('content-type') ?? 'video/mp2t',
				'cache-control': 'no-store'
			}
		});
	} catch (err) {
		clearTimeout(timeout);
		if (err && typeof err === 'object' && 'status' in err) throw err;
		console.error(`[stream] segment fetch failed: ${err instanceof Error ? err.message : err}`);
		throw error(502, 'Failed to reach provider');
	}
};
