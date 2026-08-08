import { error } from '@sveltejs/kit';
import { buildM3uPlaylist, getLiveChannels } from '$lib/server/iptv';
import { parseHttpUrl, PLAYER_USER_AGENT } from '$lib/server/m3u';
import type { RequestHandler } from './$types';

// No stored file on disk — Hostinger redeploys into a brand new versioned
// directory each time, so anything written to the local filesystem here
// would be orphaned the next time this project ships (see the logo-upload
// bug this same issue caused). Instead this re-fetches/re-synthesizes the
// playlist on every download and streams it straight through.
export const GET: RequestHandler = async ({ url }) => {
	// Protected implicitly: this route lives under /admin, which
	// hooks.server.ts already gates behind an admin session.
	const host = url.searchParams.get('host');
	const username = url.searchParams.get('username');
	const password = url.searchParams.get('password');

	// Synthesized-playlist mode: get.php was blocked for this account, so
	// build the M3U from the same player_api.php channel list /live uses.
	if (host && username && password) {
		const session = { hostUrl: host, username, password };
		const channels = await getLiveChannels(session);
		const text = buildM3uPlaylist(session, channels);

		return new Response(text, {
			headers: {
				'content-type': 'text/plain; charset=utf-8',
				'content-disposition': 'attachment; filename="playlist.txt"',
				'cache-control': 'no-store'
			}
		});
	}

	const target = url.searchParams.get('url');
	if (!target) throw error(400, 'Missing url');

	const parsed = parseHttpUrl(target);
	if (!parsed) throw error(400, 'URL must be http or https');

	const response = await fetch(parsed, { headers: { 'User-Agent': PLAYER_USER_AGENT } });
	if (!response.ok || !response.body) {
		throw error(502, `Failed to fetch playlist (HTTP ${response.status})`);
	}

	return new Response(response.body, {
		headers: {
			'content-type': 'text/plain; charset=utf-8',
			'content-disposition': 'attachment; filename="playlist.txt"',
			'cache-control': 'no-store'
		}
	});
};
