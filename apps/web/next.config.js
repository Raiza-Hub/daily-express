/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@repo/ui"],
  skipTrailingSlashRedirect: true,
};

export default nextConfig;