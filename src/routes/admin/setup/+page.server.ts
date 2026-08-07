import { fail, redirect } from '@sveltejs/kit';
import { createAdmin, hasAnyAdmin, setAdminSession } from '$lib/server/auth';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	if (await hasAnyAdmin()) {
		throw redirect(303, '/admin/login');
	}
};

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const data = await request.formData();
		const username = data.get('username')?.toString().trim() ?? '';
		const password = data.get('password')?.toString() ?? '';
		const confirmPassword = data.get('confirmPassword')?.toString() ?? '';

		if (!username || !password) {
			return fail(400, { error: 'Username and password are required.' });
		}
		if (password.length < 8) {
			return fail(400, { error: 'Password must be at least 8 characters.' });
		}
		if (password !== confirmPassword) {
			return fail(400, { error: 'Passwords do not match.' });
		}

		// Re-check to close the race between load() and this submission.
		if (await hasAnyAdmin()) {
			return fail(400, { error: 'An admin account already exists.' });
		}

		await createAdmin(username, password);
		setAdminSession(cookies);
		throw redirect(303, '/admin');
	}
};
