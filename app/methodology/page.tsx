import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Braces, Clock3, Scale, ShieldCheck, Users } from "lucide-react";

export const metadata: Metadata = {
  title: "Methodology — RiftQueue",
  description: "How RiftQueue models players, queue expansion, matchmaking, team balance, and experimental evidence.",
};

const assumptions = [
  { label: "Player demand", value: "0.32 / sec", detail: "At 100% peak traffic. Late demand is 56%; overnight demand is 24%." },
  { label: "Rank mixture", value: "5% Radiant", detail: "34% Ascendant 3, 28% Immortal 1, 20% Immortal 2, and 13% Immortal 3." },
  { label: "Search expansion", value: "20 / 45 / 90 sec", detail: "Fast, Balanced, and Competitive policies widen at different intervals." },
  { label: "Bad-match rule", value: "280 / 42 MMR", detail: "A match is flagged above either lobby spread or team-gap threshold." },
];

const stages = [
  { icon: Users, title: "Player arrivals", text: "A seeded arrival process generates individual players with hidden MMR, displayed rank, role, and queue-entry time." },
  { icon: Clock3, title: "Expanding search", text: "Each waiting player receives an acceptable MMR radius that widens according to queue policy and wait time." },
  { icon: Braces, title: "Candidate selection", text: "The baseline prioritizes an eligible skill window; Tail-Aware scores candidate groups with extra protection for scarce top-tail players." },
  { icon: Scale, title: "Team assignment", text: "Snake balancing provides the baseline. The optimized balancer searches legal 5v5 splits and minimizes team-average MMR gap." },
];

export default function MethodologyPage() {
  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1250px]">
        <section className="border border-border bg-[linear-gradient(135deg,rgba(34,231,192,.1),rgba(9,21,29,.98)_55%)] p-6 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Model transparency</p>
          <h1 className="display-type mt-2 text-4xl sm:text-5xl">HOW RIFTQUEUE WORKS</h1>
          <p className="mt-4 max-w-4xl text-base leading-7 text-muted-foreground">
            RiftQueue is a controlled, VALORANT-inspired simulation. It does not use Riot&apos;s hidden MMR,
            player concurrency, production infrastructure, or internal matchmaking rules.
          </p>
          <Link href="/simulator" className="mt-6 inline-flex items-center gap-2 text-sm font-black uppercase tracking-wide text-primary hover:underline">
            Run the model <ArrowRight className="size-4" />
          </Link>
        </section>

        <section className="mt-6 grid gap-3 md:grid-cols-2">
          {stages.map((stage, index) => {
            const Icon = stage.icon;
            return (
              <article key={stage.title} className="border border-border bg-card/85 p-5 sm:p-6">
                <div className="flex items-center justify-between">
                  <span className="grid size-10 place-items-center border border-primary/40 bg-primary/10 text-primary"><Icon className="size-5" /></span>
                  <span className="font-mono text-xs text-muted-foreground">STEP 0{index + 1}</span>
                </div>
                <h2 className="mt-4 text-base font-black uppercase tracking-[0.13em]">{stage.title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{stage.text}</p>
              </article>
            );
          })}
        </section>

        <section className="mt-6 border border-border bg-card/85">
          <div className="border-b border-border bg-[#111f29] px-5 py-4 sm:px-6">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Synthetic inputs</p>
            <h2 className="display-type mt-1 text-2xl sm:text-3xl">CURRENT ASSUMPTIONS</h2>
          </div>
          <div className="grid sm:grid-cols-2 xl:grid-cols-4">
            {assumptions.map((assumption, index) => (
              <article key={assumption.label} className={`p-5 ${index > 0 ? "border-t border-border sm:border-l xl:border-t-0" : ""} ${index === 2 ? "sm:border-l-0 xl:border-l" : ""}`}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-black uppercase tracking-[0.13em] text-muted-foreground">{assumption.label}</p>
                  <span className="border border-[#4a3f26] bg-[#2a2518] px-2 py-1 text-[10px] font-black uppercase text-[#f3d177]">Synthetic</span>
                </div>
                <p className="display-type mt-4 text-2xl">{assumption.value}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{assumption.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-[1.15fr_.85fr]">
          <article className="border border-border bg-card/85 p-5 sm:p-6">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Experimental control</p>
            <h2 className="display-type mt-2 text-2xl">FAIR ALGORITHM COMPARISONS</h2>
            <p className="mt-4 text-sm leading-7 text-muted-foreground">
              Every Baseline and Tail-Aware comparison receives the same seeded player-arrival stream.
              Eight independent trials are aggregated into means and 95% confidence intervals so differences
              come from matcher behavior, not different players.
            </p>
          </article>
          <article className="border border-primary/35 bg-primary/10 p-5 sm:p-6">
            <ShieldCheck className="size-5 text-primary" />
            <h2 className="mt-4 text-base font-black uppercase tracking-[0.12em]">Interpretation boundary</h2>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              Confidence intervals measure variation within this simulation. They do not measure accuracy
              against Riot&apos;s private production environment.
            </p>
          </article>
        </section>
      </div>
    </main>
  );
}
