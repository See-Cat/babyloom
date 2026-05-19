CREATE TABLE `entries` (
	`id` text PRIMARY KEY NOT NULL,
	`baby_id` text NOT NULL,
	`author_id` text NOT NULL,
	`content` text NOT NULL,
	`occurred_at` integer NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`deleted_by` text,
	FOREIGN KEY (`baby_id`) REFERENCES `babies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_entries_baby_status_occurred` ON `entries` (`baby_id`,`status`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `ix_entries_status_deleted` ON `entries` (`status`,`deleted_at`);--> statement-breakpoint
CREATE TABLE `entry_media` (
	`entry_id` text NOT NULL,
	`media_id` text NOT NULL,
	`attached_by` text NOT NULL,
	`attached_at` integer NOT NULL,
	PRIMARY KEY(`entry_id`, `media_id`),
	FOREIGN KEY (`entry_id`) REFERENCES `entries`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`attached_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_entry_media_media` ON `entry_media` (`media_id`);--> statement-breakpoint
CREATE TABLE `entry_milestones` (
	`entry_id` text NOT NULL,
	`milestone_id` text NOT NULL,
	PRIMARY KEY(`entry_id`, `milestone_id`),
	FOREIGN KEY (`entry_id`) REFERENCES `entries`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`milestone_id`) REFERENCES `milestones`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `milestones` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text,
	`name` text NOT NULL,
	`icon` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE cascade
);
