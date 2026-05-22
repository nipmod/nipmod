import type { MetadataRoute } from "next";
import { brandVersion, siteDescription, siteName } from "./metadata";

export default function manifest(): MetadataRoute.Manifest {
  return {
    background_color: "#1f1f21",
    description: siteDescription,
    display: "standalone",
    icons: [
      {
        purpose: "any",
        sizes: "1254x1254",
        src: `/icon.png?v=${brandVersion}`,
        type: "image/png"
      },
      {
        purpose: "maskable",
        sizes: "1254x1254",
        src: `/icon.png?v=${brandVersion}`,
        type: "image/png"
      }
    ],
    name: siteName,
    short_name: siteName,
    start_url: "/",
    theme_color: "#1f1f21"
  };
}
