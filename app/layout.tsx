import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

export const metadata: Metadata = {
  title: "RiftQueue — High-ELO Matchmaking Lab",
  description:
    "Explore the tradeoff between queue time and competitive integrity in a VALORANT-inspired high-ELO matchmaking simulation.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
