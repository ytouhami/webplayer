import { redirect, type Handle } from '@sveltejs/kit';
import { ADMIN_COOKIE_NAME, verifyAdminSession } from '$lib/server/auth';

export const handle: Handle = async ({ event, resolve }) => {
	const isAdmin = verifyAdminSession(event.cookies.get(ADMIN_COOKIE_NAME));
	event.locals.isAdmin = isAdmin;

	const { pathname } = event.url;
	if (pathname.startsWith('/admin') && pathname !== '/admin/login' && !isAdmin) {
		throw redirect(303, '/admin/login');
	}

	return resolve(event);
};
