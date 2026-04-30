import { z } from 'zod';

const defaultApiUrl =
  process.env.NODE_ENV === 'development' ? 'http://127.0.0.1:8025' : 'https://api.kest.dev';

/**
 * Extreme Purification: 
 * Only keep environment variables that MUST change between deploys.
 * Defaults are hardcoded as fallback.
 */
const envSchema = z.object({
  // Only the API entry point
  NEXT_PUBLIC_API_URL: z.string().default(defaultApiUrl),
  NEXT_PUBLIC_API_BASE_PATH: z.string().default('/v1'),
  NEXT_PUBLIC_API_PROXY_PATH: z.string().default('/api/proxy'),
  NEXT_PUBLIC_API_USE_PROXY: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
  NEXT_PUBLIC_APP_URL: z.string().optional(),
  NEXT_PUBLIC_LOCAL_RUNNER_URL: z.string().default('http://127.0.0.1:8788'),
  NEXT_PUBLIC_DEBUG_API_ERRORS: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  
  // Optional but sometimes required
  NEXT_PUBLIC_GA_MEASUREMENT_ID: z.string().optional(),
  
  // Server-only
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

const parsed = envSchema.safeParse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_API_BASE_PATH: process.env.NEXT_PUBLIC_API_BASE_PATH,
  NEXT_PUBLIC_API_PROXY_PATH: process.env.NEXT_PUBLIC_API_PROXY_PATH,
  NEXT_PUBLIC_API_USE_PROXY: process.env.NEXT_PUBLIC_API_USE_PROXY,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_LOCAL_RUNNER_URL: process.env.NEXT_PUBLIC_LOCAL_RUNNER_URL,
  NEXT_PUBLIC_DEBUG_API_ERRORS: process.env.NEXT_PUBLIC_DEBUG_API_ERRORS,
  NEXT_PUBLIC_GA_MEASUREMENT_ID: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
  NODE_ENV: process.env.NODE_ENV,
});

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.format());
  throw new Error('Invalid environment variables');
}

export const env = parsed.data;

// Shorthands for cleaner calls
export const isDev = env.NODE_ENV === 'development';
export const isProd = env.NODE_ENV === 'production';
