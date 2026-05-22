import type { Metadata } from "next";

export const siteName = "Nipmod";
export const siteUrl = "https://nipmod.com";
export const brandVersion = "20260522-orange-cube";
export const siteDescription = "The package layer for AI agents.";
export const previewImageUrl = `${siteUrl}/nipmod-logo.png?v=${brandVersion}`;

export const previewImage = {
  alt: "Nipmod cube mark",
  height: 1254,
  type: "image/png",
  url: previewImageUrl,
  width: 1254
} as const;

export function withPreviewImage(openGraph: NonNullable<Metadata["openGraph"]>): NonNullable<Metadata["openGraph"]> {
  return {
    ...openGraph,
    images: [previewImage]
  };
}

export function createPageMetadata({
  description = siteDescription,
  path = "/",
  title = siteName
}: {
  description?: string;
  path?: string;
  title?: string;
} = {}): Metadata {
  const url = new URL(path, siteUrl).toString();

  return {
    alternates: { canonical: url },
    description,
    openGraph: withPreviewImage({
      description,
      siteName,
      title,
      type: "website",
      url
    }),
    title: siteName,
    twitter: {
      card: "summary_large_image",
      creator: "@Nipmod",
      description,
      images: [previewImageUrl],
      site: "@Nipmod",
      title
    }
  };
}
