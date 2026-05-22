import { createPageMetadata } from "../metadata";
import { PackagesView } from "./packages-view";

export const metadata = createPageMetadata({
  description: "Search the Nipmod archive for package records with source context, trust signals and install plans.",
  path: "/packages",
  title: "Nipmod archive"
});

export default function PackagesPage() {
  return <PackagesView />;
}
