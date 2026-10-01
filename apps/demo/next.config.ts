import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Fully static: one HTML page plus assets. No server, no API routes.
  output: 'export',
  reactStrictMode: true,
  poweredByHeader: false,
  images: { unoptimized: true },
};

export default nextConfig;
