import { asc } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import { hosts } from '$lib/server/db/schema';
import type { UserSession } from '$lib/server/session';

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

export type LiveChannel = {
	id: number;
	name: string;
	category: string;
	badge: string;
	colorA: string;
	colorB: string;
};

// Deterministic per-channel badge letters + gradient, since the real API
// doesn't provide the mockup's hand-picked colors — same seeded-hash
// approach already used for mock data in category.html/movie.html.
const BADGE_PALETTE: [string, string][] = [
	['#4FE3D3', '#2A8F86'],
	['#FF8A65', '#C4531F'],
	['#8B7CF6', '#4C3FA8'],
	['#FFD166', '#B8860B'],
	['#F76E9C', '#A83A63'],
	['#5AD1E6', '#1E7A8C'],
	['#9BE15D', '#4B8B2E'],
	['#B0BEC5', '#546E7A']
];

function seedFromString(str: string): number {
	let h = 0;
	for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
	return h;
}

function badgeFor(name: string): string {
	const words = name
		.replace(/[^\p{L}\p{N}\s]/gu, ' ')
		.trim()
		.split(/\s+/)
		.filter(Boolean);
	if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
	if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
	return '??';
}

type XtreamCategory = { category_id: string; category_name: string };
type XtreamLiveStream = { stream_id: number; name: string; category_id: string };

export async function getLiveChannels(session: UserSession): Promise<LiveChannel[]> {
	const base = session.hostUrl.replace(/\/+$/, '');
	const params = new URLSearchParams({ username: session.username, password: session.password });
	const headers = { 'User-Agent': PLAYER_USER_AGENT };
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

	try {
		const [catRes, streamRes] = await Promise.all([
			fetch(`${base}/player_api.php?${params.toString()}&action=get_live_categories`, {
				headers,
				signal: controller.signal
			}),
			fetch(`${base}/player_api.php?${params.toString()}&action=get_live_streams`, {
				headers,
				signal: controller.signal
			})
		]);

		if (!catRes.ok || !streamRes.ok) {
			console.error(`[iptv] live channel fetch failed: categories=${catRes.status} streams=${streamRes.status}`);
			return [];
		}

		const categories: XtreamCategory[] = await catRes.json();
		const streams: XtreamLiveStream[] = await streamRes.json();
		const categoryNames = new Map(categories.map((c) => [c.category_id, c.category_name]));

		return streams.map((s) => {
			const [colorA, colorB] = BADGE_PALETTE[seedFromString(s.name) % BADGE_PALETTE.length];
			return {
				id: s.stream_id,
				name: s.name,
				category: categoryNames.get(s.category_id) ?? 'General',
				badge: badgeFor(s.name),
				colorA,
				colorB
			};
		});
	} catch (err) {
		const reason = err instanceof Error ? err.message : String(err);
		console.error(`[iptv] live channel fetch error: ${reason}`);
		return [];
	} finally {
		clearTimeout(timeout);
	}
}
