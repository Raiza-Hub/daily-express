/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@repo/ui"],
  env: {
    NEXT_PUBLIC_CORS_ORIGINS: process.env.CORS_ORIGINS ?? "",
  },
};

export default nextConfig;
