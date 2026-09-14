import { redirect, type Handle } from '@sveltejs/kit';
import { ADMIN_COOKIE_NAME, verifyAdminSession } from '$lib/server/auth';
import { getDb } from '$lib/server/db';
import { ensureSchema } from '$lib/server/db/init';
import { USER_SESSION_COOKIE_NAME, readUserSession } from '$lib/server/session';

// Applies schema DDL on first request rather than relying on a specific
// process entry point (e.g. start.mjs) actually being what launches the app —
// Hostinger's Node.js app hosting can be configured to run build/index.js
// directly, bypassing any wrapper script. Idempotent (CREATE TABLE IF NOT
// EXISTS), so this is a no-op on every request after the first.
let migrated = false;
let migratePromise: Promise<void> | null = null;

function ensureMigrated(): Promise<void> {
	if (migrated) return Promise.resolve();
	migratePromise ??= ensureSchema(getDb())
		.then(() => {
			migrated = true;
		})
		.catch((err) => {
			migratePromise = null;
			throw err;
		});
	return migratePromise;
}

export const handle: Handle = async ({ event, resolve }) => {
	await ensureMigrated();

	const isAdmin = verifyAdminSession(event.cookies.get(ADMIN_COOKIE_NAME));
	event.locals.isAdmin = isAdmin;
	event.locals.userSession = readUserSession(event.cookies.get(USER_SESSION_COOKIE_NAME));

	const { pathname } = event.url;
	const isPublicAdminRoute = pathname === '/admin/login' || pathname === '/admin/setup';
	if (pathname.startsWith('/admin') && !isPublicAdminRoute && !isAdmin) {
		throw redirect(303, '/admin/login');
	}

	const response = await resolve(event);
	// Every page here (including its redirects) is driven entirely by the
	// session cookie, so none of it is ever safe to cache — a stale cached
	// redirect (e.g. the pre-logout "you have a session, go to /live") can
	// collide with the server's fresh redirect for the current cookie and
	// bounce the browser between /login and /live forever. Now that CSR is
	// disabled site-wide, every navigation is a real HTTP request subject to
	// the browser's cache, so this has to be explicit.
	response.headers.set('cache-control', 'no-store');
	return response;
};
