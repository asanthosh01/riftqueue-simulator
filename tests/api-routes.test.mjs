import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

process.__riftqueueCloudflareEnv = {};
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "cloudflare:workers") {
      return {
        shortCircuit: true,
        url: "data:text/javascript,export%20const%20env%20%3D%20process.__riftqueueCloudflareEnv%3B",
      };
    }
    return nextResolve(specifier, context);
  },
});

const savedComparison = {
  baseline: {
    algorithm: "baseline",
    queueSeconds: 48,
    p95QueueSeconds: 120,
    spread: 280,
    teamGap: 14,
    badMatchRate: 40,
    matchesSimulated: 4000,
  },
  adaptive: {
    algorithm: "tail-aware",
    queueSeconds: 57,
    p95QueueSeconds: 140,
    spread: 230,
    teamGap: 1,
    badMatchRate: 20,
    matchesSimulated: 4000,
  },
};

function databaseWithCompletedRun() {
  return {
    prepare() {
      return {
        bind() {
          return {
            async first() {
              return {
                id: "saved-run",
                population: 75,
                traffic: "late",
                policy: "balanced",
                seed: 4817,
                resultJson: JSON.stringify(savedComparison),
              };
            },
          };
        },
      };
    },
  };
}

async function fetchWorker(pathname, options = {}) {
  for (const key of Object.keys(process.__riftqueueCloudflareEnv)) {
    delete process.__riftqueueCloudflareEnv[key];
  }
  Object.assign(process.__riftqueueCloudflareEnv, {
    DB: options.database ?? databaseWithCompletedRun(),
    ...options.environment,
  });
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${pathname}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${pathname}`, options.request),
    {
      DB: process.__riftqueueCloudflareEnv.DB,
      ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
    },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

function databaseWithRateLimit() {
  const database = new DatabaseSync(":memory:");
  database.exec(`CREATE TABLE experiment_rate_limits (
    bucket_key TEXT PRIMARY KEY NOT NULL,
    window_started_at INTEGER NOT NULL,
    request_count INTEGER NOT NULL
  )`);
  database.exec(`CREATE TABLE experiment_runs (
    id TEXT PRIMARY KEY NOT NULL,
    created_at INTEGER NOT NULL,
    status TEXT NOT NULL,
    population INTEGER NOT NULL,
    traffic TEXT NOT NULL,
    policy TEXT NOT NULL,
    seed INTEGER NOT NULL,
    runs INTEGER NOT NULL,
    matches_per_run INTEGER NOT NULL,
    progress INTEGER NOT NULL,
    duration_ms REAL,
    result_json TEXT,
    error TEXT
  )`);

  return {
    rateLimitRows() {
      return database
        .prepare(
          "SELECT bucket_key AS bucketKey, window_started_at AS windowStartedAt, request_count AS requestCount FROM experiment_rate_limits",
        )
        .all();
    },
    seedExpiredRateLimit(bucketKey, windowStartedAt) {
      database
        .prepare(
          "INSERT INTO experiment_rate_limits (bucket_key, window_started_at, request_count) VALUES (?, ?, 1)",
        )
        .run(bucketKey, windowStartedAt);
    },
    prepare(query) {
      return {
        bind(...values) {
          return {
            async first() {
              return database.prepare(query).get(...values) ?? null;
            },
            async run() {
              database.prepare(query).run(...values);
              return {};
            },
          };
        },
      };
    },
  };
}

test("downloads a saved experiment as JSON", async () => {
  const response = await fetchWorker(
    "/api/experiments/saved-run/download?format=json",
  );

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /application\/json/);
  assert.match(
    response.headers.get("content-disposition") ?? "",
    /attachment; filename="riftqueue-4817\.json"/,
  );
  const body = await response.json();
  assert.equal(body.scenario.population, 75);
  assert.equal(body.comparison.adaptive.badMatchRate, 20);
});

test("downloads a saved experiment as CSV", async () => {
  const response = await fetchWorker(
    "/api/experiments/saved-run/download?format=csv",
  );

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /text\/csv/);
  const body = await response.text();
  assert.match(body, /algorithm,population,traffic,policy/);
  assert.match(body, /"tail-aware","75","late","balanced"/);
});

test("rate limits repeated experiment creation without storing a raw address", async () => {
  const database = databaseWithRateLimit();
  database.seedExpiredRateLimit("expired-bucket", 939_999);
  const request = {
    method: "POST",
    headers: {
      "cf-connecting-ip": "203.0.113.42",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      population: 75,
      traffic: "late",
      policy: "balanced",
      seed: 4817,
    }),
  };
  const environment = {
    EXPERIMENT_RATE_LIMIT_SECRET: "test-only-secret",
    EXPERIMENT_RATE_LIMIT_MAX_REQUESTS: "1",
    EXPERIMENT_RATE_LIMIT_WINDOW_SECONDS: "60",
  };
  const originalDateNow = Date.now;
  Date.now = () => 1_000_000;

  try {
    const allowed = await fetchWorker("/api/experiments", {
      database,
      environment,
      request,
    });
    assert.equal(allowed.status, 200);
    await allowed.body?.cancel();

    const rejected = await fetchWorker("/api/experiments", {
      database,
      environment,
      request,
    });
    assert.equal(rejected.status, 429);
    assert.equal(rejected.headers.get("retry-after"), "60");
    assert.deepEqual(await rejected.json(), {
      error: "Too many experiment requests. Try again later.",
    });

    const [bucket] = database.rateLimitRows();
    const { bucketKey } = bucket;
    assert.match(bucketKey, /^[a-f0-9]{64}$/);
    assert.doesNotMatch(bucketKey, /203\.0\.113\.42/);
    assert.equal(bucket.windowStartedAt, 1_000_000);
    assert.equal(bucket.requestCount, 2);
  } finally {
    Date.now = originalDateNow;
  }
});

test("fails closed when rate-limit configuration is invalid", async () => {
  const response = await fetchWorker("/api/experiments", {
    environment: {
      EXPERIMENT_RATE_LIMIT_SECRET: "test-only-secret",
      EXPERIMENT_RATE_LIMIT_MAX_REQUESTS: "0",
    },
    request: {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        population: 75,
        traffic: "late",
        policy: "balanced",
        seed: 4817,
      }),
    },
  });

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    error: "Experiment creation is temporarily unavailable.",
  });
});
