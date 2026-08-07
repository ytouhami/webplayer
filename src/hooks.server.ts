import { redirect, type Handle } from '@sveltejs/kit';
import { ADMIN_COOKIE_NAME, verifyAdminSession } from '$lib/server/auth';
import { USER_SESSION_COOKIE_NAME, readUserSession } from '$lib/server/session';

export const handle: Handle = async ({ event, resolve }) => {
	const isAdmin = verifyAdminSession(event.cookies.get(ADMIN_COOKIE_NAME));
	event.locals.isAdmin = isAdmin;
	event.locals.userSession = readUserSession(event.cookies.get(USER_SESSION_COOKIE_NAME));

	const { pathname } = event.url;
	const isPublicAdminRoute = pathname === '/admin/login' || pathname === '/admin/setup';
	if (pathname.startsWith('/admin') && !isPublicAdminRoute && !isAdmin) {
		throw redirect(303, '/admin/login');
	}

	return resolve(event);
};
