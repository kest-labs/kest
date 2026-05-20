import { describe, expect, it } from 'vitest';
import {
  buildRuntimeVariableLayers,
  findTemplateKeys,
  findUnresolvedTemplateKeys,
  resolveTemplateValue,
  variablesFromUnknown,
} from '@/utils/request-runtime';

describe('request-runtime', () => {
  it('normalizes variable records into strings', () => {
    expect(
      variablesFromUnknown({
        base_url: 'https://api.example.com',
        retries: 2,
        enabled: true,
        nested: { team: 'kest' },
        omitted: undefined,
      })
    ).toEqual({
      base_url: 'https://api.example.com',
      retries: '2',
      enabled: 'true',
      nested: '{"team":"kest"}',
    });
  });

  it('merges variable layers with runtime taking highest priority', () => {
    const layers = buildRuntimeVariableLayers({
      workspaceVariables: {
        base_url: 'https://workspace.example.com',
        token: 'workspace-token',
        region: 'eu',
      },
      collectionVariables: {
        token: 'collection-token',
        version: 'v1',
      },
      environment: {
        base_url: 'https://env.example.com',
        variables: {
          token: 'environment-token',
          region: 'us',
        },
      },
      runtimeVariables: {
        token: 'runtime-token',
      },
    });

    expect(layers.merged).toEqual({
      base_url: 'https://env.example.com',
      token: 'runtime-token',
      region: 'us',
      version: 'v1',
    });
  });

  it('resolves templates and reports unresolved keys', () => {
    const resolved = resolveTemplateValue(
      '{{base_url}}/orders/{{order_id}}?trace={{trace_id}}',
      {
        base_url: 'https://api.example.com',
        order_id: '42',
      }
    );

    expect(resolved).toBe('https://api.example.com/orders/42?trace={{trace_id}}');
    expect(findTemplateKeys(resolved)).toEqual(['trace_id']);
    expect(findUnresolvedTemplateKeys([resolved, 'Bearer {{api_token}}', '{{trace_id}}'])).toEqual([
      'trace_id',
      'api_token',
    ]);
  });
});
