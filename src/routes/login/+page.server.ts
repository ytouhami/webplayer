import { fail, redirect } from '@sveltejs/kit';
import { authenticate } from '$lib/server/iptv';
import { setUserSession } from '$lib/server/session';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.userSession) {
		throw redirect(303, '/live');
	}
};

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const data = await request.formData();
		const username = data.get('username')?.toString().trim() ?? '';
		const password = data.get('password')?.toString() ?? '';

		if (!username || !password) {
			return fail(400, { error: 'Wrong credentials.' });
		}

		const result = await authenticate(username, password);
		if (!result) {
			return fail(400, { error: 'Wrong credentials.' });
		}

		setUserSession(cookies, { username, password, hostUrl: result.hostUrl });
		throw redirect(303, '/live');
	}
};
