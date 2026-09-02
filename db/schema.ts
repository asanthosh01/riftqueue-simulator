import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const experimentRuns = sqliteTable(
  "experiment_runs",
  {
    id: text("id").primaryKey(),
    createdAt: integer("created_at").notNull(),
    status: text("status", { enum: ["queued", "running", "completed", "failed"] })
      .notNull()
      .default("queued"),
    population: integer("population").notNull(),
    traffic: text("traffic", { enum: ["peak", "late", "overnight"] }).notNull(),
    policy: text("policy", { enum: ["fast", "balanced", "integrity"] }).notNull(),
    seed: integer("seed").notNull(),
    runs: integer("runs").notNull(),
    matchesPerRun: integer("matches_per_run").notNull(),
    progress: integer("progress").notNull().default(0),
    durationMs: real("duration_ms"),
    resultJson: text("result_json"),
    error: text("error"),
  },
  (table) => [index("idx_experiment_runs_created_at").on(table.createdAt)],
);
