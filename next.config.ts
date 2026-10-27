import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Telegram opens the app inside its own webview; no special headers are needed.
  reactStrictMode: true,
  // Do not generate AGENTS.md in the project root on `next dev`.
  agentRules: false,
};

export default nextConfig;
