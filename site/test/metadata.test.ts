import { describe, expect, test } from "vitest";
import manifest from "../app/manifest";
import { createPageMetadata, previewImageUrl, siteDescription, siteName } from "../app/metadata";

describe("site metadata", () => {
  test("uses one canonical preview description and image", () => {
    expect(siteName).toBe("Nipmod");
    expect(siteDescription).toBe(
      "One package API for agents. Search sources, inspect trust and get safe install plans before workspace writes."
    );
    expect(previewImageUrl).toBe("https://nipmod.com/nipmod-logo.png?v=20260522-orange-cube");
  });

  test("generates complete social metadata for pages", () => {
    const metadata = createPageMetadata({
      path: "/api-access",
      title: "Nipmod API"
    });

    expect(metadata).toMatchObject({
      alternates: { canonical: "https://nipmod.com/api-access" },
      description: siteDescription,
      title: siteName,
      twitter: {
        card: "summary_large_image",
        description: siteDescription,
        images: [previewImageUrl],
        title: "Nipmod API"
      }
    });
    expect(metadata.openGraph).toMatchObject({
      description: siteDescription,
      images: [
        {
          alt: "Nipmod cube mark",
          url: previewImageUrl
        }
      ],
      title: "Nipmod API",
      url: "https://nipmod.com/api-access"
    });
  });

  test("publishes browser install metadata with the current brand asset", () => {
    const webManifest = manifest();

    expect(webManifest).toMatchObject({
      background_color: "#1f1f21",
      description: siteDescription,
      name: siteName,
      short_name: siteName,
      start_url: "/",
      theme_color: "#1f1f21"
    });
    expect(webManifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          purpose: "any",
          src: "/icon.png?v=20260522-orange-cube"
        }),
        expect.objectContaining({
          purpose: "maskable",
          src: "/icon.png?v=20260522-orange-cube"
        })
      ])
    );
  });
});
