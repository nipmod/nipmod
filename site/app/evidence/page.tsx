import { createPageMetadata } from "../metadata";
import { EvidenceView } from "./evidence-view";

export const metadata = createPageMetadata({
  description: "Public Nipmod evidence for package discovery, trust checks, advisories and machine-readable proof.",
  path: "/evidence",
  title: "Nipmod evidence"
});

export default function EvidencePage() {
  return <EvidenceView selectedPackage={null} />;
}
