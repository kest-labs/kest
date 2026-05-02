import { env } from '@/config/env';
import type { RunRequestResponse } from '@/types/request';

export interface LocalRunnerFormDataField {
  key: string;
  value?: string;
  type?: 'text' | 'file';
  file_name?: string;
  content_type?: string;
  file_base64?: string;
}

export interface LocalRunnerExecuteRequest {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: string;
  body_base64?: string;
  form_data?: LocalRunnerFormDataField[];
  timeout_ms?: number;
  follow_redirects?: boolean;
  strict_tls?: boolean;
}

interface LocalRunnerErrorPayload {
  error?: string;
  message?: string;
}

const localRunnerBaseUrl = env.NEXT_PUBLIC_LOCAL_RUNNER_URL.replace(/\/+$/, '');
const defaultBridgeAllowedOrigins = new Set([
  'https://kest.run',
  'https://www.kest.run',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
  'http://localhost:3003',
  'http://127.0.0.1:3003',
]);

const normalizePayload = <T extends object>(payload: T) =>
  Object.fromEntries(
    Object.entries(payload as Record<string, unknown>).filter(([, value]) => value !== undefined)
  ) as T;

const getBridgeStartupCommand = () => {
  try {
    const target = new URL(localRunnerBaseUrl);
    const flags: string[] = [];
    const currentOrigin = typeof window !== 'undefined' ? window.location.origin.trim() : '';

    if (target.hostname && target.hostname !== '127.0.0.1') {
      flags.push(`--host ${target.hostname}`);
    }

    if (target.port && target.port !== '8788') {
      flags.push(`--port ${target.port}`);
    }

    if (currentOrigin && !defaultBridgeAllowedOrigins.has(currentOrigin)) {
      flags.push(`--allow-origin ${currentOrigin}`);
    }

    return ['kest bridge', ...flags].join(' ');
  } catch {
    return 'kest bridge';
  }
};

const parseRunnerError = async (response: Response) => {
  try {
    const payload = (await response.json()) as LocalRunnerErrorPayload;
    return payload.error || payload.message || `Local runner returned ${response.status}`;
  } catch {
    return `Local runner returned ${response.status}`;
  }
};

const localRunnerUnavailableMessage = () =>
  `Local runner unavailable. Start it on this machine with \`${getBridgeStartupCommand()}\`, then retry.`;

export const localRunnerService = {
  execute: async (payload: LocalRunnerExecuteRequest): Promise<RunRequestResponse> => {
    try {
      const response = await fetch(`${localRunnerBaseUrl}/run`, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(normalizePayload(payload)),
      });

      if (!response.ok) {
        throw new Error(await parseRunnerError(response));
      }

      return (await response.json()) as RunRequestResponse;
    } catch (error) {
      if (error instanceof TypeError) {
        throw new Error(localRunnerUnavailableMessage());
      }

      throw error;
    }
  },
};

export type LocalRunnerService = typeof localRunnerService;
