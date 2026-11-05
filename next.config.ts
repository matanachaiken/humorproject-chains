import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Riff images live in Daily Riff's public Supabase bucket.
    remotePatterns: [
      new URL("https://hysjcqwvzjxzdmmqglhu.supabase.co/storage/v1/object/public/generations/**"),
    ],
    qualities: [75],
    minimumCacheTTL: 60 * 60 * 24 * 31,
  },
  experimental: {
    // Run inputs go through a server action. The browser shrinks images
    // first, and Vercel caps request bodies at 4.5 MB anyway.
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;
