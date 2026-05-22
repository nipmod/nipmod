import type { Metadata } from "next";

export const previewImageUrl = "https://nipmod.com/nipmod-logo.png?v=20260522";

const previewImage = {
  alt: "Nipmod logo",
  height: 1248,
  type: "image/png",
  url: previewImageUrl,
  width: 1248
} as const;

export function withPreviewImage(openGraph: NonNullable<Metadata["openGraph"]>): NonNullable<Metadata["openGraph"]> {
  return {
    ...openGraph,
    images: [previewImage]
  };
}
