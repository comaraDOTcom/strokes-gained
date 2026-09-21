import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // PGlite ships a WASM blob and must not be bundled; `ws` is the Neon driver's Node WebSocket.
  serverExternalPackages: ['@electric-sql/pglite', 'ws'],
};

export default nextConfig;
