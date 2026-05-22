import type { Metadata } from "next";

export const previewImageUrl = "https://nipmod.com/nipmod-logo.png?v=20260522-cube";

const previewImage = {
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
