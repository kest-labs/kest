'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useT } from '@/i18n/client';
import { testCaseService } from '@/services/test-case';
import type {
  CreateTestCaseFromSpecRequest,
  CreateTestCaseRequest,
  DuplicateTestCaseRequest,
  RunTestCaseRequest,
  TestCaseListParams,
  TestCaseRunListParams,
  UpdateTestCaseRequest,
} from '@/types/test-case';

export const testCaseKeys = {
  all: ['test-cases'] as const,
  workspace: (workspaceId: number | string) => [...testCaseKeys.all, 'workspace', workspaceId] as const,
  lists: (workspaceId: number | string) => [...testCaseKeys.workspace(workspaceId), 'lists'] as const,
  list: (params: TestCaseListParams) => [...testCaseKeys.lists(params.workspaceId), params] as const,
  detail: (workspaceId: number | string, testCaseId: number | string) =>
    [...testCaseKeys.workspace(workspaceId), 'detail', testCaseId] as const,
  runs: (workspaceId: number | string, testCaseId: number | string) =>
    [...testCaseKeys.workspace(workspaceId), 'runs', testCaseId] as const,
  runList: (params: TestCaseRunListParams) =>
    [...testCaseKeys.runs(params.workspaceId, params.testCaseId), 'list', params] as const,
  run: (
    workspaceId: number | string,
    testCaseId: number | string,
    runId: number | string
  ) => [...testCaseKeys.runs(workspaceId, testCaseId), 'detail', runId] as const,
};

export function useTestCases(params: TestCaseListParams) {
  return useQuery({
    queryKey: testCaseKeys.list(params),
    queryFn: () => testCaseService.list(params),
    placeholderData: (previousData) => previousData,
  });
}

export function useTestCase(workspaceId?: number | string, testCaseId?: number | string) {
  return useQuery({
    queryKey: testCaseKeys.detail(workspaceId ?? 'unknown', testCaseId ?? 'unknown'),
    queryFn: () => testCaseService.getById(workspaceId as number | string, testCaseId as number | string),
    enabled:
      workspaceId !== undefined &&
      workspaceId !== null &&
      testCaseId !== undefined &&
      testCaseId !== null,
  });
}

export function useTestCaseRuns(params?: TestCaseRunListParams) {
  return useQuery({
    queryKey: testCaseKeys.runList(
      params ?? { workspaceId: 'unknown', testCaseId: 'unknown' }
    ),
    queryFn: () => testCaseService.listRuns(params as TestCaseRunListParams),
    enabled: Boolean(params?.workspaceId && params?.testCaseId),
    placeholderData: (previousData) => previousData,
  });
}

export function useTestCaseRun(
  workspaceId?: number | string,
  testCaseId?: number | string,
  runId?: number | string
) {
  return useQuery({
    queryKey: testCaseKeys.run(workspaceId ?? 'unknown', testCaseId ?? 'unknown', runId ?? 'unknown'),
    queryFn: () =>
      testCaseService.getRunById(
        workspaceId as number | string,
        testCaseId as number | string,
        runId as number | string
      ),
    enabled:
      workspaceId !== undefined &&
      workspaceId !== null &&
      testCaseId !== undefined &&
      testCaseId !== null &&
      runId !== undefined &&
      runId !== null,
  });
}

export function useCreateTestCase(workspaceId: number | string) {
  const queryClient = useQueryClient();
  const t = useT();

  return useMutation({
    mutationFn: (data: CreateTestCaseRequest) => testCaseService.create(workspaceId, data),
    onSuccess: (testCase) => {
      queryClient.invalidateQueries({ queryKey: testCaseKeys.lists(workspaceId) });
      queryClient.setQueryData(
        testCaseKeys.detail(workspaceId, testCase.id),
        testCase
      );
      toast.success(t.project('toasts.testCaseCreated', { name: testCase.name }));
    },
  });
}

export function useUpdateTestCase(workspaceId: number | string) {
  const queryClient = useQueryClient();
  const t = useT();

  return useMutation({
    mutationFn: ({
      testCaseId,
      data,
    }: {
      testCaseId: number | string;
      data: UpdateTestCaseRequest;
    }) => testCaseService.update(workspaceId, testCaseId, data),
    onSuccess: (testCase) => {
      queryClient.invalidateQueries({ queryKey: testCaseKeys.lists(workspaceId) });
      queryClient.setQueryData(
        testCaseKeys.detail(workspaceId, testCase.id),
        testCase
      );
      toast.success(t.project('toasts.testCaseUpdated', { name: testCase.name }));
    },
  });
}

export function useDeleteTestCase(workspaceId: number | string) {
  const queryClient = useQueryClient();
  const t = useT();

  return useMutation({
    mutationFn: (testCaseId: number | string) => testCaseService.delete(workspaceId, testCaseId),
    onSuccess: (_, testCaseId) => {
      queryClient.invalidateQueries({ queryKey: testCaseKeys.lists(workspaceId) });
      queryClient.removeQueries({
        queryKey: testCaseKeys.detail(workspaceId, testCaseId),
      });
      queryClient.removeQueries({
        queryKey: testCaseKeys.runs(workspaceId, testCaseId),
      });
      toast.success(t.project('toasts.testCaseDeleted'));
    },
  });
}

export function useDuplicateTestCase(workspaceId: number | string) {
  const queryClient = useQueryClient();
  const t = useT();

  return useMutation({
    mutationFn: ({
      testCaseId,
      data,
    }: {
      testCaseId: number | string;
      data: DuplicateTestCaseRequest;
    }) => testCaseService.duplicate(workspaceId, testCaseId, data),
    onSuccess: (testCase) => {
      queryClient.invalidateQueries({ queryKey: testCaseKeys.lists(workspaceId) });
      queryClient.setQueryData(
        testCaseKeys.detail(workspaceId, testCase.id),
        testCase
      );
      toast.success(t.project('toasts.testCaseDuplicated', { name: testCase.name }));
    },
  });
}

export function useCreateTestCaseFromSpec(workspaceId: number | string) {
  const queryClient = useQueryClient();
  const t = useT();

  return useMutation({
    mutationFn: (data: CreateTestCaseFromSpecRequest) => testCaseService.fromSpec(workspaceId, data),
    onSuccess: (testCase) => {
      queryClient.invalidateQueries({ queryKey: testCaseKeys.lists(workspaceId) });
      queryClient.setQueryData(
        testCaseKeys.detail(workspaceId, testCase.id),
        testCase
      );
      toast.success(t.project('toasts.testCaseFromSpecCreated', { name: testCase.name }));
    },
  });
}

export function useRunTestCase(workspaceId: number | string) {
  const queryClient = useQueryClient();
  const t = useT();

  return useMutation({
    mutationFn: ({
      testCaseId,
      data,
    }: {
      testCaseId: number | string;
      data: RunTestCaseRequest;
    }) => testCaseService.run(workspaceId, testCaseId, data),
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({
        queryKey: testCaseKeys.runs(workspaceId, variables.testCaseId),
      });

      if (result.status === 'pass' || result.status === 'passed') {
        toast.success(t.project('toasts.testCaseRunPassed'));
        return;
      }

      toast.error(result.message || t.project('toasts.testCaseRunFinished', { status: result.status }));
    },
  });
}
