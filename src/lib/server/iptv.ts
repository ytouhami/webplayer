import { asc } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import { hosts } from '$lib/server/db/schema';

const REQUEST_TIMEOUT_MS = 8000;
// Some Xtream/IPTV panels reject requests whose User-Agent doesn't look like
// a real player and silently return an empty/non-standard response instead
// of a proper HTTP error.
const PLAYER_USER_AGENT = 'VLC/3.0.20 LibVLC/3.0.20';

export function buildM3uUrl(hostUrl: string, username: string, password: string): string {
	const base = hostUrl.replace(/\/+$/, '');
	const params = new URLSearchParams({
		username,
		password,
		type: 'm3u_plus',
		output: 'ts'
	});
	return `${base}/get.php?${params.toString()}`;
}

export function buildApiUrl(hostUrl: string, username: string, password: string): string {
	const base = hostUrl.replace(/\/+$/, '');
	const params = new URLSearchParams({ username, password });
	return `${base}/player_api.php?${params.toString()}`;
}

function redact(url: string): string {
	try {
		const u = new URL(url);
		if (u.searchParams.has('username')) u.searchParams.set('username', '***');
		if (u.searchParams.has('password')) u.searchParams.set('password', '***');
		return u.toString();
	} catch {
		return url;
	}
}

// Checks credentials via player_api.php — Xtream's actual authentication
// endpoint (returns user_info.auth: 1 for a valid, active account). Not
// get.php: that endpoint exports the whole account as a downloadable M3U
// playlist, and providers commonly block/throttle it (anti-leech) even for
// valid accounts, independent of whether the credentials actually work.
export async function checkAuth(url: string): Promise<boolean> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
	const label = redact(url);

	try {
		const response = await fetch(url, {
			signal: controller.signal,
			headers: { 'User-Agent': PLAYER_USER_AGENT }
		});

		if (!response.ok) {
			console.error(`[iptv] ${label} -> HTTP ${response.status}`);
			return false;
		}

		const data = await response.json();
		const auth = data?.user_info?.auth;
		if (auth !== 1) {
			console.error(`[iptv] ${label} -> auth=${auth} status=${data?.user_info?.status}`);
			return false;
		}

		return true;
	} catch (err) {
		const reason = err instanceof Error ? err.message : String(err);
		console.error(`[iptv] ${label} -> ${reason}`);
		return false;
	} finally {
		clearTimeout(timeout);
	}
}

export async function authenticate(username: string, password: string): Promise<{ hostUrl: string } | null> {
	const hostRows = await getDb().select().from(hosts).orderBy(asc(hosts.id));

	if (hostRows.length === 0) {
		console.error('[iptv] no hosts configured — add one in /admin');
		return null;
	}

	for (const host of hostRows) {
		const url = buildApiUrl(host.url, username, password);
		if (await checkAuth(url)) {
			return { hostUrl: host.url };
		}
	}

	return null;
}
