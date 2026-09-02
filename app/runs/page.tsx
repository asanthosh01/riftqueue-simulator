"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Download, ExternalLink, History, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { Policy, Traffic } from "@/lib/matchmaking";

type SavedRun = {
  id: string;
  createdAt: number;
  status: "queued" | "running" | "completed" | "failed";
  population: number;
  traffic: Traffic;
  policy: Policy;
  seed: number;
  runs: number;
  matchesPerRun: number;
  progress: number;
  durationMs: number | null;
  error: string | null;
};

async function fetchRuns(): Promise<SavedRun[]> {
  const response = await fetch("/api/experiments", { cache: "no-store" });
  if (!response.ok) throw new Error("Saved runs could not be loaded.");
  const data = (await response.json()) as { runs: SavedRun[] };
  return data.runs;
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function policyLabel(policy: Policy) {
  return policy === "integrity" ? "Competitive" : titleCase(policy);
}

function statusTone(status: SavedRun["status"]) {
  if (status === "completed") return "border-primary/40 bg-primary/10 text-primary";
  if (status === "failed") return "border-destructive/40 bg-destructive/10 text-[#ff9eaa]";
  return "border-[#8f6434] bg-[#3d2a1d] text-[#ffc07a]";
}

export default function RunsPage() {
  const [runs, setRuns] = useState<SavedRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRuns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRuns(await fetchRuns());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Saved runs could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetchRuns()
      .then((savedRuns) => {
        if (active) setRuns(savedRuns);
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Saved runs could not be loaded.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1250px]">
        <section className="flex flex-wrap items-end justify-between gap-4 border border-border bg-[linear-gradient(135deg,rgba(34,231,192,.1),rgba(9,21,29,.98)_55%)] p-6 sm:p-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Experiment history</p>
            <h1 className="display-type mt-2 text-4xl sm:text-5xl">SAVED RUNS</h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-muted-foreground">
              Reopen reproducible scenarios or download completed results for analysis.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={loadRuns}
            disabled={loading}
            className="rounded-none border-border bg-secondary/30 uppercase"
          >
            <RefreshCw className={loading ? "animate-spin" : ""} /> Refresh
          </Button>
        </section>

        {error ? (
          <div className="mt-5 border border-destructive/40 bg-destructive/10 p-4 text-sm text-[#ff9eaa]" role="alert">
            {error}
          </div>
        ) : null}

        <section className="mt-5" aria-label="Saved experiments">
          {loading ? (
            <div className="grid gap-3">
              {[0, 1, 2].map((item) => (
                <Skeleton key={item} className="h-28 rounded-none border border-border bg-card/70" />
              ))}
            </div>
          ) : runs.length === 0 ? (
            <div className="border border-border bg-card/85 p-8 text-center">
              <History className="mx-auto size-7 text-primary" />
              <h2 className="mt-4 text-lg font-black uppercase tracking-[0.12em]">No saved runs yet</h2>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                Complete a server-backed simulation and its result will appear here.
              </p>
              <Link href="/simulator" className="mt-5 inline-flex h-10 items-center border border-primary bg-primary px-4 text-sm font-black uppercase text-primary-foreground">
                Open simulator
              </Link>
            </div>
          ) : (
            <div className="grid gap-3">
              {runs.map((run) => (
                <article key={run.id} className="grid gap-4 border border-border bg-card/85 p-4 sm:p-5 lg:grid-cols-[1fr_auto] lg:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`border px-2.5 py-1 text-[11px] font-black uppercase tracking-wider ${statusTone(run.status)}`}>
                        {run.status}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">#{run.seed}</span>
                      <span className="text-xs text-muted-foreground">{new Date(run.createdAt).toLocaleString()}</span>
                    </div>
                    <h2 className="mt-3 text-base font-black uppercase tracking-[0.1em]">
                      {run.population}% population · {titleCase(run.traffic)} · {policyLabel(run.policy)}
                    </h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {run.runs} trials × {run.matchesPerRun.toLocaleString()} matches
                      {run.durationMs ? ` · ${(run.durationMs / 1000).toFixed(2)} sec compute` : ` · ${run.progress}% complete`}
                    </p>
                    {run.error ? <p className="mt-2 text-sm text-[#ff9eaa]">{run.error}</p> : null}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {run.status === "completed" ? (
                      <>
                        <Link href={`/simulator?run=${run.id}`} className="inline-flex h-9 items-center gap-2 border border-primary bg-primary px-3 text-xs font-black uppercase text-primary-foreground">
                          <ExternalLink className="size-4" /> Open
                        </Link>
                        <a href={`/api/experiments/${run.id}/download?format=json`} className="inline-flex h-9 items-center gap-2 border border-border bg-secondary/30 px-3 text-xs font-black uppercase hover:border-primary hover:text-primary">
                          <Download className="size-4" /> JSON
                        </a>
                        <a href={`/api/experiments/${run.id}/download?format=csv`} className="inline-flex h-9 items-center gap-2 border border-border bg-secondary/30 px-3 text-xs font-black uppercase hover:border-primary hover:text-primary">
                          <Download className="size-4" /> CSV
                        </a>
                      </>
                    ) : (
                      <span className="text-xs font-bold uppercase text-muted-foreground">{run.progress}% complete</span>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
