import type { Metadata } from "next";
import { withPreviewImage } from "../metadata";
import { EvidenceView } from "./evidence-view";

export const metadata: Metadata = {
  alternates: {
    canonical: "https://nipmod.com/evidence"
  },
  description: "Human readable Nipmod proof for discovery, registry, checkpoint, witness, advisories and package evidence.",
  openGraph: withPreviewImage({
    description: "Human readable Nipmod proof with explicit links to the machine artifacts agents verify.",
    title: "Nipmod evidence",
    url: "https://nipmod.com/evidence"
  }),
  title: "Nipmod evidence"
};

export default function EvidencePage() {
  return <EvidenceView selectedPackage={null} />;
}
