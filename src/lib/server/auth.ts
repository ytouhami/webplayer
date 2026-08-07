import { createHmac, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { Cookies } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';

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

export async function verifyAdminCredentials(username: string, password: string): Promise<boolean> {
	if (!env.ADMIN_USERNAME || !env.ADMIN_PASSWORD_HASH) {
		throw new Error('Missing required env var ADMIN_USERNAME or ADMIN_PASSWORD_HASH');
	}
	if (username !== env.ADMIN_USERNAME) return false;
	return bcrypt.compare(password, env.ADMIN_PASSWORD_HASH);
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
