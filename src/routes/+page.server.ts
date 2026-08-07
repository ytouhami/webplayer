import { redirect } from '@sveltejs/kit';
import { clearUserSession } from '$lib/server/session';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.userSession) {
		throw redirect(303, '/login');
	}
};

export const actions: Actions = {
	logout: async ({ cookies }) => {
		clearUserSession(cookies);
		throw redirect(303, '/login');
	}
};
