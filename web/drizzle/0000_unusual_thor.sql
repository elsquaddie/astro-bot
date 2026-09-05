CREATE TABLE `reminders` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`event_key` text NOT NULL,
	`payload` text NOT NULL,
	`due_at` integer NOT NULL,
	`end_at` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`retry_at` integer NOT NULL,
	`claimed_at` integer,
	`sent_at` integer,
	`message_id` integer,
	`last_error` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reminders_user_event` ON `reminders` (`user_id`,`event_key`);--> statement-breakpoint
CREATE INDEX `reminders_due` ON `reminders` (`status`,`retry_at`);--> statement-breakpoint
CREATE TABLE `service_state` (
	`key` text PRIMARY KEY NOT NULL,
	`value` integer NOT NULL
);
