import { sql } from 'drizzle-orm';
import type { getDb } from './index';

// Schema is applied as inline, idempotent DDL rather than via drizzle-kit's
// file-based migrator (drizzle/*.sql + meta/_journal.json). Hosting
// environments that only deploy the built server output (not the full repo
// tree) may not ship that migrations folder at all, so this keeps schema
// setup entirely inside the JS bundle. Keep this in sync with schema.ts by
// hand — for a project this size that's simpler than fighting deploy-time
// file layout. `drizzle-kit generate` is still run for local dev review of
// what changed, just not relied on at runtime.
const STATEMENTS = [
	`CREATE TABLE IF NOT EXISTS \`hosts\` (
		\`id\` int AUTO_INCREMENT NOT NULL,
		\`name\` varchar(255) NOT NULL,
		\`url\` text NOT NULL,
		\`created_at\` timestamp NOT NULL DEFAULT (now()),
		\`updated_at\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
		CONSTRAINT \`hosts_id\` PRIMARY KEY(\`id\`)
	)`,
	`CREATE TABLE IF NOT EXISTS \`app_settings\` (
		\`id\` int NOT NULL,
		\`app_name\` varchar(24) NOT NULL DEFAULT 'Pulse',
		\`logo_url\` varchar(512),
		\`accent_color\` varchar(7) NOT NULL DEFAULT '#4FE3D3',
		\`updated_at\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
		CONSTRAINT \`app_settings_id\` PRIMARY KEY(\`id\`)
	)`,
	`CREATE TABLE IF NOT EXISTS \`admins\` (
		\`id\` int AUTO_INCREMENT NOT NULL,
		\`username\` varchar(255) NOT NULL,
		\`password_hash\` varchar(255) NOT NULL,
		\`created_at\` timestamp NOT NULL DEFAULT (now()),
		CONSTRAINT \`admins_id\` PRIMARY KEY(\`id\`),
		CONSTRAINT \`admins_username_unique\` UNIQUE(\`username\`)
	)`
];

export async function ensureSchema(db: ReturnType<typeof getDb>): Promise<void> {
	for (const statement of STATEMENTS) {
		await db.execute(sql.raw(statement));
	}
}
