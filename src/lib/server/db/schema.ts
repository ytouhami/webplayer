import { mysqlTable, int, varchar, text, timestamp } from 'drizzle-orm/mysql-core';

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
	logoUrl: varchar('logo_url', { length: 512 }),
	accentColor: varchar('accent_color', { length: 7 }).notNull().default('#4FE3D3'),
	updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow()
});

export const admins = mysqlTable('admins', {
	id: int('id').autoincrement().primaryKey(),
	username: varchar('username', { length: 255 }).notNull().unique(),
	passwordHash: varchar('password_hash', { length: 255 }).notNull(),
	createdAt: timestamp('created_at').notNull().defaultNow()
});
