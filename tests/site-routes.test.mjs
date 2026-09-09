import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "cloudflare:workers") {
      return {
        shortCircuit: true,
        url: "data:text/javascript,export%20const%20env%20%3D%20%7B%7D%3B",
      };
    }
    return nextResolve(specifier, context);
  },
});

const expectedRoutes = [
  ["/", "HOW MUCH MATCH QUALITY IS WORTH A LONGER QUEUE?"],
  ["/findings", "FINDINGS: THE TRADEOFF IS REAL, IN THE MODEL"],
  ["/simulator", "QUEUE RESULTS"],
  ["/experiments", "FOCUSED EXPERIMENTS"],
  ["/runs", "SAVED RUNS"],
  ["/methodology", "HOW RIFTQUEUE WORKS"],
];

const expectedRouteContent = {
  "/": ["Why I built RiftQueue", "not a reconstruction of"],
  "/methodology": [
    "EXPERIMENT QUESTIONS",
    "Why do late-night high-ELO lobbies feel inconsistent\\?",
  ],
  "/findings": ["Synthetic benchmark findings", "A SMALL WIN DOES NOT STOP A COLLAPSE"],
};

test("renders every primary route with persistent navigation", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const environment = {
    ASSETS: {
      fetch: async () => new Response("Not found", { status: 404 }),
    },
  };
  const context = {
    waitUntil() {},
    passThroughOnException() {},
  };

  for (const [route, heading] of expectedRoutes) {
    const response = await worker.fetch(
      new Request(`http://localhost${route}`, {
        headers: { accept: "text/html" },
      }),
      environment,
      context,
    );

    assert.equal(response.status, 200, `${route} should render successfully`);
    const html = await response.text();
    assert.match(html, new RegExp(heading.replace(/[?]/g, "\\?")));
    for (const content of expectedRouteContent[route] ?? []) {
      assert.match(html, new RegExp(content));
    }
    for (const destination of [
      "/simulator",
      "/findings",
      "/experiments",
      "/runs",
      "/methodology",
    ]) {
      assert.match(
        html,
        new RegExp(`href=["']${destination}["']`),
        `${route} should link to ${destination}`,
      );
    }
  }
});
