import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const normalizeBasePath = (value: string) => {
  if (!value) {
    return '';
  }

  const withLeadingSlash = value.startsWith('/') ? value : `/${value}`;
  return withLeadingSlash.replace(/\/+$/, '');
};

const apiTarget = (process.env.NEXT_PUBLIC_API_URL ?? 'https://api.kest.dev').replace(/\/$/, '');
const apiBasePath = normalizeBasePath(process.env.NEXT_PUBLIC_API_BASE_PATH ?? '/v1');
const apiProxyPath = normalizeBasePath(process.env.NEXT_PUBLIC_API_PROXY_PATH ?? '/api/proxy');
const apiUseProxy = (process.env.NEXT_PUBLIC_API_USE_PROXY ?? 'true') === 'true';

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

  async rewrites() {
    if (!apiUseProxy || !apiTarget) {
      return [];
    }

    return [
      {
        source: `${apiProxyPath}/:path*`,
        destination: `${apiTarget}${apiBasePath}/:path*`,
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
