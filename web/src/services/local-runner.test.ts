import { afterEach, describe, expect, it, vi } from 'vitest';
import { localRunnerService } from '@/services/local-runner';

const originalFetch = global.fetch;

describe('localRunnerService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    global.fetch = originalFetch;
  });

  it('returns the runner payload when the bridge succeeds', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 200,
        status_text: '200 OK',
        headers: { 'content-type': 'application/json' },
        body: '{"ok":true}',
        time: 12,
        size: 11,
      }),
    }) as typeof fetch;

    await expect(
      localRunnerService.execute({
        method: 'GET',
        url: 'http://127.0.0.1:4010/health',
      })
    ).resolves.toMatchObject({
      status: 200,
      status_text: '200 OK',
    });
  });

  it('turns bridge connectivity failures into a startup hint', async () => {
    global.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch')) as typeof fetch;

    await expect(
      localRunnerService.execute({
        method: 'GET',
        url: 'http://127.0.0.1:4010/health',
      })
    ).rejects.toThrow(/Local runner unavailable\./);
  });

  it('surfaces timeout and oversized response errors from the bridge', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: 'local run failed: Get "https://slow.example.com": context deadline exceeded',
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: 'response body too large: 5242881 bytes exceeds 5242880 byte limit',
        }),
      }) as typeof fetch;

    await expect(
      localRunnerService.execute({
        method: 'GET',
        url: 'https://slow.example.com',
      })
    ).rejects.toThrow(/context deadline exceeded/);

    await expect(
      localRunnerService.execute({
        method: 'GET',
        url: 'https://large.example.com',
      })
    ).rejects.toThrow(/response body too large/);
  });
});
