import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "i.scdn.co",
      },
      {
        protocol: "https",
        hostname: "*.dzcdn.net",
      },
      {
        protocol: "https",
        hostname: "cdns-images.dzcdn.net",
      },
    ],
  },
};

export default nextConfig;
