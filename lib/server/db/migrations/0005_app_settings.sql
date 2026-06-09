CREATE TABLE `app_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`media_cleanup_enabled` integer DEFAULT 1 NOT NULL,
	`media_cleanup_threshold_hours` integer DEFAULT 24 NOT NULL,
	`media_cleanup_last_run_at` integer,
	`media_cleanup_last_run_deleted` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL
);
