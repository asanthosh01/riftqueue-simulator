import { env } from "cloudflare:workers";

import { getExperimentRateLimitConfiguration } from "@/lib/experiment-rate-limit";
import {
  experimentOwnerKey,
  existingVisitorSession,
} from "@/lib/experiment-session";
import { privateJson } from "@/lib/experiment-api";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const sessionToken = existingVisitorSession(request);
  if (!sessionToken) {
    return privateJson({ error: "Experiment not found." }, { status: 404 });
  }

  let ownerKey: string;
  try {
    const configuration = getExperimentRateLimitConfiguration(env);
    ownerKey = await experimentOwnerKey(configuration.secret, sessionToken);
  } catch (error) {
    console.error("Failed to read experiment ownership state", error);
    return privateJson(
      { error: "Saved runs are temporarily unavailable." },
      { status: 503 },
    );
  }

  let row: Record<string, unknown> | null;
  try {
    row = await env.DB.prepare(
      `SELECT id, created_at AS createdAt, status, population, traffic, policy,
              seed, runs, matches_per_run AS matchesPerRun, progress,
              duration_ms AS durationMs, result_json AS resultJson,
              CASE WHEN error IS NULL THEN NULL ELSE 'The experiment failed.' END AS error
         FROM experiment_runs
        WHERE id = ? AND owner_key = ?`,
    )
      .bind(id, ownerKey)
      .first<Record<string, unknown>>();
  } catch (error) {
    console.error("Failed to load saved experiment", error);
    return privateJson({ error: "Saved runs are temporarily unavailable." }, { status: 503 });
  }

  if (!row) {
    return privateJson({ error: "Experiment not found." }, { status: 404 });
  }

  const { resultJson, ...summary } = row;
  try {
    return privateJson({
      ...summary,
      result: typeof resultJson === "string" ? JSON.parse(resultJson) : null,
    });
  } catch (error) {
    console.error("Failed to parse saved experiment", error);
    return privateJson({ error: "Saved run is unavailable." }, { status: 500 });
  }
}
