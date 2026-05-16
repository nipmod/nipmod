import type { Metadata } from "next";
import { EvidenceView } from "./evidence-view";

export const metadata: Metadata = {
  alternates: {
    canonical: "https://nipmod.com/evidence"
  },
  description: "Human readable nipmod proof for discovery, registry, checkpoint, witness, advisories and package evidence.",
  openGraph: {
    description: "Human readable nipmod proof with explicit links to the machine artifacts agents verify.",
    title: "nipmod evidence",
    url: "https://nipmod.com/evidence"
  },
  title: "nipmod evidence"
};

export default function EvidencePage() {
  return <EvidenceView selectedPackage={null} />;
}
