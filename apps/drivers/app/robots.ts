import type { MetadataRoute } from "next";
import { buildDriverAbsoluteUrl, driverAppUrl } from "./lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/sign-up"],
        disallow: ["/", "/api/"],
      },
    ],
    sitemap: buildDriverAbsoluteUrl("/sitemap.xml"),
    host: driverAppUrl.origin,
  };
}
