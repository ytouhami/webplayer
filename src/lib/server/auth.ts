import { createHmac, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import type { Cookies } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { getDb } from '$lib/server/db';
import { admins } from '$lib/server/db/schema';

const COOKIE_NAME = 'pulse_admin';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

function secret(): string {
	if (!env.AUTH_SECRET) {
		throw new Error('Missing required env var AUTH_SECRET');
	}
	return env.AUTH_SECRET;
}

function sign(payload: string): string {
	return createHmac('sha256', secret()).update(payload).digest('hex');
}

export async function hasAnyAdmin(): Promise<boolean> {
	const rows = await getDb().select({ id: admins.id }).from(admins).limit(1);
	return rows.length > 0;
}

export async function createAdmin(username: string, password: string): Promise<void> {
	const passwordHash = await bcrypt.hash(password, 12);
	await getDb().insert(admins).values({ username, passwordHash });
}

export async function verifyAdminCredentials(username: string, password: string): Promise<boolean> {
	const rows = await getDb().select().from(admins).where(eq(admins.username, username)).limit(1);
	const admin = rows[0];
	if (!admin) return false;
	return bcrypt.compare(password, admin.passwordHash);
}

export function setAdminSession(cookies: Cookies): void {
	const payload = Buffer.from(JSON.stringify({ admin: true, iat: Date.now() })).toString('base64url');
	const signature = sign(payload);
	cookies.set(COOKIE_NAME, `${payload}.${signature}`, {
		path: '/',
		httpOnly: true,
		secure: !dev,
		sameSite: 'lax',
		maxAge: MAX_AGE_SECONDS
	});
}

export function clearAdminSession(cookies: Cookies): void {
	cookies.delete(COOKIE_NAME, { path: '/' });
}

export function verifyAdminSession(cookieValue: string | undefined): boolean {
	if (!cookieValue) return false;
	const [payload, signature] = cookieValue.split('.');
	if (!payload || !signature) return false;

	const expected = sign(payload);
	const a = Buffer.from(signature);
	const b = Buffer.from(expected);
	if (a.length !== b.length || !timingSafeEqual(a, b)) return false;

	try {
		const { admin } = JSON.parse(Buffer.from(payload, 'base64url').toString());
		return admin === true;
	} catch {
		return false;
	}
}

export { COOKIE_NAME as ADMIN_COOKIE_NAME };
