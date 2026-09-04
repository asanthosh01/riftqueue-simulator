CREATE TABLE `experiment_rate_limits` (
	`bucket_key` text PRIMARY KEY NOT NULL,
	`window_started_at` integer NOT NULL,
	`request_count` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_experiment_rate_limits_window` ON `experiment_rate_limits` (`window_started_at`);