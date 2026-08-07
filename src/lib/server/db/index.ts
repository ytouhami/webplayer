import { drizzle, type MySql2Database } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { env } from '$env/dynamic/private';
import * as schema from './schema';

const required = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'] as const;

let instance: MySql2Database<typeof schema> | undefined;

// Lazily initialized so importing this module never fails at build/analysis
// time when DB env vars aren't set yet (e.g. SvelteKit's postbuild route
// analysis dynamically imports every server module).
export function getDb(): MySql2Database<typeof schema> {
	if (instance) return instance;

	for (const key of required) {
		if (!env[key]) {
			throw new Error(`Missing required env var ${key} for database connection`);
		}
	}

	const pool = mysql.createPool({
		host: env.DB_HOST,
		port: Number(env.DB_PORT),
		user: env.DB_USER,
		password: env.DB_PASSWORD,
		database: env.DB_NAME
	});

	instance = drizzle(pool, { schema, mode: 'default' });
	return instance;
}
