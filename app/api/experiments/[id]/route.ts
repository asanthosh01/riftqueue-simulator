import { env } from "cloudflare:workers";

import { getExperimentRateLimitConfiguration } from "@/lib/experiment-rate-limit";
import {
  experimentOwnerKey,
  existingVisitorSession,
} from "@/lib/experiment-session";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const sessionToken = existingVisitorSession(request);
  if (!sessionToken) {
    return Response.json({ error: "Experiment not found." }, { status: 404 });
  }

  let ownerKey: string;
  try {
    const configuration = getExperimentRateLimitConfiguration(env);
    ownerKey = await experimentOwnerKey(configuration.secret, sessionToken);
  } catch (error) {
    console.error("Failed to read experiment ownership state", error);
    return Response.json(
      { error: "Saved runs are temporarily unavailable." },
      { status: 503 },
    );
  }

  const row = await env.DB.prepare(
    `SELECT id, created_at AS createdAt, status, population, traffic, policy,
            seed, runs, matches_per_run AS matchesPerRun, progress,
            duration_ms AS durationMs, result_json AS resultJson, error
       FROM experiment_runs
      WHERE id = ? AND owner_key = ?`,
  )
    .bind(id, ownerKey)
    .first<Record<string, unknown>>();

  if (!row) {
    return Response.json({ error: "Experiment not found." }, { status: 404 });
  }

  const { resultJson, ...summary } = row;
  return Response.json(
    {
      ...summary,
      result: typeof resultJson === "string" ? JSON.parse(resultJson) : null,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
