import { env } from "cloudflare:workers";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const row = await env.DB.prepare(
    `SELECT id, created_at AS createdAt, status, population, traffic, policy,
            seed, runs, matches_per_run AS matchesPerRun, progress,
            duration_ms AS durationMs, result_json AS resultJson, error
       FROM experiment_runs
      WHERE id = ?`,
  )
    .bind(id)
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
