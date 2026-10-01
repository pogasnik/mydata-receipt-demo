import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Fully static: one HTML page plus assets. No server, no API routes.
  output: 'export',
  reactStrictMode: true,
  poweredByHeader: false,
  images: { unoptimized: true },
  // Don't write AGENTS.md / CLAUDE.md into the app on `next dev`.
  agentRules: false,
};

export default nextConfig;
