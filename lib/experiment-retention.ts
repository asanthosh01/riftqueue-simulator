const DEFAULT_RETENTION_DAYS = 30;
const DEFAULT_ABANDONED_CREATING_SECONDS = 15 * 60;
const DEFAULT_CLEANUP_BATCH_SIZE = 100;
const MAX_CLEANUP_BATCH_SIZE = 500;

type RetentionDatabase = {
  prepare: (query: string) => {
    bind: (...values: unknown[]) => {
      run: () => Promise<unknown>;
    };
  };
};

type RetentionEnvironment = {
  EXPERIMENT_ABANDONED_CREATING_SECONDS?: string;
  EXPERIMENT_RETENTION_CLEANUP_BATCH_SIZE?: string;
  EXPERIMENT_RETENTION_DAYS?: string;
};

type RetentionConfiguration = {
  abandonedCreatingMs: number;
  batchSize: number;
  terminalRetentionMs: number;
};

function configuredPositiveInteger(
  name: string,
  value: string | undefined,
  fallback: number,
) {
  if (value === undefined) return fallback;
  if (!/^[1-9]\d*$/.test(value)) {
    throw new Error(`${name} must be a positive integer.`);
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`${name} must be a safe positive integer.`);
  }
  return parsed;
}

function durationFromSeconds(name: string, seconds: number) {
  if (seconds > Math.floor(Number.MAX_SAFE_INTEGER / 1_000)) {
    throw new Error(`${name} is too large.`);
  }
  return seconds * 1_000;
}

export function getExperimentRetentionConfiguration(
  environment: RetentionEnvironment,
): RetentionConfiguration {
  const retentionDays = configuredPositiveInteger(
    "EXPERIMENT_RETENTION_DAYS",
    environment.EXPERIMENT_RETENTION_DAYS,
    DEFAULT_RETENTION_DAYS,
  );
  const abandonedCreatingSeconds = configuredPositiveInteger(
    "EXPERIMENT_ABANDONED_CREATING_SECONDS",
    environment.EXPERIMENT_ABANDONED_CREATING_SECONDS,
    DEFAULT_ABANDONED_CREATING_SECONDS,
  );
  const batchSize = configuredPositiveInteger(
    "EXPERIMENT_RETENTION_CLEANUP_BATCH_SIZE",
    environment.EXPERIMENT_RETENTION_CLEANUP_BATCH_SIZE,
    DEFAULT_CLEANUP_BATCH_SIZE,
  );
  if (batchSize > MAX_CLEANUP_BATCH_SIZE) {
    throw new Error(
      `EXPERIMENT_RETENTION_CLEANUP_BATCH_SIZE must not exceed ${MAX_CLEANUP_BATCH_SIZE}.`,
    );
  }

  return {
    terminalRetentionMs: durationFromSeconds(
      "EXPERIMENT_RETENTION_DAYS",
      retentionDays * 24 * 60 * 60,
    ),
    abandonedCreatingMs: durationFromSeconds(
      "EXPERIMENT_ABANDONED_CREATING_SECONDS",
      abandonedCreatingSeconds,
    ),
    batchSize,
  };
}

export async function cleanupExpiredExperimentRuns({
  database,
  configuration,
  now = Date.now(),
}: {
  database: RetentionDatabase;
  configuration: RetentionConfiguration;
  now?: number;
}) {
  // Each equality predicate uses idx_experiment_runs_status_created_at.
  await database
    .prepare(
      `DELETE FROM experiment_runs
       WHERE id IN (
         SELECT id FROM experiment_runs
          WHERE status = 'completed' AND created_at <= ?
         UNION ALL
         SELECT id FROM experiment_runs
          WHERE status = 'failed' AND created_at <= ?
         UNION ALL
         SELECT id FROM experiment_runs
          WHERE status = 'creating' AND created_at <= ?
         LIMIT ?
       )`,
    )
    .bind(
      now - configuration.terminalRetentionMs,
      now - configuration.terminalRetentionMs,
      now - configuration.abandonedCreatingMs,
      configuration.batchSize,
    )
    .run();
}
