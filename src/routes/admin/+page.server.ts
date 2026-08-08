import { fail, redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { appSettings, hosts } from '$lib/server/db/schema';
import { clearAdminSession } from '$lib/server/auth';
import { getAppSettings } from '$lib/server/settings';
import { parseHttpUrl, parseXtreamGetPhpUrl, verifyM3uUrl } from '$lib/server/m3u';
import { checkAuth, buildApiUrl } from '$lib/server/iptv';
import type { Actions, PageServerLoad } from './$types';

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
// Logo is stored as a base64 data: URL in the DB (not a file on disk — see
// schema.ts for why), and it rides along on every single page load via the
// root layout, so this stays small enough not to bloat every request.
const MAX_LOGO_BYTES = 300 * 1024;
const ALLOWED_LOGO_TYPES = new Set([
	'image/png',
	'image/jpeg',
	'image/webp',
	'image/gif',
	'image/svg+xml'
]);

export const load: PageServerLoad = async () => {
	const hostRows = await getDb().select().from(hosts);
	const settings = await getAppSettings();

	return { hosts: hostRows, settings };
};

export const actions: Actions = {
	save: async ({ request }) => {
		const data = await request.formData();
		const appName = data.get('appName')?.toString().trim() || 'Pulse';
		const accentColor = data.get('accentColor')?.toString().trim() || '#4FE3D3';
		const logoAction = data.get('logoAction')?.toString() ?? 'keep';
		const hostsRaw = data.get('hostsJson')?.toString() ?? '[]';

		if (!HEX_COLOR.test(accentColor)) {
			return fail(400, { error: 'Accent color must be a hex color like #4FE3D3.' });
		}

		let parsedHosts: { name: string; url: string }[];
		try {
			const arr = JSON.parse(hostsRaw);
			if (!Array.isArray(arr)) throw new Error('not an array');
			parsedHosts = arr
				.map((h) => ({ name: String(h.name ?? '').trim(), url: String(h.url ?? '').trim() }))
				.filter((h) => h.name || h.url);
		} catch {
			return fail(400, { error: 'Malformed host list.' });
		}

		let logoUrl: string | null | undefined;
		if (logoAction === 'remove') {
			logoUrl = null;
		} else if (logoAction === 'new') {
			const file = data.get('logo');
			if (file instanceof File && file.size > 0) {
				if (file.size > MAX_LOGO_BYTES) {
					return fail(400, { error: 'Logo must be smaller than 300KB.' });
				}
				if (!ALLOWED_LOGO_TYPES.has(file.type)) {
					return fail(400, { error: 'Logo must be a PNG, JPEG, WebP, GIF, or SVG image.' });
				}

				const bytes = Buffer.from(await file.arrayBuffer());
				logoUrl = `data:${file.type};base64,${bytes.toString('base64')}`;
			}
		}

		await getDb().transaction(async (tx) => {
			await tx.delete(hosts);
			if (parsedHosts.length) {
				await tx.insert(hosts).values(parsedHosts);
			}

			await tx
				.insert(appSettings)
				.values({
					id: 1,
					appName,
					accentColor,
					logoUrl: logoUrl ?? null
				})
				.onDuplicateKeyUpdate({
					set: {
						appName,
						accentColor,
						...(logoUrl !== undefined ? { logoUrl } : {})
					}
				});
		});

		return { success: true };
	},

	logout: async ({ cookies }) => {
		clearAdminSession(cookies);
		throw redirect(303, '/admin/login');
	},

	checkM3u: async ({ request }) => {
		const data = await request.formData();
		const m3uUrl = data.get('m3uUrl')?.toString().trim() ?? '';

		const parsed = parseHttpUrl(m3uUrl);
		if (!parsed) {
			return fail(400, { m3uError: 'Enter a valid http/https URL.' });
		}

		if (await verifyM3uUrl(parsed.toString())) {
			return { m3uDownloadUrl: `/admin/m3u-download?url=${encodeURIComponent(parsed.toString())}` };
		}

		// Some providers block get.php specifically (anti-leech) while their
		// API stays open — fall back to the same player_api.php method /live
		// uses to list channels, and synthesize the playlist from that.
		const xtream = parseXtreamGetPhpUrl(parsed);
		if (xtream) {
			const authOk = await checkAuth(buildApiUrl(xtream.host, xtream.username, xtream.password));
			if (authOk) {
				const params = new URLSearchParams(xtream);
				return { m3uDownloadUrl: `/admin/m3u-download?${params.toString()}` };
			}
		}

		return fail(400, { m3uError: "Couldn't fetch a valid M3U playlist from that URL." });
	}
};
