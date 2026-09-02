CREATE TABLE `experiment_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`population` integer NOT NULL,
	`traffic` text NOT NULL,
	`policy` text NOT NULL,
	`seed` integer NOT NULL,
	`runs` integer NOT NULL,
	`matches_per_run` integer NOT NULL,
	`progress` integer DEFAULT 0 NOT NULL,
	`duration_ms` real,
	`result_json` text,
	`error` text
);
--> statement-breakpoint
CREATE INDEX `idx_experiment_runs_created_at` ON `experiment_runs` (`created_at`);
--> statement-breakpoint
PRAGMA optimize;
