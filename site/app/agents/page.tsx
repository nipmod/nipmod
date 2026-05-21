// Drop this file at: nipmod/site/app/agents/page.tsx
import type { Metadata } from "next";
import { AgentsView } from "./agents-view";

export const metadata: Metadata = {
  alternates: { canonical: "https://nipmod.com/agents" },
  description: "Pick an agent host. One archive, every agent.",
  openGraph: {
    description: "Pick an agent host. One archive, every agent.",
    title: "Nipmod agents",
    url: "https://nipmod.com/agents"
  },
  title: "Nipmod agents"
};

export default function AgentsPage() {
  return <AgentsView />;
}
