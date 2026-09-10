import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const experimentRuns = sqliteTable(
  "experiment_runs",
  {
    id: text("id").primaryKey(),
    createdAt: integer("created_at").notNull(),
    status: text("status", { enum: ["creating", "queued", "running", "completed", "failed"] })
      .notNull()
      .default("queued"),
    population: integer("population").notNull(),
    traffic: text("traffic", { enum: ["peak", "late", "overnight"] }).notNull(),
    policy: text("policy", { enum: ["fast", "balanced", "integrity"] }).notNull(),
    seed: integer("seed").notNull(),
    idempotencyKey: text("idempotency_key"),
    ownerKey: text("owner_key"),
    runs: integer("runs").notNull(),
    matchesPerRun: integer("matches_per_run").notNull(),
    progress: integer("progress").notNull().default(0),
    durationMs: real("duration_ms"),
    resultJson: text("result_json"),
    error: text("error"),
  },
  (table) => [
    index("idx_experiment_runs_created_at").on(table.createdAt),
    uniqueIndex("idx_experiment_runs_idempotency_key").on(table.idempotencyKey),
    index("idx_experiment_runs_owner_created_at").on(table.ownerKey, table.createdAt),
    index("idx_experiment_runs_status_created_at").on(table.status, table.createdAt),
  ],
);

export const experimentRateLimits = sqliteTable(
  "experiment_rate_limits",
  {
    bucketKey: text("bucket_key").primaryKey(),
    windowStartedAt: integer("window_started_at").notNull(),
    requestCount: integer("request_count").notNull(),
  },
  (table) => [index("idx_experiment_rate_limits_window").on(table.windowStartedAt)],
);
