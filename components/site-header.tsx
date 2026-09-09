"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  FlaskConical,
  Gauge,
  History,
  Menu,
  Play,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const navigation = [
  { href: "/", label: "Overview", icon: Gauge },
  { href: "/findings", label: "Findings", icon: BarChart3 },
  { href: "/simulator", label: "Simulator", icon: Play },
  { href: "/experiments", label: "Experiments", icon: FlaskConical },
  { href: "/runs", label: "Saved Runs", icon: History },
  { href: "/methodology", label: "Methodology", icon: BookOpen },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === href : pathname.startsWith(href);
}

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-border/90 bg-[#071117]/95 backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] max-w-[1600px] items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-3" aria-label="RiftQueue overview">
          <span className="cut-corners grid size-10 place-items-center bg-primary text-primary-foreground">
            <Gauge className="size-5" strokeWidth={2.5} />
          </span>
          <span>
            <span className="display-type block text-xl leading-none tracking-[0.08em]">
              RIFT<span className="text-primary">QUEUE</span>
            </span>
            <span className="mt-1 hidden text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground sm:block">
              High-ELO matchmaking lab
            </span>
          </span>
        </Link>

        <nav className="ml-auto hidden items-center gap-1 lg:flex" aria-label="Primary navigation">
          {navigation.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`border px-3 py-2 text-xs font-black uppercase tracking-[0.1em] transition-colors ${
                  active
                    ? "border-primary/45 bg-primary/10 text-primary"
                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2 lg:ml-2">
          <Link
            href="/simulator"
            className="cut-corners hidden h-10 items-center gap-2 bg-destructive px-4 text-xs font-black uppercase tracking-[0.1em] text-white transition-colors hover:bg-[#ff5b68] sm:inline-flex"
          >
            <Play className="size-4 fill-current" /> Run simulation
          </Link>

          <Sheet>
            <SheetTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="rounded-none border-border bg-secondary/30 lg:hidden"
                aria-label="Open navigation"
              >
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="border-border bg-[#08141b]">
              <SheetHeader className="border-b border-border">
                <SheetTitle className="display-type tracking-[0.08em]">RIFTQUEUE</SheetTitle>
                <SheetDescription>Navigate the simulation lab.</SheetDescription>
              </SheetHeader>
              <nav className="grid gap-2 px-4" aria-label="Mobile navigation">
                {navigation.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(pathname, item.href);
                  return (
                    <SheetClose key={item.href} asChild>
                      <Link
                        href={item.href}
                        className={`flex items-center gap-3 border px-4 py-3 text-sm font-black uppercase tracking-[0.1em] ${
                          active
                            ? "border-primary/45 bg-primary/10 text-primary"
                            : "border-border bg-secondary/20 text-muted-foreground"
                        }`}
                      >
                        <Icon className="size-4" />
                        {item.label}
                      </Link>
                    </SheetClose>
                  );
                })}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
