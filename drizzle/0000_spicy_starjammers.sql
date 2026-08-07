CREATE TABLE `app_settings` (
	`id` int NOT NULL,
	`app_name` varchar(24) NOT NULL DEFAULT 'Pulse',
	`logo_url` varchar(512),
	`accent_color` varchar(7) NOT NULL DEFAULT '#4FE3D3',
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `app_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `hosts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`url` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `hosts_id` PRIMARY KEY(`id`)
);
