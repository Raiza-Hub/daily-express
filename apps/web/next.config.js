import process from "node:process";

/** @type {import('next').NextConfig} */
const deploymentId = process.env.VERCEL_GIT_COMMIT_SHA ?? "local-dev";

const nextConfig = {
  deploymentId,
  transpilePackages: ["@repo/ui"],
  async rewrites() {
    return [
      {
        source: "/daily-express-flow/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/daily-express-flow/array/:path*",
        destination: "https://us-assets.i.posthog.com/array/:path*",
      },
      {
        source: "/daily-express-flow/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
    ];
  },
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
