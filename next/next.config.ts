/* eslint-disable */
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: false,
  webpack: (config) => {
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'asset/resource',
      generator: {
        filename: 'static/chunks/[path][name].[hash][ext]',
      },
    });

    const fallback = {
      fs: false,
      perf_hooks: false,
      os: false,
      worker_threads: false,
      crypto: false,
      stream: false,
    };

    config.resolve.fallback = { ...config.resolve.fallback, ...fallback };

    return config;
  },
};

export default nextConfig;
