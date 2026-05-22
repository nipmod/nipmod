import { createPageMetadata } from "../metadata";
import { TrustView } from "./trust-view";

export const metadata = createPageMetadata({
  description: "How Nipmod evaluates source context, package trust, install plans and workspace write boundaries.",
  path: "/trust",
  title: "Nipmod trust"
});

export default function TrustPage() {
  return <TrustView />;
}
