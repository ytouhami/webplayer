import type { RequestHandler } from './$types';

// 1x1 transparent GIF — fired via a classic <img> beacon from app.html so it
// works even on engines old enough to skip the module script entirely.
const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBTAA7', 'base64');

export const GET: RequestHandler = async ({ url, request }) => {
	const info = Object.fromEntries(url.searchParams);
	// No debug/remote-inspect access on the reported-broken TVs, so this is
	// the only channel we have for real capability data from them — goes to
	// this process's stdout (check it wherever the host captures Node app
	// logs, e.g. Hostinger's Node app log panel).
	console.log('[tv-probe]', JSON.stringify({ ...info, ip: request.headers.get('x-forwarded-for') ?? '' }));

	return new Response(PIXEL, {
		headers: {
			'content-type': 'image/gif',
			'cache-control': 'no-store'
		}
	});
};
