import { describe, expect, it } from 'vitest';
import { buildKestConnectionKey } from '../kest-connection-key';

const decodeConnectionKey = (key: string) => {
  const encoded = key.replace(/^kest_key_/, '');
  const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
};

describe('buildKestConnectionKey', () => {
  it('encodes the web connection payload as a url-safe key', () => {
    const key = buildKestConnectionKey({
      version: 1,
      platform_url: 'https://api.kest.dev/v1',
      platform_token: 'kest_pat_example',
      platform_project_id: '12',
      platform_auto_sync_history: true,
    });

    expect(key).toMatch(/^kest_key_[A-Za-z0-9_-]+$/);
    expect(decodeConnectionKey(key)).toEqual({
      version: 1,
      platform_url: 'https://api.kest.dev/v1',
      platform_token: 'kest_pat_example',
      platform_project_id: '12',
      platform_auto_sync_history: true,
    });
  });
});
