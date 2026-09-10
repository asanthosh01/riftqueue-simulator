import { env } from "cloudflare:workers";
import { z } from "zod";

import {
  MATCHES_PER_RUN,
  RUN_COUNT,
  aggregateExperimentComparisons,
  runComparison,
  type ComparisonResult,
} from "@/lib/matchmaking";
import {
  experimentIdempotencyKey,
  getExperimentRateLimitConfiguration,
  takeExperimentRateLimitSlot,
} from "@/lib/experiment-rate-limit";
import {
  experimentOwnerKey,
  existingVisitorSession,
  visitorSession,
} from "@/lib/experiment-session";
import {
  cleanupExpiredExperimentRuns,
  getExperimentRetentionConfiguration,
} from "@/lib/experiment-retention";

const experimentRequest = z.object({
  population: z.union([
    z.literal(25),
    z.literal(50),
    z.literal(75),
    z.literal(100),
  ]),
  traffic: z.enum(["peak", "late", "overnight"]),
  policy: z.enum(["fast", "balanced", "integrity"]),
  seed: z.number().int().nonnegative().max(2_147_483_647),
});
const idempotencyKeyPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{15,127}$/;

type ExistingIdempotentRun = z.infer<typeof experimentRequest> & {
  id: string;
  status: "creating" | "queued" | "running" | "completed" | "failed";
  progress: number;
};

function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, {
    ...init,
    headers: {
      "cache-control": "no-store",
      ...init?.headers,
    },
  });
}

async function existingIdempotentRun(idempotencyKey: string, ownerKey: string) {
  return env.DB.prepare(
    `SELECT id, status, progress, population, traffic, policy, seed
       FROM experiment_runs
      WHERE idempotency_key = ? AND owner_key = ?`,
  )
    .bind(idempotencyKey, ownerKey)
    .first<ExistingIdempotentRun>();
}

function matchesExperiment(
  existing: ExistingIdempotentRun,
  input: z.infer<typeof experimentRequest>,
) {
  return existing.population === input.population &&
    existing.traffic === input.traffic &&
    existing.policy === input.policy &&
    existing.seed === input.seed;
}

function idempotentRunResponse(existing: ExistingIdempotentRun) {
  return json(
    {
      id: existing.id,
      status: existing.status,
      progress: existing.progress,
      reused: true,
    },
    {
      status: 202,
      headers: { "idempotency-replayed": "true" },
    },
  );
}

async function discardCreatingRun(id: string) {
  await env.DB.prepare(
    "DELETE FROM experiment_runs WHERE id = ? AND status = 'creating'",
  )
    .bind(id)
    .run();
}

export async function GET(request: Request) {
  const sessionToken = existingVisitorSession(request);
  if (!sessionToken) return json({ runs: [] });

  let ownerKey: string;
  try {
    const configuration = getExperimentRateLimitConfiguration(env);
    ownerKey = await experimentOwnerKey(configuration.secret, sessionToken);
  } catch (error) {
    console.error("Failed to read experiment ownership state", error);
    return json(
      { error: "Saved runs are temporarily unavailable." },
      { status: 503 },
    );
  }

  const rows = await env.DB.prepare(
    `SELECT id, created_at AS createdAt, status, population, traffic, policy,
            seed, runs, matches_per_run AS matchesPerRun, progress,
            duration_ms AS durationMs, error
       FROM experiment_runs
      WHERE owner_key = ?
      ORDER BY created_at DESC
      LIMIT 8`,
  )
    .bind(ownerKey)
    .all();

  return json({ runs: rows.results });
}

export async function POST(request: Request) {
  let input: z.infer<typeof experimentRequest>;
  try {
    input = experimentRequest.parse(await request.json());
  } catch (error) {
    return json(
      {
        error:
          error instanceof z.ZodError
            ? "Choose a supported population, traffic level, policy, and seed."
            : "The experiment request was not valid JSON.",
      },
      { status: 400 },
    );
  }

  const suppliedIdempotencyKey = request.headers.get("idempotency-key")?.trim();
  if (!suppliedIdempotencyKey || !idempotencyKeyPattern.test(suppliedIdempotencyKey)) {
    return json(
      {
        error: "Send an Idempotency-Key with 16 to 128 letters, numbers, dots, underscores, or hyphens.",
      },
      { status: 400 },
    );
  }

  let rateLimitConfiguration;
  try {
    rateLimitConfiguration = getExperimentRateLimitConfiguration(env);
  } catch (error) {
    console.error("Invalid experiment rate limit configuration", error);
    return json(
      { error: "Experiment creation is temporarily unavailable." },
      { status: 503 },
    );
  }

  const sessionToken = existingVisitorSession(request);
  if (!sessionToken) {
    const session = visitorSession(request);
    return json(
      { error: "Anonymous session initialized. Retry this request." },
      {
        status: 428,
        headers: {
          "set-cookie": session.setCookie ?? "",
          "x-riftqueue-session-initialized": "true",
        },
      },
    );
  }

  try {
    await cleanupExpiredExperimentRuns({
      database: env.DB,
      configuration: getExperimentRetentionConfiguration(env),
    });
  } catch (error) {
    console.error("Failed to clean up expired experiment runs", error);
    return json(
      { error: "Experiment creation is temporarily unavailable." },
      { status: 503 },
    );
  }

  let ownerKey: string;
  try {
    ownerKey = await experimentOwnerKey(rateLimitConfiguration.secret, sessionToken);
  } catch (error) {
    console.error("Failed to derive experiment ownership state", error);
    return json(
      { error: "Experiment creation is temporarily unavailable." },
      { status: 503 },
    );
  }

  let idempotencyKey: string;
  try {
    idempotencyKey = await experimentIdempotencyKey(
      rateLimitConfiguration.secret,
      ownerKey,
      suppliedIdempotencyKey,
    );
    const existing = await existingIdempotentRun(idempotencyKey, ownerKey);
    if (existing) {
      if (!matchesExperiment(existing, input)) {
        return json(
          { error: "This Idempotency-Key is already associated with a different experiment." },
          { status: 409 },
        );
      }
      return idempotentRunResponse(existing);
    }
  } catch (error) {
    console.error("Failed to read experiment idempotency state", error);
    return json(
      { error: "Experiment creation is temporarily unavailable." },
      { status: 503 },
    );
  }

  const id = crypto.randomUUID();
  const createdAt = Date.now();
  try {
    const inserted = await env.DB.prepare(
      `INSERT INTO experiment_runs
        (id, created_at, status, population, traffic, policy, seed, idempotency_key, owner_key, runs,
         matches_per_run, progress)
       VALUES (?, ?, 'creating', ?, ?, ?, ?, ?, ?, ?, ?, 0)
       ON CONFLICT(idempotency_key) DO NOTHING
       RETURNING id`,
    )
      .bind(
        id,
        createdAt,
        input.population,
        input.traffic,
        input.policy,
        input.seed,
        idempotencyKey,
        ownerKey,
        RUN_COUNT,
        MATCHES_PER_RUN,
      )
      .first<{ id: string }>();

    if (!inserted) {
      const existing = await existingIdempotentRun(idempotencyKey, ownerKey);
      if (existing && matchesExperiment(existing, input)) {
        return idempotentRunResponse(existing);
      }
      if (existing) {
        return json(
          { error: "This Idempotency-Key is already associated with a different experiment." },
          { status: 409 },
        );
      }
      throw new Error("The idempotency record could not be read.");
    }
  } catch (error) {
    console.error("Failed to create experiment run", error);
    return json(
      {
        error: "The experiment record could not be created.",
      },
      { status: 500 },
    );
  }

  try {
    const rateLimit = await takeExperimentRateLimitSlot({
      database: env.DB,
      request,
      configuration: rateLimitConfiguration,
    });
    if (!rateLimit.allowed) {
      await discardCreatingRun(id);
      return json(
        { error: "Too many experiment requests. Try again later." },
        {
          status: 429,
          headers: { "retry-after": String(rateLimit.retryAfterSeconds) },
        },
      );
    }
  } catch (error) {
    console.error("Failed to apply experiment rate limit", error);
    try {
      await discardCreatingRun(id);
    } catch (cleanupError) {
      console.error("Failed to discard pending experiment run", cleanupError);
    }
    return json(
      { error: "Experiment creation is temporarily unavailable." },
      { status: 503 },
    );
  }

  try {
    await env.DB.prepare(
      "UPDATE experiment_runs SET status = 'queued' WHERE id = ? AND status = 'creating'",
    )
      .bind(id)
      .run();
  } catch (error) {
    console.error("Failed to activate experiment run", error);
    try {
      await discardCreatingRun(id);
    } catch (cleanupError) {
      console.error("Failed to discard pending experiment run", cleanupError);
    }
    return json(
      { error: "The experiment record could not be created." }, { status: 500 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: unknown) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };
      const startedAt = performance.now();
      const comparisons: ComparisonResult[] = [];

      try {
        await env.DB.prepare(
          "UPDATE experiment_runs SET status = 'running', progress = 1 WHERE id = ?",
        )
          .bind(id)
          .run();
        send({ type: "started", id, progress: 1, totalRuns: RUN_COUNT });

        for (let run = 0; run < RUN_COUNT; run += 1) {
          comparisons.push(
            runComparison({
              ...input,
              seed: input.seed + run * 7_919,
              targetMatches: MATCHES_PER_RUN,
            }),
          );

          const progress = Math.round(((run + 1) / RUN_COUNT) * 90);
          await env.DB.prepare(
            "UPDATE experiment_runs SET progress = ? WHERE id = ?",
          )
            .bind(progress, id)
            .run();
          send({
            type: "progress",
            id,
            progress,
            completedRuns: run + 1,
            totalRuns: RUN_COUNT,
          });

          await new Promise((resolve) => setTimeout(resolve, 0));
        }

        const result = aggregateExperimentComparisons(comparisons);
        const durationMs = performance.now() - startedAt;
        await env.DB.prepare(
          `UPDATE experiment_runs
              SET status = 'completed', progress = 100, duration_ms = ?, result_json = ?
            WHERE id = ?`,
        )
          .bind(durationMs, JSON.stringify(result), id)
          .run();

        send({ type: "completed", id, progress: 100, durationMs, result });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "The experiment failed.";
        await env.DB.prepare(
          "UPDATE experiment_runs SET status = 'failed', error = ? WHERE id = ?",
        )
          .bind(message, id)
          .run();
        send({ type: "failed", id, message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "cache-control": "no-store",
      "content-type": "application/x-ndjson; charset=utf-8",
      "x-content-type-options": "nosniff",
    },
  });
}
