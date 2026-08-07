import { redirect } from '@sveltejs/kit';
import { getAccountExpiry } from '$lib/server/iptv';
import { clearUserSession } from '$lib/server/session';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.userSession) {
		throw redirect(303, '/login');
	}

	const expiry = await getAccountExpiry(locals.userSession);
	const expiryLabel = expiry
		? expiry.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
		: 'Unlimited';

	return { expiryLabel };
};

export const actions: Actions = {
	logout: async ({ cookies }) => {
		clearUserSession(cookies);
		throw redirect(303, '/login');
	}
};
