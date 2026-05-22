import type { Metadata } from "next";
import { createPageMetadata } from "../../../metadata";
import { notFound } from "next/navigation";
import { EvidenceView, evidencePackageParams, findEvidencePackage } from "../../evidence-view";
import { packageEvidenceHref } from "../../../packages/content";

type PackageEvidencePageProps = {
  params: Promise<{
    packageName: string;
  }>;
};

export function generateStaticParams() {
  return evidencePackageParams();
}

export async function generateMetadata({ params }: PackageEvidencePageProps): Promise<Metadata> {
  const { packageName } = await params;
  const pkg = findEvidencePackage(packageName);
  const title = pkg ? `${pkg.name} evidence` : "package evidence";
  const path = pkg ? packageEvidenceHref(pkg).split("#")[0] ?? "/evidence" : "/evidence";

  return createPageMetadata({
    description: pkg
      ? `${pkg.name}: package evidence, source context, trust signals and proof links for agents.`
      : "Nipmod package evidence with source context, trust signals and proof links for agents.",
    path,
    title
  });
}

export default async function PackageEvidencePage({ params }: PackageEvidencePageProps) {
  const { packageName } = await params;
  const pkg = findEvidencePackage(packageName);

  if (!pkg) {
    notFound();
  }

  return <EvidenceView selectedPackage={pkg} />;
}
