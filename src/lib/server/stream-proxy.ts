import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '$env/dynamic/private';

// Prevents /api/stream/segment from being usable as an open SSRF proxy: it
// only ever fetches URLs that we ourselves generated while rewriting a
// playlist, verified by this signature — never an arbitrary attacker-
// supplied URL. Reuses AUTH_SECRET since this is the same threat model as
// the admin session cookie (tamper-evidence, not confidentiality).
function secret(): string {
	if (!env.AUTH_SECRET) {
		throw new Error('Missing required env var AUTH_SECRET');
	}
	return env.AUTH_SECRET;
}

export function signUrl(url: string): string {
	return createHmac('sha256', secret()).update(url).digest('hex');
}

export function verifySignedUrl(url: string, signature: string): boolean {
	const expected = signUrl(url);
	const a = Buffer.from(signature);
	const b = Buffer.from(expected);
	return a.length === b.length && timingSafeEqual(a, b);
}
