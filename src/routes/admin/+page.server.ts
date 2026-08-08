import { fail, redirect } from '@sveltejs/kit';
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from '$env/dynamic/private';
import { getDb } from '$lib/server/db';
import { appSettings, hosts } from '$lib/server/db/schema';
import { clearAdminSession } from '$lib/server/auth';
import { getAppSettings } from '$lib/server/settings';
import { parseHttpUrl, verifyM3uUrl } from '$lib/server/m3u';
import type { Actions, PageServerLoad } from './$types';

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const MAX_LOGO_BYTES = 5 * 1024 * 1024;
const ALLOWED_LOGO_TYPES: Record<string, string> = {
	'image/png': 'png',
	'image/jpeg': 'jpg',
	'image/webp': 'webp',
	'image/gif': 'gif',
	'image/svg+xml': 'svg'
};

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
					return fail(400, { error: 'Logo must be smaller than 5MB.' });
				}
				const ext = ALLOWED_LOGO_TYPES[file.type];
				if (!ext) {
					return fail(400, { error: 'Logo must be a PNG, JPEG, WebP, GIF, or SVG image.' });
				}

				const uploadsDir = path.resolve(env.UPLOADS_DIR ?? './uploads');
				await mkdir(uploadsDir, { recursive: true });

				const filename = `logo-${Date.now()}-${randomBytes(4).toString('hex')}.${ext}`;
				const bytes = Buffer.from(await file.arrayBuffer());
				await writeFile(path.join(uploadsDir, filename), bytes);

				logoUrl = `/uploads/${filename}`;
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

		const ok = await verifyM3uUrl(parsed.toString());
		if (!ok) {
			return fail(400, { m3uError: "Couldn't fetch a valid M3U playlist from that URL." });
		}

		return { m3uDownloadUrl: `/admin/m3u-download?url=${encodeURIComponent(parsed.toString())}` };
	}
};
