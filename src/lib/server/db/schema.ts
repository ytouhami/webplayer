import { mysqlTable, int, varchar, text, longtext, timestamp } from 'drizzle-orm/mysql-core';

export const hosts = mysqlTable('hosts', {
	id: int('id').autoincrement().primaryKey(),
	name: varchar('name', { length: 255 }).notNull(),
	url: text('url').notNull(),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow()
});

export const appSettings = mysqlTable('app_settings', {
	id: int('id').primaryKey(),
	appName: varchar('app_name', { length: 24 }).notNull().default('Pulse'),
	// Stores a data: URL (base64), not a file path — logos live in the DB,
	// not on disk. Hostinger deploys into a brand-new versioned directory
	// each time, so anything written to local disk here would be orphaned
	// on the very next deploy (this bit us for real: uploaded logos
	// rendered fine until the next push, then 404'd).
	logoUrl: longtext('logo_url'),
	accentColor: varchar('accent_color', { length: 7 }).notNull().default('#4FE3D3'),
	updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow()
});

export const admins = mysqlTable('admins', {
	id: int('id').autoincrement().primaryKey(),
	username: varchar('username', { length: 255 }).notNull().unique(),
	passwordHash: varchar('password_hash', { length: 255 }).notNull(),
	createdAt: timestamp('created_at').notNull().defaultNow()
});
