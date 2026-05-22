// Drop this file at: nipmod/site/app/packages/page.tsx
import type { Metadata } from "next";
import { withPreviewImage } from "../metadata";
import { PackagesView } from "./packages-view";

export const metadata: Metadata = {
  alternates: { canonical: "https://nipmod.com/packages" },
  description: "Search verified Nipmod packages for agents with trust, source and install context.",
  openGraph: withPreviewImage({
    description: "Search verified Nipmod packages for agents with trust, source and install context.",
    title: "Nipmod archive",
    url: "https://nipmod.com/packages"
  }),
  title: "Nipmod archive"
};

export default function PackagesPage() {
  return <PackagesView />;
}
