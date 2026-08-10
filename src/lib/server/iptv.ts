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

// null means "no expiry" (Xtream returns null/empty exp_date for unlimited
// accounts) rather than a parse failure.
export async function getAccountExpiry(session: UserSession): Promise<Date | null> {
	const url = buildApiUrl(session.hostUrl, session.username, session.password);
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

	try {
		const response = await fetch(url, {
			signal: controller.signal,
			headers: { 'User-Agent': PLAYER_USER_AGENT }
		});
		if (!response.ok) return null;

		const data = await response.json();
		const expDate = data?.user_info?.exp_date;
		if (!expDate) return null;

		const date = new Date(Number(expDate) * 1000);
		return Number.isNaN(date.getTime()) ? null : date;
	} catch (err) {
		console.error(`[iptv] account expiry fetch error: ${err instanceof Error ? err.message : err}`);
		return null;
	} finally {
		clearTimeout(timeout);
	}
}

export type LiveChannel = {
	id: number;
	name: string;
	category: string;
	badge: string;
	colorA: string;
	colorB: string;
	icon: string | null;
	archiveDays: number;
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
type XtreamLiveStream = {
	stream_id: number;
	name: string;
	category_id: string;
	stream_icon?: string;
	tv_archive?: number;
	tv_archive_duration?: string | number;
};

// In-memory cache, keyed per host+account. The channel list is expensive to
// fetch (two full-catalog API calls against the provider) and doesn't
// change often, so page loads reuse it — only the explicit "Refresh
// Playlist" action re-fetches. A failed fetch never overwrites a good
// cache entry (returns the stale list instead), so a transient provider
// hiccup doesn't wipe out a working channel list.
const channelsCache = new Map<string, LiveChannel[]>();

function cacheKey(session: UserSession): string {
	return `${session.hostUrl}::${session.username}`;
}

export async function getLiveChannels(
	session: UserSession,
	opts: { forceRefresh?: boolean } = {}
): Promise<LiveChannel[]> {
	const key = cacheKey(session);
	const cached = channelsCache.get(key);
	if (cached && !opts.forceRefresh) return cached;

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
			return cached ?? [];
		}

		const categories: XtreamCategory[] = await catRes.json();
		const streams: XtreamLiveStream[] = await streamRes.json();
		const categoryNames = new Map(categories.map((c) => [c.category_id, c.category_name]));

		const channels = streams
			.filter((s) => !s.name.trim().startsWith('#'))
			.map((s) => {
				const [colorA, colorB] = BADGE_PALETTE[seedFromString(s.name) % BADGE_PALETTE.length];
				return {
					id: s.stream_id,
					name: s.name,
					category: categoryNames.get(s.category_id) ?? 'General',
					badge: badgeFor(s.name),
					colorA,
					colorB,
					icon: s.stream_icon?.trim() || null,
					archiveDays: s.tv_archive === 1 ? Number(s.tv_archive_duration) || 0 : 0
				};
			});

		channelsCache.set(key, channels);
		return channels;
	} catch (err) {
		const reason = err instanceof Error ? err.message : String(err);
		console.error(`[iptv] live channel fetch error: ${reason}`);
		return cached ?? [];
	} finally {
		clearTimeout(timeout);
	}
}

export type EpgEntry = {
	title: string;
	description: string;
	startLabel: string;
	endLabel: string;
};

type XtreamEpgListing = {
	title?: string;
	description?: string;
	start?: string;
	end?: string;
	start_timestamp?: string;
	stop_timestamp?: string;
};

function decodeEpgText(value: string | undefined): string {
	if (!value) return '';
	try {
		return Buffer.from(value, 'base64').toString('utf8');
	} catch {
		return value;
	}
}

function formatEpgTime(timestamp: string | undefined, fallback: string | undefined): string {
	const ts = timestamp ? Number(timestamp) : NaN;
	const date = !Number.isNaN(ts) && ts > 0 ? new Date(ts * 1000) : fallback ? new Date(fallback.replace(' ', 'T')) : null;
	if (!date || Number.isNaN(date.getTime())) return '';
	return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Xtream's EPG data is per-channel, keyed off epg_channel_id — many
// providers/accounts leave this unmapped for some or all channels, in which
// case get_short_epg legitimately returns an empty list rather than an
// error. That's a normal "no programming data" outcome, not a failure.
export async function getChannelEpg(session: UserSession, streamId: number): Promise<EpgEntry[]> {
	const base = session.hostUrl.replace(/\/+$/, '');
	const params = new URLSearchParams({
		username: session.username,
		password: session.password,
		action: 'get_short_epg',
		stream_id: String(streamId)
	});
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

	try {
		const response = await fetch(`${base}/player_api.php?${params.toString()}`, {
			signal: controller.signal,
			headers: { 'User-Agent': PLAYER_USER_AGENT }
		});
		if (!response.ok) return [];

		const data = await response.json();
		const listings: XtreamEpgListing[] = Array.isArray(data?.epg_listings) ? data.epg_listings : [];

		return listings
			.map((l) => ({
				title: decodeEpgText(l.title) || 'Untitled',
				description: decodeEpgText(l.description),
				startLabel: formatEpgTime(l.start_timestamp, l.start),
				endLabel: formatEpgTime(l.stop_timestamp, l.end)
			}))
			.filter((entry) => entry.title || entry.startLabel);
	} catch (err) {
		console.error(`[iptv] EPG fetch error for stream ${streamId}: ${err instanceof Error ? err.message : err}`);
		return [];
	} finally {
		clearTimeout(timeout);
	}
}

export type CatchupEntry = {
	title: string;
	description: string;
	startLabel: string;
	endLabel: string;
	start: number; // epoch seconds, needed to build the timeshift stream URL
	durationMinutes: number;
};

function timeshiftStamp(epochSeconds: number): string {
	// Xtream's timeshift URLs take the program start as
	// YYYY-MM-DD:HH-MM in the provider's own clock — reusing the epoch
	// timestamp the provider itself returned for this program (rather than
	// reformatting through the browser/server's local timezone) keeps it
	// aligned with whatever clock basis that epoch already reflects.
	const d = new Date(epochSeconds * 1000);
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}:${pad(d.getUTCHours())}-${pad(d.getUTCMinutes())}`;
}

// Catch-up/TV-archive listings need the full per-channel EPG table (past
// programs included), unlike get_short_epg's forward-looking window —
// Xtream panels expose that via get_simple_data_table. Only entries that
// have already ended and still fall inside the channel's archive retention
// window (archiveDays, from tv_archive_duration) are watchable.
export async function getChannelCatchup(
	session: UserSession,
	streamId: number,
	archiveDays: number
): Promise<CatchupEntry[]> {
	if (archiveDays <= 0) return [];

	const base = session.hostUrl.replace(/\/+$/, '');
	const params = new URLSearchParams({
		username: session.username,
		password: session.password,
		action: 'get_simple_data_table',
		stream_id: String(streamId)
	});
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

	try {
		const response = await fetch(`${base}/player_api.php?${params.toString()}`, {
			signal: controller.signal,
			headers: { 'User-Agent': PLAYER_USER_AGENT }
		});
		if (!response.ok) return [];

		const data = await response.json();
		const listings: XtreamEpgListing[] = Array.isArray(data?.epg_listings) ? data.epg_listings : [];

		const now = Date.now() / 1000;
		const earliest = now - archiveDays * 86400;

		return listings
			.map((l) => ({
				title: decodeEpgText(l.title) || 'Untitled',
				description: decodeEpgText(l.description),
				start: l.start_timestamp ? Number(l.start_timestamp) : NaN,
				stop: l.stop_timestamp ? Number(l.stop_timestamp) : NaN,
				startLabel: formatEpgTime(l.start_timestamp, l.start),
				endLabel: formatEpgTime(l.stop_timestamp, l.end)
			}))
			.filter((l) => !Number.isNaN(l.start) && !Number.isNaN(l.stop) && l.stop <= now && l.stop >= earliest)
			.sort((a, b) => b.start - a.start)
			.map((l) => ({
				title: l.title,
				description: l.description,
				startLabel: l.startLabel,
				endLabel: l.endLabel,
				start: l.start,
				durationMinutes: Math.max(1, Math.round((l.stop - l.start) / 60))
			}));
	} catch (err) {
		console.error(`[iptv] catchup fetch error for stream ${streamId}: ${err instanceof Error ? err.message : err}`);
		return [];
	} finally {
		clearTimeout(timeout);
	}
}

export function buildTimeshiftUrl(session: UserSession, streamId: number, start: number, durationMinutes: number): string {
	const base = session.hostUrl.replace(/\/+$/, '');
	const stamp = timeshiftStamp(start);
	return `${base}/timeshift/${encodeURIComponent(session.username)}/${encodeURIComponent(session.password)}/${durationMinutes}/${stamp}/${streamId}.m3u8`;
}

// Synthesizes a standard M3U playlist from the same channel list /live
// renders, for providers whose get.php export is blocked (anti-leech) even
// though player_api.php works fine for the same account.
export function buildM3uPlaylist(session: UserSession, channels: LiveChannel[]): string {
	const base = session.hostUrl.replace(/\/+$/, '');
	const lines = ['#EXTM3U'];

	for (const ch of channels) {
		const category = ch.category.replace(/"/g, "'");
		const name = ch.name.replace(/[\r\n]/g, ' ');
		const streamUrl = `${base}/live/${encodeURIComponent(session.username)}/${encodeURIComponent(session.password)}/${ch.id}.ts`;
		lines.push(`#EXTINF:-1 group-title="${category}",${name}`);
		lines.push(streamUrl);
	}

	return lines.join('\n');
}
