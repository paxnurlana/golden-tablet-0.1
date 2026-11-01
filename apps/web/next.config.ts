import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  distDir: process.env.JOURNAL_FAST_BUILD === "1" ? ".next-fast" : ".next",
  experimental: { staleTimes: { dynamic: 120, static: 300 } },
  output: process.env.JOURNAL_FAST_BUILD === "1" ? undefined : "standalone",
  transpilePackages: ["@golden-tablet/journal-core", "@golden-tablet/journal-importers"],
  serverExternalPackages: ["better-sqlite3","ffmpeg-static"],
  // Runtime journal files belong on the user's disk, never in a deployable bundle.
  outputFileTracingExcludes: {
    "/*": ["./data/**/*", "../../outputs/**/*", "../../.runtime-backup*/**/*"],
  },
};

export default nextConfig;
