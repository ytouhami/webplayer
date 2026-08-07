import { asc } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import { hosts } from '$lib/server/db/schema';

const STREAM_CHECK_TIMEOUT_MS = 8000;

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

export async function checkStream(url: string): Promise<boolean> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), STREAM_CHECK_TIMEOUT_MS);

	try {
		const response = await fetch(url, { signal: controller.signal });
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

export async function authenticate(username: string, password: string): Promise<{ hostUrl: string } | null> {
	const hostRows = await getDb().select().from(hosts).orderBy(asc(hosts.id));

	for (const host of hostRows) {
		const url = buildM3uUrl(host.url, username, password);
		if (await checkStream(url)) {
			return { hostUrl: host.url };
		}
	}

	return null;
}
