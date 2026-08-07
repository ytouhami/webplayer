import { error } from '@sveltejs/kit';
import { signUrl } from '$lib/server/stream-proxy';
import type { RequestHandler } from './$types';

const PLAYLIST_TIMEOUT_MS = 8000;
const PLAYER_USER_AGENT = 'VLC/3.0.20 LibVLC/3.0.20';
const CHANNEL_ID = /^\d+$/;

export const GET: RequestHandler = async ({ params, locals }) => {
	const session = locals.userSession;
	if (!session) throw error(401, 'Not authenticated');

	const { id } = params;
	if (!id || !CHANNEL_ID.test(id)) throw error(400, 'Invalid channel id');

	const base = session.hostUrl.replace(/\/+$/, '');
	const providerUrl = `${base}/live/${encodeURIComponent(session.username)}/${encodeURIComponent(session.password)}/${id}.m3u8`;

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
		console.error(`[stream] playlist fetch failed for channel ${id}: ${err instanceof Error ? err.message : err}`);
		throw error(502, 'Failed to reach provider');
	} finally {
		clearTimeout(timeout);
	}

	const rewritten = playlist
		.split('\n')
		.map((line) => {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith('#')) return line;

			const absolute = new URL(trimmed, finalUrl).href;
			const sig = signUrl(absolute);
			return `/api/stream/segment?u=${encodeURIComponent(absolute)}&sig=${sig}`;
		})
		.join('\n');

	return new Response(rewritten, {
		headers: {
			'content-type': 'application/vnd.apple.mpegurl',
			'cache-control': 'no-store'
		}
	});
};
