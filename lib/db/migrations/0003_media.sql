CREATE TABLE `media` (
	`id` text PRIMARY KEY NOT NULL,
	`baby_id` text NOT NULL,
	`uploaded_by` text NOT NULL,
	`client_upload_id` text NOT NULL,
	`type` text,
	`mime_type` text,
	`size_bytes` integer,
	`content_hash` text,
	`width` integer,
	`height` integer,
	`duration_sec` integer,
	`relative_path` text,
	`original_ext` text,
	`filename` text NOT NULL,
	`taken_at` integer,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`deleted_by` text,
	FOREIGN KEY (`baby_id`) REFERENCES `babies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`uploaded_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_media_baby_status` ON `media` (`baby_id`,`status`);--> statement-breakpoint
CREATE INDEX `ix_media_client_upload` ON `media` (`client_upload_id`,`uploaded_by`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_media_baby_hash_ready` ON `media` (`baby_id`,`content_hash`) WHERE status = 'ready';--> statement-breakpoint
CREATE INDEX `ix_media_status_deleted` ON `media` (`status`,`deleted_at`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_entry_media` (
	`entry_id` text NOT NULL,
	`media_id` text NOT NULL,
	`attached_by` text NOT NULL,
	`attached_at` integer NOT NULL,
	PRIMARY KEY(`entry_id`, `media_id`),
	FOREIGN KEY (`entry_id`) REFERENCES `entries`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`attached_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_entry_media`("entry_id", "media_id", "attached_by", "attached_at") SELECT "entry_id", "media_id", "attached_by", "attached_at" FROM `entry_media`;--> statement-breakpoint
DROP TABLE `entry_media`;--> statement-breakpoint
ALTER TABLE `__new_entry_media` RENAME TO `entry_media`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `ix_entry_media_media` ON `entry_media` (`media_id`);