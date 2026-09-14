import { error, redirect } from '@sveltejs/kit';
import { getAccountExpiry, getLiveChannels } from '$lib/server/iptv';
import { clearUserSession } from '$lib/server/session';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.userSession) {
		throw redirect(303, '/login');
	}

	const [channels, expiry] = await Promise.all([
		getLiveChannels(locals.userSession),
		getAccountExpiry(locals.userSession)
	]);

	return { channels, expiry };
};

export const actions: Actions = {
	refresh: async ({ locals }) => {
		if (!locals.userSession) throw error(401, 'Not authenticated');
		await getLiveChannels(locals.userSession, { forceRefresh: true });
		return { refreshed: true };
	},

	logout: async ({ cookies }) => {
		clearUserSession(cookies);
		throw redirect(303, '/login');
	}
};
