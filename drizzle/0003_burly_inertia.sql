ALTER TABLE `experiment_runs` ADD `owner_key` text;--> statement-breakpoint
CREATE INDEX `idx_experiment_runs_owner_created_at` ON `experiment_runs` (`owner_key`,`created_at`);