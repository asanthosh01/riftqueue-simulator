const DEFAULT_MAX_REQUESTS = 3;
const DEFAULT_WINDOW_SECONDS = 300;

type RateLimitDatabase = {
  prepare: (query: string) => {
    bind: (...values: unknown[]) => {
      first: <T>() => Promise<T | null>;
      run: () => Promise<unknown>;
    };
  };
};

type RateLimitEnvironment = {
  EXPERIMENT_RATE_LIMIT_MAX_REQUESTS?: string;
  EXPERIMENT_RATE_LIMIT_SECRET?: string;
  EXPERIMENT_RATE_LIMIT_WINDOW_SECONDS?: string;
};

type RateLimitConfiguration = {
  maxRequests: number;
  secret: string;
  windowMs: number;
};

type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

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

function toHex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export function getExperimentRateLimitConfiguration(
  environment: RateLimitEnvironment,
): RateLimitConfiguration {
  const secret = environment.EXPERIMENT_RATE_LIMIT_SECRET;
  if (!secret?.trim()) {
    throw new Error("EXPERIMENT_RATE_LIMIT_SECRET must be configured.");
  }

  const windowSeconds = configuredPositiveInteger(
    "EXPERIMENT_RATE_LIMIT_WINDOW_SECONDS",
    environment.EXPERIMENT_RATE_LIMIT_WINDOW_SECONDS,
    DEFAULT_WINDOW_SECONDS,
  );
  if (windowSeconds > Math.floor(Number.MAX_SAFE_INTEGER / 1_000)) {
    throw new Error("EXPERIMENT_RATE_LIMIT_WINDOW_SECONDS is too large.");
  }

  return {
    maxRequests: configuredPositiveInteger(
      "EXPERIMENT_RATE_LIMIT_MAX_REQUESTS",
      environment.EXPERIMENT_RATE_LIMIT_MAX_REQUESTS,
      DEFAULT_MAX_REQUESTS,
    ),
    secret,
    windowMs: windowSeconds * 1_000,
  };
}

async function clientBucketKey(request: Request, secret: string) {
  // Cloudflare supplies this canonical address header at the Worker boundary.
  const clientAddress = request.headers.get("cf-connecting-ip") ?? "unknown-client";
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toHex(
    await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(clientAddress),
    ),
  );
}

export async function experimentIdempotencyKey(
  request: Request,
  secret: string,
  idempotencyKey: string,
) {
  // Scope an opaque, client-supplied key to the Cloudflare client boundary.
  const clientAddress = request.headers.get("cf-connecting-ip") ?? "unknown-client";
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toHex(
    await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(`idempotency:${clientAddress}:${idempotencyKey}`),
    ),
  );
}

export async function takeExperimentRateLimitSlot({
  database,
  request,
  configuration,
  now = Date.now(),
}: {
  database: RateLimitDatabase;
  request: Request;
  configuration: RateLimitConfiguration;
  now?: number;
}): Promise<RateLimitResult> {
  const bucketKey = await clientBucketKey(request, configuration.secret);
  const expiredBefore = now - configuration.windowMs;
  await database
    .prepare(
      "DELETE FROM experiment_rate_limits WHERE window_started_at <= ?",
    )
    .bind(expiredBefore)
    .run();

  const row = await database
    .prepare(
      `INSERT INTO experiment_rate_limits (bucket_key, window_started_at, request_count)
       VALUES (?, ?, 1)
       ON CONFLICT(bucket_key) DO UPDATE SET
         window_started_at = CASE
           WHEN experiment_rate_limits.window_started_at <= ? THEN excluded.window_started_at
           ELSE experiment_rate_limits.window_started_at
         END,
         request_count = CASE
           WHEN experiment_rate_limits.window_started_at <= ? THEN 1
           ELSE experiment_rate_limits.request_count + 1
         END
       RETURNING window_started_at AS windowStartedAt, request_count AS requestCount`,
    )
    .bind(bucketKey, now, expiredBefore, expiredBefore)
    .first<{ requestCount: number; windowStartedAt: number }>();

  if (!row) {
    throw new Error("Rate limit state could not be recorded.");
  }

  if (row.requestCount <= configuration.maxRequests) {
    return { allowed: true };
  }

  return {
    allowed: false,
    retryAfterSeconds: Math.max(
      1,
      Math.ceil((row.windowStartedAt + configuration.windowMs - now) / 1_000),
    ),
  };
}
