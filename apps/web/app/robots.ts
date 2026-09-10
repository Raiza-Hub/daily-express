import type { MetadataRoute } from "next";
import { buildWebAbsoluteUrl, webAppUrl } from "./lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/"],
        disallow: [
          "/api/",
          "/trip-status",
          "/settings/",
          "/sign-in",
        ],
      },
    ],
    sitemap: buildWebAbsoluteUrl("/sitemap.xml"),
    host: webAppUrl.origin,
  };
}
