// Drop this file at: nipmod/site/app/trust/page.tsx
import type { Metadata } from "next";
import { withPreviewImage } from "../metadata";
import { TrustView } from "./trust-view";

export const metadata: Metadata = {
  alternates: { canonical: "https://nipmod.com/trust" },
  description: "What makes a Nipmod package verifiable. Source, publisher, digest, witness, audit.",
  openGraph: withPreviewImage({
    description: "What makes a Nipmod package verifiable. Source, publisher, digest, witness, audit.",
    title: "Nipmod trust",
    url: "https://nipmod.com/trust"
  }),
  title: "Nipmod trust"
};

export default function TrustPage() {
  return <TrustView />;
}
