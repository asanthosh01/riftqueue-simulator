import assert from "node:assert/strict";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";

import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({
  appType: "custom",
  configFile: false,
  root,
  resolve: { alias: { "@": root } },
  server: { middlewareMode: true, hmr: { port: 24711 } },
});
const matchmaking = await vite.ssrLoadModule("/lib/matchmaking.ts");

after(async () => {
  await vite.close();
});

function assertValidLobby(players) {
  assert.equal(players.length, 10);
  assert.equal(players.filter((player) => player.team === "A").length, 5);
  assert.equal(players.filter((player) => player.team === "B").length, 5);
  assert.equal(new Set(players.map((player) => player.name)).size, 10);
}

test("population changes queue outcomes for the same random stream", () => {
  const lowPopulation = matchmaking.runExperimentSuite({
    population: 25,
    traffic: "late",
    policy: "balanced",
    seed: 4817,
    runs: 3,
    matchesPerRun: 150,
  });
  const highPopulation = matchmaking.runExperimentSuite({
    population: 100,
    traffic: "late",
    policy: "balanced",
    seed: 4817,
    runs: 3,
    matchesPerRun: 150,
  });

  assert.ok(
    lowPopulation.baseline.queueSeconds > highPopulation.baseline.queueSeconds,
  );
  assert.ok(
    lowPopulation.adaptive.queueSeconds > highPopulation.adaptive.queueSeconds,
  );
  assert.notEqual(
    lowPopulation.adaptive.badMatchRate,
    highPopulation.adaptive.badMatchRate,
  );
});

test("representative lobbies always contain two complete teams", () => {
  for (const population of [25, 50, 75, 100]) {
    const comparison = matchmaking.runExperimentSuite({
      population,
      traffic: "late",
      policy: "balanced",
      seed: 4817,
      runs: 2,
      matchesPerRun: 80,
    });

    assertValidLobby(comparison.baseline.players);
    assertValidLobby(comparison.adaptive.players);
  }
});
