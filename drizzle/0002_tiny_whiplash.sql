ALTER TABLE `experiment_runs` ADD `idempotency_key` text;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_experiment_runs_idempotency_key` ON `experiment_runs` (`idempotency_key`);