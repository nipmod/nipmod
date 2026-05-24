import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { siteDescription, siteName } from "../metadata";

export const metadata: Metadata = {
  alternates: {
    canonical: "https://nipmod.com/packages"
  },
  description: siteDescription,
  robots: {
    follow: false,
    index: false
  },
  title: siteName
};

export default function CandidatesPage() {
  redirect("/packages");
}
