import { getAppSettings } from '$lib/server/settings';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async () => {
	const settings = await getAppSettings();
	return { appName: settings.appName, accentColor: settings.accentColor, logoUrl: settings.logoUrl };
};
