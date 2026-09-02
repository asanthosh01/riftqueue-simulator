import assert from "node:assert/strict";
import { registerHooks } from "node:module";
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

async function fetchWorker(pathname) {
  process.__riftqueueCloudflareEnv.DB = databaseWithCompletedRun();
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${pathname}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${pathname}`),
    {
      DB: process.__riftqueueCloudflareEnv.DB,
      ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
    },
    { waitUntil() {}, passThroughOnException() {} },
  );
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
