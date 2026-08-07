import { redirect, type Handle } from '@sveltejs/kit';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import { ADMIN_COOKIE_NAME, verifyAdminSession } from '$lib/server/auth';
import { getDb } from '$lib/server/db';
import { USER_SESSION_COOKIE_NAME, readUserSession } from '$lib/server/session';

// Runs the DB migrations on first request rather than relying on a specific
// process entry point (e.g. start.mjs) actually being what launches the app —
// Hostinger's Node.js app hosting can be configured to run build/index.js
// directly, bypassing any wrapper script. Idempotent: Drizzle tracks applied
// migrations, so this is a no-op once the schema is current.
let migrated = false;
let migratePromise: Promise<void> | null = null;

function ensureMigrated(): Promise<void> {
	if (migrated) return Promise.resolve();
	migratePromise ??= migrate(getDb(), { migrationsFolder: './drizzle' })
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

	return resolve(event);
};
