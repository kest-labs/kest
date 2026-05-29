import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Performance optimizations
  compress: true,
  poweredByHeader: false,

  // Image optimization
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  // Experimental features
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-icons',
      '@tabler/icons-react',
    ],
    preloadEntriesOnStart: false,
    webpackMemoryOptimizations: true,
  },

  productionBrowserSourceMaps: false,
  turbopack: {
    root: projectRoot,
  },

  async redirects() {
    return [
      {
        source: '/project',
        destination: '/workspace',
        permanent: false,
      },
      {
        source: '/project/:path*',
        destination: '/workspace/:path*',
        permanent: false,
      },
      {
        source: '/invite/project/:slug',
        destination: '/invite/workspace/:slug',
        permanent: false,
      },
    ];
  },

  // Security headers only (no caching headers)
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
