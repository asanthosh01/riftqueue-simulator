import type { Metadata } from "next";

import { RiftQueueWorkspace } from "@/components/riftqueue-workspace";

export const metadata: Metadata = {
  title: "Simulator — RiftQueue",
  description: "Configure and run a reproducible high-ELO matchmaking simulation.",
};

export default function SimulatorPage() {
  return <RiftQueueWorkspace mode="simulator" />;
}
