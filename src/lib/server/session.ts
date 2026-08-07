import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import type { Cookies } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';

const COOKIE_NAME = 'pulse_session';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days
const ALGORITHM = 'aes-256-gcm';

export type UserSession = {
	username: string;
	password: string;
	hostUrl: string;
};

let cachedKey: Buffer | undefined;

function key(): Buffer {
	if (cachedKey) return cachedKey;
	if (!env.SESSION_SECRET) {
		throw new Error('Missing required env var SESSION_SECRET');
	}
	cachedKey = scryptSync(env.SESSION_SECRET, 'pulse-session-salt', 32);
	return cachedKey;
}

function encrypt(payload: UserSession): string {
	const iv = randomBytes(12);
	const cipher = createCipheriv(ALGORITHM, key(), iv);
	const data = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
	const authTag = cipher.getAuthTag();
	return [iv, authTag, data].map((buf) => buf.toString('base64url')).join('.');
}

function decrypt(cookieValue: string): UserSession | null {
	const parts = cookieValue.split('.');
	if (parts.length !== 3) return null;
	const [ivB64, authTagB64, dataB64] = parts;

	try {
		const iv = Buffer.from(ivB64, 'base64url');
		const authTag = Buffer.from(authTagB64, 'base64url');
		const data = Buffer.from(dataB64, 'base64url');

		const decipher = createDecipheriv(ALGORITHM, key(), iv);
		decipher.setAuthTag(authTag);
		const decrypted = Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');

		const parsed = JSON.parse(decrypted);
		if (
			typeof parsed?.username === 'string' &&
			typeof parsed?.password === 'string' &&
			typeof parsed?.hostUrl === 'string'
		) {
			return parsed;
		}
		return null;
	} catch {
		return null;
	}
}

export function setUserSession(cookies: Cookies, payload: UserSession): void {
	cookies.set(COOKIE_NAME, encrypt(payload), {
		path: '/',
		httpOnly: true,
		secure: !dev,
		sameSite: 'lax',
		maxAge: MAX_AGE_SECONDS
	});
}

export function clearUserSession(cookies: Cookies): void {
	cookies.delete(COOKIE_NAME, { path: '/' });
}

export function readUserSession(cookieValue: string | undefined): UserSession | null {
	if (!cookieValue) return null;
	return decrypt(cookieValue);
}

export { COOKIE_NAME as USER_SESSION_COOKIE_NAME };
