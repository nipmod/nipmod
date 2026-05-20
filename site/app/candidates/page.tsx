import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  alternates: {
    canonical: "https://nipmod.com/package"
  },
  description: "Use the self service package flow for Gitlawb repos you own.",
  robots: {
    follow: false,
    index: false
  },
  title: "Create package"
};

export default function CandidatesPage() {
  redirect("/package");
}
