import { describe, expect, it } from 'vitest';
import {
  getHistoryDisplayMessage,
  getHistorySidebarDescription,
  getHistorySidebarDuration,
  getHistorySidebarSearchTerms,
  getHistorySidebarStatus,
  getHistorySidebarStepSummary,
  getHistorySidebarTitle,
} from '@/components/features/workspace/workspace-history-summary';
import type { WorkspaceHistory } from '@/types/history';

const baseHistory: WorkspaceHistory = {
  id: 'history-1',
  entity_type: 'request',
  entity_id: 'entity-1',
  workspace_id: 'workspace-1',
  user_id: 'user-1',
  action: 'run',
  message: '',
  created_at: '2026-06-01T10:00:00Z',
};

describe('workspace history sidebar summary', () => {
  it('summarizes saved request runs by method and short path', () => {
    const history: WorkspaceHistory = {
      ...baseHistory,
      message: '已执行 GET {{base_url}}/health（404）',
      data: {
        request: {
          method: 'get',
          url: '{{base_url}}/health',
        },
        runner: {
          mode: 'local',
        },
        response: {
          status: 404,
          time: 31,
        },
      },
    };

    expect(getHistorySidebarTitle(history)).toBe('GET /health');
    expect(getHistorySidebarStatus(history)).toBe('404');
    expect(getHistorySidebarDuration(history)).toBe('31ms');
    expect(getHistorySidebarDescription(history)).toBe('local');
    expect(getHistoryDisplayMessage(history)).toBe('GET /health · HTTP 404 · 31ms');
    expect(getHistorySidebarSearchTerms(history)).toContain('GET /health');
  });

  it('summarizes CLI flow history with a file name instead of an id or full path', () => {
    const history: WorkspaceHistory = {
      ...baseHistory,
      entity_type: 'flow',
      entity_id: '6d5bf693-f333-4f62-a46b-d8e37c1b0000',
      source: 'cli',
      action: 'run',
      message: 'CLI flow /Users/mingde/Downloads/kest-cli-sync/local-smoke.flow.md passed',
      data: {
        run: {
          source_path: '/Users/mingde/Downloads/kest-cli-sync/local-smoke.flow.md',
          status: 'passed',
          total_steps: 2,
          passed_steps: 2,
          duration_ms: 812,
        },
      },
    };

    expect(getHistorySidebarTitle(history)).toBe('local-smoke.flow.md');
    expect(getHistorySidebarStatus(history)).toBe('passed');
    expect(getHistorySidebarStepSummary(history)).toBe('2/2');
    expect(getHistorySidebarDuration(history)).toBe('812ms');
    expect(getHistorySidebarDescription(history)).toBe('CLI flow');
    expect(getHistoryDisplayMessage(history)).toBe('CLI flow · local-smoke.flow.md · passed');
  });
});
