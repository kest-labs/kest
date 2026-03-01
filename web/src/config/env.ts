import { z } from 'zod';

/**
 * Extreme Purification: 
 * Only keep environment variables that MUST change between deploys.
 * Defaults are hardcoded as fallback.
 */
const envSchema = z.object({
    // Only the API entry point
    // Dev defaults to local API service, prod defaults to same-origin API.
    VITE_API_URL: z.string().default(import.meta.env.MODE === 'development' ? 'http://localhost:8025' : ''),

    // Optional but sometimes required
    VITE_GA_MEASUREMENT_ID: z.string().optional(),

    // Server-only (adapted for Vite)
    MODE: z.enum(['development', 'production', 'test']).default('development'),
    VITE_DASHSCOPE_API_KEY: z.string().optional(),
    VITE_DASHSCOPE_BASE_URL: z.string().default('https://dashscope.aliyuncs.com/compatible-mode/v1/'),
});

const parsed = envSchema.safeParse({
    VITE_API_URL: import.meta.env.VITE_API_URL,
    VITE_GA_MEASUREMENT_ID: import.meta.env.VITE_GA_MEASUREMENT_ID,
    VITE_DASHSCOPE_API_KEY: import.meta.env.VITE_DASHSCOPE_API_KEY,
    VITE_DASHSCOPE_BASE_URL: import.meta.env.VITE_DASHSCOPE_BASE_URL,
    MODE: import.meta.env.MODE,
});

if (!parsed.success) {
    console.error('❌ Invalid environment variables:', parsed.error.format());
    throw new Error('Invalid environment variables');
}

export const env = parsed.data;

// Shorthands for cleaner calls
export const isDev = env.MODE === 'development';
export const isProd = env.MODE === 'production';
