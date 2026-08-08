import { error } from '@sveltejs/kit';
import { parseHttpUrl, PLAYER_USER_AGENT } from '$lib/server/m3u';
import type { RequestHandler } from './$types';

// No stored file on disk — Hostinger redeploys into a brand new versioned
// directory each time, so anything written to the local filesystem here
// would be orphaned the next time this project ships (see the logo-upload
// bug this same issue caused). Instead this re-fetches the source URL on
// every download and streams it straight through.
export const GET: RequestHandler = async ({ url }) => {
	// Protected implicitly: this route lives under /admin, which
	// hooks.server.ts already gates behind an admin session.
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
