import { fail, redirect } from '@sveltejs/kit';
import { hasAnyAdmin, setAdminSession, verifyAdminCredentials } from '$lib/server/auth';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.isAdmin) {
		throw redirect(303, '/admin');
	}
	if (!(await hasAnyAdmin())) {
		throw redirect(303, '/admin/setup');
	}
};

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const data = await request.formData();
		const username = data.get('username')?.toString().trim() ?? '';
		const password = data.get('password')?.toString() ?? '';

		if (!username || !password) {
			return fail(400, { error: 'Invalid credentials. Contact your administrator.' });
		}

		const valid = await verifyAdminCredentials(username, password);
		if (!valid) {
			return fail(400, { error: 'Invalid credentials. Contact your administrator.' });
		}

		setAdminSession(cookies);
		throw redirect(303, '/admin');
	}
};
