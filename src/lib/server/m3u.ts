const PLAYER_USER_AGENT = 'VLC/3.0.20 LibVLC/3.0.20';
const TIMEOUT_MS = 8000;

export function parseHttpUrl(value: string): URL | null {
	try {
		const url = new URL(value);
		return url.protocol === 'http:' || url.protocol === 'https:' ? url : null;
	} catch {
		return null;
	}
}

// Reads just the first chunk to confirm the URL actually serves an M3U
// playlist before we show a download link for it — same read-a-chunk-
// then-cancel approach used for the login stream check, no need to pull a
// potentially huge playlist just to validate it.
export async function verifyM3uUrl(url: string): Promise<boolean> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

	try {
		const response = await fetch(url, {
			signal: controller.signal,
			headers: { 'User-Agent': PLAYER_USER_AGENT }
		});
		if (!response.ok || !response.body) return false;

		const reader = response.body.getReader();
		try {
			const { value } = await reader.read();
			const chunk = value ? new TextDecoder().decode(value) : '';
			return chunk.trimStart().startsWith('#EXTM3U');
		} finally {
			await reader.cancel().catch(() => {});
		}
	} catch {
		return false;
	} finally {
		clearTimeout(timeout);
	}
}

// Extracts {host, username, password} from a standard Xtream get.php URL
// (http://host/get.php?username=...&password=...), so a blocked get.php can
// fall back to fetching the same data via player_api.php instead.
export function parseXtreamGetPhpUrl(url: URL): { host: string; username: string; password: string } | null {
	if (!url.pathname.replace(/\/+$/, '').endsWith('/get.php')) return null;

	const username = url.searchParams.get('username');
	const password = url.searchParams.get('password');
	if (!username || !password) return null;

	return { host: `${url.protocol}//${url.host}`, username, password };
}

export { PLAYER_USER_AGENT };
