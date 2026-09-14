import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "freelance-meikan.com",
        pathname: "/storage/profile_images/**",
        search: "",
      },
    ],
  },
};

export default nextConfig;
