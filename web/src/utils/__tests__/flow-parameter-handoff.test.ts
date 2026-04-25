import { describe, expect, it } from 'vitest';
import {
  extractFlowParameterCandidates,
  mergeCaptureDefinitions,
  mergeVariableMappings,
  normalizeFlowVariableName,
  parseCaptureDefinitions,
  parseFlowStepResponseBody,
} from '../flow-parameter-handoff';

describe('flow parameter handoff utils', () => {
  it('parses the JSON body stored in a flow step response', () => {
    const body = parseFlowStepResponseBody(
      JSON.stringify({
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: '{"data":{"access_token":"abc"}}',
      })
    );

    expect(body).toEqual({ data: { access_token: 'abc' } });
  });

  it('extracts selectable scalar fields with display and capture paths', () => {
    const candidates = extractFlowParameterCandidates(
      JSON.stringify({
        status: 200,
        body: JSON.stringify({
          data: {
            access_token: 'abc',
            user: { id: 42 },
            items: [{ id: 'first' }],
          },
        }),
      })
    );

    expect(candidates.map((candidate) => candidate.displayPath)).toEqual([
      'body.data.access_token',
      'body.data.user.id',
      'body.data.items[0].id',
    ]);
    expect(candidates.map((candidate) => candidate.capturePath)).toEqual([
      'data.access_token',
      'data.user.id',
      'data.items[0].id',
    ]);
    expect(candidates[0]).toMatchObject({
      defaultVariableName: 'accessToken',
      valueType: 'string',
      preview: 'abc',
    });
    expect(candidates[1].defaultVariableName).toBe('id');
    expect(candidates[2].defaultVariableName).toBe('id2');
  });

  it('normalizes default variable names for template compatibility', () => {
    expect(normalizeFlowVariableName('access_token')).toBe('accessToken');
    expect(normalizeFlowVariableName('user-id')).toBe('userId');
    expect(normalizeFlowVariableName('123')).toBe('value123');
    expect(normalizeFlowVariableName('')).toBe('value');
  });

  it('parses and merges capture lines without duplicating variables', () => {
    const captures = '# keep this\nlegacy = data.legacy\nauthToken: old.path';
    const next = mergeCaptureDefinitions(captures, [
      { variableName: 'authToken', capturePath: 'data.access_token' },
      { variableName: 'userId', capturePath: 'data.user.id' },
    ]);

    expect(parseCaptureDefinitions(next)).toEqual([
      expect.objectContaining({ variableName: 'legacy', path: 'data.legacy' }),
      expect.objectContaining({ variableName: 'authToken', path: 'data.access_token' }),
      expect.objectContaining({ variableName: 'userId', path: 'data.user.id' }),
    ]);
    expect(next).toBe('# keep this\nlegacy = data.legacy\nauthToken: data.access_token\nuserId: data.user.id');
  });

  it('merges variable mappings and avoids duplicate handoffs', () => {
    const next = mergeVariableMappings(
      [{ source: 'authToken', target: 'authToken' }],
      [
        { variableName: 'authToken', capturePath: 'data.access_token' },
        { variableName: 'userId', capturePath: 'data.user.id' },
      ]
    );

    expect(next).toEqual([
      { source: 'authToken', target: 'authToken' },
      { source: 'userId', target: 'userId' },
    ]);
  });
});
