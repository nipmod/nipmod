import { createPageMetadata } from "../metadata";
import { AgentsView } from "./agents-view";

export const metadata = createPageMetadata({
  description: "Pick an agent and connect it to Nipmod package search, trust checks and install plans.",
  path: "/agents",
  title: "Nipmod agents"
});

export default function AgentsPage() {
  return <AgentsView />;
}
