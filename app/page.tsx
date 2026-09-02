import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Clock3,
  Database,
  FlaskConical,
  Play,
  Server,
  ShieldCheck,
  Users,
} from "lucide-react";

export const metadata: Metadata = {
  title: "RiftQueue — High-ELO Matchmaking Lab",
  description:
    "A full-stack discrete-event simulation for studying high-ELO matchmaking quality and queue-time tradeoffs.",
};

const metrics = [
  { label: "Baseline bad matches", value: "39.9%", detail: "Default simulated scenario" },
  { label: "Tail-Aware bad matches", value: "19.6%", detail: "51% relative reduction", accent: true },
  { label: "Median queue cost", value: "+9 sec", detail: "Tail-Aware tradeoff" },
  { label: "Scenarios evaluated", value: "36", detail: "Population × traffic × policy" },
];

const pipeline = [
  { icon: Users, label: "Generate", detail: "Synthetic players, ranks, roles, and arrivals" },
  { icon: Clock3, label: "Queue", detail: "Wait-dependent search ranges expand over time" },
  { icon: ShieldCheck, label: "Match", detail: "Candidate selection and optimized 5v5 teams" },
  { icon: BarChart3, label: "Measure", detail: "Queue time, spread, team gap, and failures" },
];

export default function OverviewPage() {
  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <div className="mx-auto max-w-[1450px]">
        <section className="grid gap-6 border border-border bg-[linear-gradient(135deg,rgba(34,231,192,.12),rgba(8,20,27,.98)_48%,rgba(255,70,84,.08))] p-6 sm:p-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(360px,.85fr)] lg:p-10">
          <div className="flex flex-col justify-center">
            <div className="mb-5 flex flex-wrap items-center gap-2 text-xs font-black uppercase tracking-[0.14em]">
              <span className="border border-primary/40 bg-primary/10 px-3 py-1.5 text-primary">
                Discrete-event simulation
              </span>
              <span className="border border-border bg-secondary/30 px-3 py-1.5 text-muted-foreground">
                Synthetic data
              </span>
            </div>
            <h1 className="display-type max-w-4xl text-4xl leading-[1.02] sm:text-5xl lg:text-6xl">
              HOW MUCH MATCH QUALITY IS WORTH A LONGER QUEUE?
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
              RiftQueue models sparse, high-ELO matchmaking and compares a simple baseline
              with a Tail-Aware heuristic that protects the edges of the skill distribution.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/simulator"
                className="cut-corners inline-flex h-12 items-center gap-2 bg-destructive px-5 text-sm font-black uppercase tracking-[0.1em] text-white transition-colors hover:bg-[#ff5b68]"
              >
                <Play className="size-4 fill-current" /> Open simulator
              </Link>
              <Link
                href="/experiments"
                className="inline-flex h-12 items-center gap-2 border border-border bg-secondary/30 px-5 text-sm font-black uppercase tracking-[0.1em] transition-colors hover:border-primary hover:text-primary"
              >
                <FlaskConical className="size-4" /> Explore experiments
              </Link>
            </div>
          </div>

          <aside className="border border-primary/30 bg-[#071219]/90 p-5 sm:p-6">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
              Default simulated result
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="border border-border bg-secondary/25 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Baseline</p>
                <p className="display-type mt-2 text-4xl">39.9%</p>
                <p className="mt-2 text-xs text-muted-foreground">bad-match rate</p>
              </div>
              <div className="border border-primary/40 bg-primary/10 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-primary">Tail-Aware</p>
                <p className="display-type mt-2 text-4xl text-primary">19.6%</p>
                <p className="mt-2 text-xs text-muted-foreground">bad-match rate</p>
              </div>
            </div>
            <div className="mt-3 border border-border bg-secondary/20 p-4">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Tradeoff</p>
                  <p className="display-type mt-2 text-3xl text-primary">−51%</p>
                  <p className="mt-1 text-xs text-muted-foreground">relative bad-match reduction</p>
                </div>
                <div className="text-right">
                  <p className="display-type text-3xl">+9 sec</p>
                  <p className="mt-1 text-xs text-muted-foreground">median queue</p>
                </div>
              </div>
            </div>
            <p className="mt-4 text-xs leading-5 text-muted-foreground">
              Simulation result, not a claim about Riot Games&apos; production matchmaking.
            </p>
          </aside>
        </section>

        <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Project highlights">
          {metrics.map((metric) => (
            <article key={metric.label} className="border border-border bg-card/85 p-4 sm:p-5">
              <p className="text-xs font-bold uppercase tracking-[0.13em] text-muted-foreground">
                {metric.label}
              </p>
              <p className={`display-type mt-3 text-3xl sm:text-4xl ${metric.accent ? "text-primary" : ""}`}>
                {metric.value}
              </p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">{metric.detail}</p>
            </article>
          ))}
        </section>

        <section className="mt-6 border border-border bg-card/85">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border bg-[#111f29] px-5 py-4 sm:px-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">System flow</p>
              <h2 className="display-type mt-1 text-2xl sm:text-3xl">FROM PLAYERS TO EVIDENCE</h2>
            </div>
            <Link href="/methodology" className="inline-flex items-center gap-2 text-sm font-black uppercase tracking-wide text-primary hover:underline">
              Read methodology <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="grid md:grid-cols-2 xl:grid-cols-4">
            {pipeline.map((step, index) => {
              const Icon = step.icon;
              return (
                <article key={step.label} className={`p-5 sm:p-6 ${index > 0 ? "border-t border-border xl:border-l xl:border-t-0" : ""} ${index === 2 ? "md:border-l-0 xl:border-l" : index % 2 === 1 ? "md:border-l" : ""}`}>
                  <div className="flex items-center justify-between">
                    <span className="grid size-10 place-items-center border border-primary/40 bg-primary/10 text-primary">
                      <Icon className="size-5" />
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">0{index + 1}</span>
                  </div>
                  <h3 className="mt-4 text-sm font-black uppercase tracking-[0.14em]">{step.label}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.detail}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-3">
          {[
            { icon: Server, title: "Server-backed runs", text: "Eight real trials stream progress while completed experiment records are saved." },
            { icon: Database, title: "Reproducible evidence", text: "Seeds, scenarios, confidence ranges, and downloadable results make each claim inspectable." },
            { icon: FlaskConical, title: "Focused research", text: "Ablation, sensitivity, Pareto, oracle, scenario, and scale studies test different failure modes." },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.title} className="border border-border bg-[#0a151d]/90 p-5">
                <Icon className="size-5 text-primary" />
                <h2 className="mt-4 text-base font-black uppercase tracking-[0.12em]">{item.title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.text}</p>
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}
