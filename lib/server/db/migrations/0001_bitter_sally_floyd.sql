CREATE TABLE `babies` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`name` text NOT NULL,
	`birthday` text NOT NULL,
	`gender` text NOT NULL,
	`avatar_url` text,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`deleted_by` text,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_babies_family_status` ON `babies` (`family_id`,`status`);--> statement-breakpoint
CREATE TABLE `baby_member_permissions` (
	`id` text PRIMARY KEY NOT NULL,
	`baby_id` text NOT NULL,
	`family_member_id` text NOT NULL,
	`can_read` integer DEFAULT 1 NOT NULL,
	`can_write` integer DEFAULT 0 NOT NULL,
	`can_delete` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`baby_id`) REFERENCES `babies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`family_member_id`) REFERENCES `family_members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_baby_member_perm` ON `baby_member_permissions` (`baby_id`,`family_member_id`);--> statement-breakpoint
CREATE INDEX `ix_baby_member_perm_member` ON `baby_member_permissions` (`family_member_id`);--> statement-breakpoint
CREATE TABLE `families` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`owner_user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `family_members` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`joined_at` integer NOT NULL,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_family_member_family_user` ON `family_members` (`family_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `ix_family_members_user` ON `family_members` (`user_id`);