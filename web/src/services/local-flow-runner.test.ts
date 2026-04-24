import { describe, expect, it, vi } from 'vitest';
import { runLocalFlow, type LocalFlowEdgeDefinition, type LocalFlowStepDefinition } from '@/services/local-flow-runner';

describe('runLocalFlow', () => {
  it('executes steps through the local bridge in dependency order', async () => {
    const steps: LocalFlowStepDefinition[] = [
      {
        id: 11,
        name: 'Login',
        sort_order: 0,
        method: 'POST',
        url: 'http://127.0.0.1:3000/login',
        headers: '{"Content-Type":"application/json"}',
        body: '{"username":"demo"}',
        captures: 'token = body.data.token',
        asserts: 'status == 200\nbody.data.token length == 3',
      },
      {
        id: 22,
        name: 'Profile',
        sort_order: 1,
        method: 'GET',
        url: 'http://127.0.0.1:3000/profile',
        headers: '{"Authorization":"Bearer {{authToken}}"}',
        body: '',
        captures: '',
        asserts: 'status == 200\nbody.tags contains "cli"\nbody.error not exists',
      },
    ];
    const edges: LocalFlowEdgeDefinition[] = [
      {
        source_step_id: 11,
        target_step_id: 22,
        mappings: [{ source: 'token', target: 'authToken' }],
      },
    ];

    const execute = vi
      .fn()
      .mockResolvedValueOnce({
        status: 200,
        status_text: '200 OK',
        headers: { 'content-type': 'application/json' },
        body: '{"data":{"token":"abc"}}',
        time: 12,
        size: 24,
      })
      .mockImplementationOnce(async (payload) => {
        expect(payload.headers?.Authorization).toBe('Bearer abc');
        return {
          status: 200,
          status_text: '200 OK',
          headers: { 'content-type': 'application/json' },
          body: '{"tags":["go","cli"]}',
          time: 8,
          size: 21,
        };
      });

    const run = await runLocalFlow(
      {
        flowId: 7,
        runId: -1,
        steps,
        edges,
      },
      execute
    );

    expect(execute).toHaveBeenCalledTimes(2);
    expect(run.execution_mode).toBe('local');
    expect(run.status).toBe('passed');
    expect(run.step_results).toHaveLength(2);
    expect(run.step_results?.[0].status).toBe('passed');
    expect(run.step_results?.[0].variables_captured).toContain('"token":"abc"');
    expect(run.step_results?.[1].status).toBe('passed');
  });

  it('fails the step when unresolved variables remain in the flow draft', async () => {
    const execute = vi.fn();

    const run = await runLocalFlow(
      {
        flowId: 9,
        runId: -2,
        steps: [
          {
            id: 1,
            name: 'Broken step',
            sort_order: 0,
            method: 'GET',
            url: 'http://127.0.0.1:3000/{{missingToken}}',
            headers: '',
            body: '',
            captures: '',
            asserts: '',
          },
        ],
        edges: [],
      },
      execute
    );

    expect(execute).not.toHaveBeenCalled();
    expect(run.status).toBe('failed');
    expect(run.step_results?.[0].error_message).toContain('unresolved variables: missingToken');
  });

  it('turns local bridge errors into failed step results instead of throwing', async () => {
    const execute = vi.fn().mockRejectedValue(new Error('Local runner unavailable.'));

    const run = await runLocalFlow(
      {
        flowId: 5,
        runId: -3,
        steps: [
          {
            id: 3,
            name: 'Bridge step',
            sort_order: 0,
            method: 'GET',
            url: 'http://127.0.0.1:3000/health',
            headers: '',
            body: '',
            captures: '',
            asserts: 'status == 200',
          },
        ],
        edges: [],
      },
      execute
    );

    expect(run.status).toBe('failed');
    expect(run.step_results?.[0].status).toBe('failed');
    expect(run.step_results?.[0].error_message).toContain('Local runner unavailable.');
  });
});
