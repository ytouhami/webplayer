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

export async function getAppSettings(): Promise<AppSettings> {
	const rows = await getDb().select().from(appSettings);
	return rows[0] ?? DEFAULTS;
}
