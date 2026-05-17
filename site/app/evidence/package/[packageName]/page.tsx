import type { Metadata } from "next";
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

  return {
    alternates: {
      canonical: pkg ? `https://nipmod.com${packageEvidenceHref(pkg).split("#")[0]}` : "https://nipmod.com/evidence"
    },
    description: pkg ? `Human readable nipmod proof for ${pkg.name}.` : "Human readable nipmod package proof.",
    openGraph: {
      description: pkg ? `Digest, signer, source, witness and raw proof links for ${pkg.name}.` : "Human readable nipmod package proof.",
      title,
      url: pkg ? `https://nipmod.com${packageEvidenceHref(pkg).split("#")[0]}` : "https://nipmod.com/evidence"
    },
    title
  };
}

export default async function PackageEvidencePage({ params }: PackageEvidencePageProps) {
  const { packageName } = await params;
  const pkg = findEvidencePackage(packageName);

  if (!pkg) {
    notFound();
  }

  return <EvidenceView selectedPackage={pkg} />;
}
