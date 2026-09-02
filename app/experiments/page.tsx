import type { Metadata } from "next";

import { RiftQueueWorkspace } from "@/components/riftqueue-workspace";

export const metadata: Metadata = {
  title: "Experiments — RiftQueue",
  description: "Run focused matchmaking ablation, sensitivity, oracle, Pareto, and scale studies.",
};

export default function ExperimentsPage() {
  return <RiftQueueWorkspace mode="experiments" />;
}
