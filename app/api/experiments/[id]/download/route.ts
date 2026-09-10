import { env } from "cloudflare:workers";

import { getExperimentRateLimitConfiguration } from "@/lib/experiment-rate-limit";
import {
  experimentOwnerKey,
  existingVisitorSession,
} from "@/lib/experiment-session";
import type { ExperimentComparison, Policy, Traffic } from "@/lib/matchmaking";

function csvCell(value: string | number) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const format = new URL(request.url).searchParams.get("format");
  if (format !== "json" && format !== "csv") {
    return Response.json(
      { error: "Choose JSON or CSV." },
      { status: 400 },
    );
  }

  const sessionToken = existingVisitorSession(request);
  if (!sessionToken) {
    return Response.json({ error: "Completed experiment not found." }, { status: 404 });
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
    `SELECT id, population, traffic, policy, seed, result_json AS resultJson
       FROM experiment_runs
      WHERE id = ? AND owner_key = ? AND status = 'completed'`,
  )
    .bind(id, ownerKey)
    .first<{
      id: string;
      population: number;
      traffic: Traffic;
      policy: Policy;
      seed: number;
      resultJson: string;
    }>();

  if (!row?.resultJson) {
    return Response.json({ error: "Completed experiment not found." }, { status: 404 });
  }

  const comparison = JSON.parse(row.resultJson) as ExperimentComparison;
  const filename = `riftqueue-${row.seed}.${format}`;
  if (format === "json") {
    return new Response(
      JSON.stringify(
        {
          id: row.id,
          scenario: {
            population: row.population,
            traffic: row.traffic,
            policy: row.policy,
            seed: row.seed,
          },
          comparison,
        },
        null,
        2,
      ),
      {
        headers: {
          "content-disposition": `attachment; filename="${filename}"`,
          "content-type": "application/json; charset=utf-8",
          "x-content-type-options": "nosniff",
        },
      },
    );
  }

  const header = [
    "algorithm",
    "population",
    "traffic",
    "policy",
    "seed",
    "median_queue_seconds",
    "p95_queue_seconds",
    "lobby_spread_mmr",
    "team_gap_mmr",
    "bad_match_rate_percent",
    "matches_simulated",
  ].join(",");
  const rows = [comparison.baseline, comparison.adaptive].map((run) =>
    [
      run.algorithm,
      row.population,
      row.traffic,
      row.policy,
      row.seed,
      run.queueSeconds,
      run.p95QueueSeconds,
      run.spread,
      run.teamGap,
      run.badMatchRate,
      run.matchesSimulated,
    ]
      .map(csvCell)
      .join(","),
  );

  return new Response([header, ...rows].join("\n"), {
    headers: {
      "content-disposition": `attachment; filename="${filename}"`,
      "content-type": "text/csv; charset=utf-8",
      "x-content-type-options": "nosniff",
    },
  });
}
