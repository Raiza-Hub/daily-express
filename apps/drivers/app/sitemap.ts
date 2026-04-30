import type { MetadataRoute } from "next";
import { buildDriverAbsoluteUrl } from "./lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: buildDriverAbsoluteUrl("/sign-up"),
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.6,
    },
  ];
}
