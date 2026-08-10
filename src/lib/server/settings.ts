import { getDb } from '$lib/server/db';
import { appSettings } from '$lib/server/db/schema';

export type AppSettings = {
	id: number;
	appName: string;
	logoUrl: string | null;
	accentColor: string;
};

const DEFAULTS: AppSettings = {
	id: 1,
	appName: 'Pulse',
	logoUrl: null,
	accentColor: '#4FE3D3'
};

// A complete, correctly-padded base64 image data URL — not just "starts
// with data:image/". Two real ways a stored logoUrl ends up broken
// otherwise: (1) a leftover /uploads/<file>.png path from before logos
// moved into the DB as data URLs (that route and the whole uploads/
// directory approach no longer exist at all, since Hostinger deploys into
// a fresh directory every push and orphans anything written to local
// disk), and (2) a value saved back when logo_url was a narrower varchar
// column and got silently truncated mid-base64 by MySQL — widening the
// column afterward doesn't retroactively fix rows already truncated at
// write time. Either one renders as a permanently broken <img> on every
// page that shows the logo unless it's caught here first.
const LOGO_DATA_URL_PATTERN =
	/^data:image\/[\w.+-]+;base64,(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

function sanitizeLogoUrl(url: string | null): string | null {
	return url && LOGO_DATA_URL_PATTERN.test(url) ? url : null;
}

export async function getAppSettings(): Promise<AppSettings> {
	const rows = await getDb().select().from(appSettings);
	const row = rows[0] ?? DEFAULTS;
	return { ...row, logoUrl: sanitizeLogoUrl(row.logoUrl) };
}
