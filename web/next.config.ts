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
    // アバターは 56px / 88px 表示のみ。変換サイズを 64/128/256 に絞り、
    // Vercel の画像最適化 (無料枠) の消費を 1 人あたり最大 3 変換に抑える
    imageSizes: [64, 128, 256],
    // プロフィール画像はほとんど変わらないため 30 日キャッシュする
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
};

export default nextConfig;
