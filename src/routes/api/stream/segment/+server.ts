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

export const GET: RequestHandler = async ({ url, locals }) => {
	const session = locals.userSession;
	if (!session) throw error(401, 'Not authenticated');

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
			console.error(
				`[stream] segment fetch got HTTP ${response.status} for ${redactCreds(target, session)}`
			);
			// Passes the provider's actual status through instead of masking it
			// as our own 502 — hls.js surfaces this code in its error payload,
			// so the real cause (403 rejected, 404 gone, upstream 5xx, etc.)
			// shows up directly in the player's on-page diagnostics.
			throw error(response.status >= 400 && response.status <= 599 ? response.status : 502, `Provider returned HTTP ${response.status}`);
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
		console.error(
			`[stream] segment fetch failed for ${redactCreds(target, session)}: ${err instanceof Error ? err.message : err}`
		);
		throw error(502, 'Failed to reach provider');
	}
};
