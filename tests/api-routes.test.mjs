import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
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
const sessionSecret = "test-only-secret";
const visitorOneToken = "11111111-1111-4111-8111-111111111111";
const visitorTwoToken = "22222222-2222-4222-8222-222222222222";

function visitorCookie(token) {
  return `riftqueue_session=${token}`;
}

function ownerKey(token) {
  return createHmac("sha256", sessionSecret)
    .update(`owner:${token}`)
    .digest("hex");
}

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

function databaseWithRateLimit({ synchronizeInitialIdempotencyReads = false } = {}) {
  const database = new DatabaseSync(":memory:");
  let idempotencyReadCount = 0;
  let releaseIdempotencyReads;
  const idempotencyReadsReady = new Promise((resolve) => {
    releaseIdempotencyReads = resolve;
  });
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
    idempotency_key TEXT,
    owner_key TEXT,
    runs INTEGER NOT NULL,
    matches_per_run INTEGER NOT NULL,
    progress INTEGER NOT NULL,
    duration_ms REAL,
    result_json TEXT,
    error TEXT
  )`);
  database.exec("CREATE UNIQUE INDEX idx_experiment_runs_idempotency_key ON experiment_runs (idempotency_key)");

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
    experimentRuns() {
      return database
        .prepare(
          `SELECT id, created_at AS createdAt, status,
                  idempotency_key AS idempotencyKey, owner_key AS ownerKey
             FROM experiment_runs
            ORDER BY id`,
        )
        .all();
    },
    seedExperimentRun({
      id,
      status,
      createdAt,
      ownerKey: runOwnerKey = ownerKey(visitorOneToken),
      seed = 4817,
    }) {
      database
        .prepare(
          `INSERT INTO experiment_runs
            (id, created_at, status, population, traffic, policy, seed, owner_key, runs,
             matches_per_run, progress)
           VALUES (?, ?, ?, 75, 'late', 'balanced', ?, ?, 8, 500, 0)`,
        )
        .run(id, createdAt, status, seed, runOwnerKey);
    },
    seedCompletedRun({ id, ownerKey: runOwnerKey, seed }) {
      this.seedExperimentRun({
        id,
        status: "completed",
        createdAt: Date.now(),
        ownerKey: runOwnerKey,
        seed,
      });
      database
        .prepare(
          "UPDATE experiment_runs SET progress = 100, result_json = ? WHERE id = ?",
        )
        .run(JSON.stringify(savedComparison), id);
    },
    prepare(query) {
      return {
        bind(...values) {
          return {
            async first() {
              if (
                synchronizeInitialIdempotencyReads &&
                /FROM experiment_runs\s+WHERE idempotency_key/.test(query) &&
                idempotencyReadCount < 2
              ) {
                idempotencyReadCount += 1;
                if (idempotencyReadCount === 2) releaseIdempotencyReads();
                await idempotencyReadsReady;
              }
              return database.prepare(query).get(...values) ?? null;
            },
            async all() {
              return { results: database.prepare(query).all(...values) };
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
    {
      environment: { EXPERIMENT_RATE_LIMIT_SECRET: sessionSecret },
      request: { headers: { cookie: visitorCookie(visitorOneToken) } },
    },
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
    {
      environment: { EXPERIMENT_RATE_LIMIT_SECRET: sessionSecret },
      request: { headers: { cookie: visitorCookie(visitorOneToken) } },
    },
  );

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /text\/csv/);
  const body = await response.text();
  assert.match(body, /algorithm,population,traffic,policy/);
  assert.match(body, /"tail-aware","75","late","balanced"/);
});

test("initializes an anonymous session before creating a run or using quota", async () => {
  const database = databaseWithRateLimit();
  const response = await fetchWorker("/api/experiments", {
    database,
    environment: { EXPERIMENT_RATE_LIMIT_SECRET: sessionSecret },
    request: {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "anonymous-session-test-key-0001",
      },
      body: JSON.stringify({
        population: 75,
        traffic: "late",
        policy: "balanced",
        seed: 4817,
      }),
    },
  });

  assert.equal(response.status, 428);
  assert.equal(response.headers.get("x-riftqueue-session-initialized"), "true");
  const setCookie = response.headers.get("set-cookie") ?? "";
  assert.match(setCookie, /^riftqueue_session=[0-9a-f-]+; Path=\//i);
  assert.match(setCookie, /HttpOnly; SameSite=Lax/);
  assert.doesNotMatch(setCookie, /; Secure/);
  assert.deepEqual(await response.json(), {
    error: "Anonymous session initialized. Retry this request.",
  });
  assert.equal(database.experimentRuns().length, 0);
  assert.equal(database.rateLimitRows().length, 0);
});

test("retries an initialized session with one stored ownership digest", async () => {
  const database = databaseWithRateLimit();
  const request = {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": "anonymous-session-test-key-0001",
    },
    body: JSON.stringify({
      population: 75,
      traffic: "late",
      policy: "balanced",
      seed: 4817,
    }),
  };
  const options = {
    database,
    environment: { EXPERIMENT_RATE_LIMIT_SECRET: sessionSecret },
    request,
  };

  const initialized = await fetchWorker("/api/experiments", options);
  assert.equal(initialized.status, 428);
  const sessionToken = initialized.headers
    .get("set-cookie")
    ?.match(/^riftqueue_session=([^;]+)/)?.[1];
  assert.ok(sessionToken);
  await initialized.body?.cancel();

  const created = await fetchWorker("/api/experiments", {
    ...options,
    request: {
      ...request,
      headers: { ...request.headers, cookie: visitorCookie(sessionToken) },
    },
  });
  assert.equal(created.status, 200);
  assert.equal(database.experimentRuns().length, 1);
  assert.equal(database.rateLimitRows()[0].requestCount, 1);
  assert.match(database.experimentRuns()[0].ownerKey, /^[a-f0-9]{64}$/);
  assert.doesNotMatch(database.experimentRuns()[0].ownerKey, new RegExp(sessionToken));
  await created.body?.cancel();
});

test("concurrent first-visit requests only initialize sessions", async () => {
  const database = databaseWithRateLimit();
  const request = {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": "concurrent-session-init-key-0001",
    },
    body: JSON.stringify({
      population: 75,
      traffic: "late",
      policy: "balanced",
      seed: 4817,
    }),
  };

  const responses = await Promise.all([
    fetchWorker("/api/experiments", {
      database,
      environment: { EXPERIMENT_RATE_LIMIT_SECRET: sessionSecret },
      request,
    }),
    fetchWorker("/api/experiments", {
      database,
      environment: { EXPERIMENT_RATE_LIMIT_SECRET: sessionSecret },
      request,
    }),
  ]);

  assert.deepEqual(responses.map((response) => response.status), [428, 428]);
  assert.equal(database.experimentRuns().length, 0);
  assert.equal(database.rateLimitRows().length, 0);
  await Promise.all(responses.map((response) => response.body?.cancel()));
});

test("scopes idempotency keys to anonymous sessions rather than network addresses", async () => {
  const database = databaseWithRateLimit();
  const environment = {
    EXPERIMENT_RATE_LIMIT_SECRET: sessionSecret,
    EXPERIMENT_RATE_LIMIT_MAX_REQUESTS: "3",
  };
  const request = {
    method: "POST",
    headers: {
      "cf-connecting-ip": "203.0.113.42",
      "content-type": "application/json",
      "idempotency-key": "shared-idempotency-value-0001",
    },
    body: JSON.stringify({
      population: 75,
      traffic: "late",
      policy: "balanced",
      seed: 4817,
    }),
  };

  const visitorOneResponse = await fetchWorker("/api/experiments", {
    database,
    environment,
    request: {
      ...request,
      headers: { ...request.headers, cookie: visitorCookie(visitorOneToken) },
    },
  });
  const visitorTwoResponse = await fetchWorker("/api/experiments", {
    database,
    environment,
    request: {
      ...request,
      headers: { ...request.headers, cookie: visitorCookie(visitorTwoToken) },
    },
  });

  assert.equal(visitorOneResponse.status, 200);
  assert.equal(visitorTwoResponse.status, 200);
  assert.equal(database.experimentRuns().length, 2);
  await visitorOneResponse.body?.cancel();
  await visitorTwoResponse.body?.cancel();
});

test("isolates anonymous visitors from other saved-run histories and exports", async () => {
  const database = databaseWithRateLimit();
  database.seedCompletedRun({
    id: "visitor-one-run",
    ownerKey: ownerKey(visitorOneToken),
    seed: 4817,
  });
  database.seedCompletedRun({
    id: "visitor-two-run",
    ownerKey: ownerKey(visitorTwoToken),
    seed: 9264,
  });
  const environment = { EXPERIMENT_RATE_LIMIT_SECRET: sessionSecret };
  const visitorOne = { headers: { cookie: visitorCookie(visitorOneToken) } };
  const visitorTwo = { headers: { cookie: visitorCookie(visitorTwoToken) } };

  const visitorOneHistory = await fetchWorker("/api/experiments", {
    database,
    environment,
    request: visitorOne,
  });
  assert.deepEqual(
    (await visitorOneHistory.json()).runs.map((run) => run.id),
    ["visitor-one-run"],
  );

  const visitorTwoHistory = await fetchWorker("/api/experiments", {
    database,
    environment,
    request: visitorTwo,
  });
  assert.deepEqual(
    (await visitorTwoHistory.json()).runs.map((run) => run.id),
    ["visitor-two-run"],
  );

  const ownRun = await fetchWorker("/api/experiments/visitor-one-run", {
    database,
    environment,
    request: visitorOne,
  });
  assert.equal(ownRun.status, 200);

  const otherRun = await fetchWorker("/api/experiments/visitor-one-run", {
    database,
    environment,
    request: visitorTwo,
  });
  assert.equal(otherRun.status, 404);

  const ownExport = await fetchWorker(
    "/api/experiments/visitor-one-run/download?format=json",
    { database, environment, request: visitorOne },
  );
  assert.equal(ownExport.status, 200);

  const otherExport = await fetchWorker(
    "/api/experiments/visitor-one-run/download?format=json",
    { database, environment, request: visitorTwo },
  );
  assert.equal(otherExport.status, 404);
});

test("retains recent records, removes expired terminal records, and clears abandoned creation", async () => {
  const database = databaseWithRateLimit();
  const day = 24 * 60 * 60 * 1_000;
  const now = 40 * day;
  database.seedExperimentRun({
    id: "recent-completed",
    status: "completed",
    createdAt: now - day + 1,
  });
  database.seedExperimentRun({
    id: "recent-failed",
    status: "failed",
    createdAt: now - day + 1,
  });
  database.seedExperimentRun({
    id: "expired-completed",
    status: "completed",
    createdAt: now - day,
  });
  database.seedExperimentRun({
    id: "expired-failed",
    status: "failed",
    createdAt: now - day,
  });
  database.seedExperimentRun({
    id: "abandoned-creating",
    status: "creating",
    createdAt: now - 15 * 60 * 1_000,
  });
  database.seedExperimentRun({
    id: "fresh-creating",
    status: "creating",
    createdAt: now - 15 * 60 * 1_000 + 1,
  });
  database.seedExperimentRun({
    id: "old-queued",
    status: "queued",
    createdAt: now - 90 * day,
  });
  database.seedExperimentRun({
    id: "old-running",
    status: "running",
    createdAt: now - 90 * day,
  });

  const originalDateNow = Date.now;
  Date.now = () => now;
  try {
    const response = await fetchWorker("/api/experiments", {
      database,
      environment: {
        EXPERIMENT_RATE_LIMIT_SECRET: sessionSecret,
        EXPERIMENT_RETENTION_DAYS: "1",
        EXPERIMENT_ABANDONED_CREATING_SECONDS: "900",
        EXPERIMENT_RETENTION_CLEANUP_BATCH_SIZE: "10",
      },
      request: {
        method: "POST",
        headers: {
          cookie: visitorCookie(visitorOneToken),
          "content-type": "application/json",
          "idempotency-key": "retention-eligibility-test-key",
        },
        body: JSON.stringify({
          population: 75,
          traffic: "late",
          policy: "balanced",
          seed: 4817,
        }),
      },
    });
    assert.equal(response.status, 200);
    await response.body?.cancel();
  } finally {
    Date.now = originalDateNow;
  }

  const remainingIds = database.experimentRuns().map((run) => run.id);
  for (const id of [
    "fresh-creating",
    "old-queued",
    "old-running",
    "recent-completed",
    "recent-failed",
  ]) {
    assert.ok(remainingIds.includes(id));
  }
  assert.ok(!remainingIds.includes("expired-completed"));
  assert.ok(!remainingIds.includes("expired-failed"));
  assert.ok(!remainingIds.includes("abandoned-creating"));
  assert.equal(remainingIds.length, 6);
});

test("limits each experiment retention cleanup to its configured batch size", async () => {
  const database = databaseWithRateLimit();
  const day = 24 * 60 * 60 * 1_000;
  const now = 40 * day;
  for (const id of ["expired-one", "expired-two", "expired-three"]) {
    database.seedExperimentRun({
      id,
      status: "completed",
      createdAt: now - day,
    });
  }

  const originalDateNow = Date.now;
  Date.now = () => now;
  try {
    const response = await fetchWorker("/api/experiments", {
      database,
      environment: {
        EXPERIMENT_RATE_LIMIT_SECRET: sessionSecret,
        EXPERIMENT_RETENTION_DAYS: "1",
        EXPERIMENT_RETENTION_CLEANUP_BATCH_SIZE: "2",
      },
      request: {
        method: "POST",
        headers: {
          cookie: visitorCookie(visitorOneToken),
          "content-type": "application/json",
          "idempotency-key": "retention-batch-limit-test-key",
        },
        body: JSON.stringify({
          population: 75,
          traffic: "late",
          policy: "balanced",
          seed: 4817,
        }),
      },
    });
    assert.equal(response.status, 200);
    await response.body?.cancel();
  } finally {
    Date.now = originalDateNow;
  }

  assert.equal(
    database.experimentRuns().filter((run) => run.id.startsWith("expired-")).length,
    1,
  );
});

test("rate limits repeated experiment creation without storing a raw address", async () => {
  const database = databaseWithRateLimit();
  database.seedExpiredRateLimit("expired-bucket", 939_999);
  const request = {
    method: "POST",
    headers: {
      "cf-connecting-ip": "203.0.113.42",
      "content-type": "application/json",
      cookie: visitorCookie(visitorOneToken),
      "idempotency-key": "rate-limit-test-key-0001",
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
      request: {
        ...request,
        headers: {
          ...request.headers,
          "idempotency-key": "rate-limit-test-key-0002",
        },
      },
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

test("reuses an idempotent experiment request without storing the supplied key", async () => {
  const database = databaseWithRateLimit();
  const request = {
    method: "POST",
    headers: {
      "cf-connecting-ip": "203.0.113.42",
      "content-type": "application/json",
      cookie: visitorCookie(visitorOneToken),
      "idempotency-key": "idempotency-replay-key-0001",
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

  const created = await fetchWorker("/api/experiments", {
    database,
    environment,
    request,
  });
  assert.equal(created.status, 200);
  await created.body?.cancel();

  const replayed = await fetchWorker("/api/experiments", {
    database,
    environment,
    request,
  });
  assert.equal(replayed.status, 202);
  assert.equal(replayed.headers.get("idempotency-replayed"), "true");
  const reused = await replayed.json();
  assert.equal(reused.reused, true);
  assert.equal(reused.id, database.experimentRuns()[0].id);
  assert.equal(database.experimentRuns().length, 1);
  assert.match(database.experimentRuns()[0].idempotencyKey, /^[a-f0-9]{64}$/);
  assert.doesNotMatch(database.experimentRuns()[0].idempotencyKey, /replay-key/);
  assert.equal(database.rateLimitRows()[0].requestCount, 1);

  const conflicting = await fetchWorker("/api/experiments", {
    database,
    environment,
    request: {
      ...request,
      body: JSON.stringify({
        population: 50,
        traffic: "late",
        policy: "balanced",
        seed: 4817,
      }),
    },
  });
  assert.equal(conflicting.status, 409);
  assert.deepEqual(await conflicting.json(), {
    error: "This Idempotency-Key is already associated with a different experiment.",
  });
});

test("concurrent duplicate experiment requests reuse one reservation and rate-limit slot", async () => {
  const database = databaseWithRateLimit({ synchronizeInitialIdempotencyReads: true });
  const request = {
    method: "POST",
    headers: {
      "cf-connecting-ip": "203.0.113.42",
      "content-type": "application/json",
      cookie: visitorCookie(visitorOneToken),
      "idempotency-key": "concurrent-idempotency-key-0001",
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

  const [first, second] = await Promise.all([
    fetchWorker("/api/experiments", { database, environment, request }),
    fetchWorker("/api/experiments", { database, environment, request }),
  ]);
  const responses = [first, second];
  assert.deepEqual(responses.map((response) => response.status).sort(), [200, 202]);

  const replay = responses.find((response) => response.status === 202);
  assert.ok(replay);
  assert.equal(replay.headers.get("idempotency-replayed"), "true");
  const replayedRun = await replay.json();
  assert.equal(replayedRun.id, database.experimentRuns()[0].id);
  assert.equal(database.experimentRuns().length, 1);
  assert.equal(database.rateLimitRows()[0].requestCount, 1);

  const stream = responses.find((response) => response.status === 200);
  await stream?.body?.cancel();
});

test("requires a valid idempotency key before creating an experiment", async () => {
  const response = await fetchWorker("/api/experiments", {
    database: databaseWithRateLimit(),
    environment: { EXPERIMENT_RATE_LIMIT_SECRET: "test-only-secret" },
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

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: "Send an Idempotency-Key with 16 to 128 letters, numbers, dots, underscores, or hyphens.",
  });
});

test("fails closed when rate-limit configuration is invalid", async () => {
  const response = await fetchWorker("/api/experiments", {
    environment: {
      EXPERIMENT_RATE_LIMIT_SECRET: "test-only-secret",
      EXPERIMENT_RATE_LIMIT_MAX_REQUESTS: "0",
    },
    request: {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "invalid-rate-limit-test-key",
      },
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

test("fails closed when retention configuration is invalid", async () => {
  const database = databaseWithRateLimit();
  const response = await fetchWorker("/api/experiments", {
    database,
    environment: {
      EXPERIMENT_RATE_LIMIT_SECRET: "test-only-secret",
      EXPERIMENT_RETENTION_CLEANUP_BATCH_SIZE: "501",
    },
    request: {
      method: "POST",
      headers: {
        cookie: visitorCookie(visitorOneToken),
        "content-type": "application/json",
        "idempotency-key": "invalid-retention-test-key",
      },
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
  assert.equal(database.experimentRuns().length, 0);
  assert.equal(database.rateLimitRows().length, 0);
});
