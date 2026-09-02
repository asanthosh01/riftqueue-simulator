import { env } from "cloudflare:workers";
import { z } from "zod";

import {
  MATCHES_PER_RUN,
  RUN_COUNT,
  aggregateExperimentComparisons,
  runComparison,
  type ComparisonResult,
} from "@/lib/matchmaking";

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

function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, {
    ...init,
    headers: {
      "cache-control": "no-store",
      ...init?.headers,
    },
  });
}

export async function GET() {
  const rows = await env.DB.prepare(
    `SELECT id, created_at AS createdAt, status, population, traffic, policy,
            seed, runs, matches_per_run AS matchesPerRun, progress,
            duration_ms AS durationMs, error
       FROM experiment_runs
      ORDER BY created_at DESC
      LIMIT 8`,
  ).all();

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

  const id = crypto.randomUUID();
  const createdAt = Date.now();
  try {
    await env.DB.prepare(
      `INSERT INTO experiment_runs
        (id, created_at, status, population, traffic, policy, seed, runs,
         matches_per_run, progress)
       VALUES (?, ?, 'queued', ?, ?, ?, ?, ?, ?, 0)`,
    )
      .bind(
        id,
        createdAt,
        input.population,
        input.traffic,
        input.policy,
        input.seed,
        RUN_COUNT,
        MATCHES_PER_RUN,
      )
      .run();
  } catch (error) {
    console.error("Failed to create experiment run", error);
    return json(
      {
        error: "The experiment record could not be created.",
      },
      { status: 500 },
    );
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
