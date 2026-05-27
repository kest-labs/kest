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
  project: (projectId: number | string) => [...testCaseKeys.all, 'workspace', projectId] as const,
  lists: (projectId: number | string) => [...testCaseKeys.project(projectId), 'lists'] as const,
  list: (params: TestCaseListParams) => [...testCaseKeys.lists(params.projectId), params] as const,
  detail: (projectId: number | string, testCaseId: number | string) =>
    [...testCaseKeys.project(projectId), 'detail', testCaseId] as const,
  runs: (projectId: number | string, testCaseId: number | string) =>
    [...testCaseKeys.project(projectId), 'runs', testCaseId] as const,
  runList: (params: TestCaseRunListParams) =>
    [...testCaseKeys.runs(params.projectId, params.testCaseId), 'list', params] as const,
  run: (
    projectId: number | string,
    testCaseId: number | string,
    runId: number | string
  ) => [...testCaseKeys.runs(projectId, testCaseId), 'detail', runId] as const,
};

export function useTestCases(params: TestCaseListParams) {
  return useQuery({
    queryKey: testCaseKeys.list(params),
    queryFn: () => testCaseService.list(params),
    placeholderData: (previousData) => previousData,
  });
}

export function useTestCase(projectId?: number | string, testCaseId?: number | string) {
  return useQuery({
    queryKey: testCaseKeys.detail(projectId ?? 'unknown', testCaseId ?? 'unknown'),
    queryFn: () => testCaseService.getById(projectId as number | string, testCaseId as number | string),
    enabled:
      projectId !== undefined &&
      projectId !== null &&
      testCaseId !== undefined &&
      testCaseId !== null,
  });
}

export function useTestCaseRuns(params?: TestCaseRunListParams) {
  return useQuery({
    queryKey: testCaseKeys.runList(
      params ?? { projectId: 'unknown', testCaseId: 'unknown' }
    ),
    queryFn: () => testCaseService.listRuns(params as TestCaseRunListParams),
    enabled: Boolean(params?.projectId && params?.testCaseId),
    placeholderData: (previousData) => previousData,
  });
}

export function useTestCaseRun(
  projectId?: number | string,
  testCaseId?: number | string,
  runId?: number | string
) {
  return useQuery({
    queryKey: testCaseKeys.run(projectId ?? 'unknown', testCaseId ?? 'unknown', runId ?? 'unknown'),
    queryFn: () =>
      testCaseService.getRunById(
        projectId as number | string,
        testCaseId as number | string,
        runId as number | string
      ),
    enabled:
      projectId !== undefined &&
      projectId !== null &&
      testCaseId !== undefined &&
      testCaseId !== null &&
      runId !== undefined &&
      runId !== null,
  });
}

export function useCreateTestCase(projectId: number | string) {
  const queryClient = useQueryClient();
  const t = useT();

  return useMutation({
    mutationFn: (data: CreateTestCaseRequest) => testCaseService.create(projectId, data),
    onSuccess: (testCase) => {
      queryClient.invalidateQueries({ queryKey: testCaseKeys.lists(projectId) });
      queryClient.setQueryData(
        testCaseKeys.detail(projectId, testCase.id),
        testCase
      );
      toast.success(t.project('toasts.testCaseCreated', { name: testCase.name }));
    },
  });
}

export function useUpdateTestCase(projectId: number | string) {
  const queryClient = useQueryClient();
  const t = useT();

  return useMutation({
    mutationFn: ({
      testCaseId,
      data,
    }: {
      testCaseId: number | string;
      data: UpdateTestCaseRequest;
    }) => testCaseService.update(projectId, testCaseId, data),
    onSuccess: (testCase) => {
      queryClient.invalidateQueries({ queryKey: testCaseKeys.lists(projectId) });
      queryClient.setQueryData(
        testCaseKeys.detail(projectId, testCase.id),
        testCase
      );
      toast.success(t.project('toasts.testCaseUpdated', { name: testCase.name }));
    },
  });
}

export function useDeleteTestCase(projectId: number | string) {
  const queryClient = useQueryClient();
  const t = useT();

  return useMutation({
    mutationFn: (testCaseId: number | string) => testCaseService.delete(projectId, testCaseId),
    onSuccess: (_, testCaseId) => {
      queryClient.invalidateQueries({ queryKey: testCaseKeys.lists(projectId) });
      queryClient.removeQueries({
        queryKey: testCaseKeys.detail(projectId, testCaseId),
      });
      queryClient.removeQueries({
        queryKey: testCaseKeys.runs(projectId, testCaseId),
      });
      toast.success(t.project('toasts.testCaseDeleted'));
    },
  });
}

export function useDuplicateTestCase(projectId: number | string) {
  const queryClient = useQueryClient();
  const t = useT();

  return useMutation({
    mutationFn: ({
      testCaseId,
      data,
    }: {
      testCaseId: number | string;
      data: DuplicateTestCaseRequest;
    }) => testCaseService.duplicate(projectId, testCaseId, data),
    onSuccess: (testCase) => {
      queryClient.invalidateQueries({ queryKey: testCaseKeys.lists(projectId) });
      queryClient.setQueryData(
        testCaseKeys.detail(projectId, testCase.id),
        testCase
      );
      toast.success(t.project('toasts.testCaseDuplicated', { name: testCase.name }));
    },
  });
}

export function useCreateTestCaseFromSpec(projectId: number | string) {
  const queryClient = useQueryClient();
  const t = useT();

  return useMutation({
    mutationFn: (data: CreateTestCaseFromSpecRequest) => testCaseService.fromSpec(projectId, data),
    onSuccess: (testCase) => {
      queryClient.invalidateQueries({ queryKey: testCaseKeys.lists(projectId) });
      queryClient.setQueryData(
        testCaseKeys.detail(projectId, testCase.id),
        testCase
      );
      toast.success(t.project('toasts.testCaseFromSpecCreated', { name: testCase.name }));
    },
  });
}

export function useRunTestCase(projectId: number | string) {
  const queryClient = useQueryClient();
  const t = useT();

  return useMutation({
    mutationFn: ({
      testCaseId,
      data,
    }: {
      testCaseId: number | string;
      data: RunTestCaseRequest;
    }) => testCaseService.run(projectId, testCaseId, data),
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({
        queryKey: testCaseKeys.runs(projectId, variables.testCaseId),
      });

      if (result.status === 'pass' || result.status === 'passed') {
        toast.success(t.project('toasts.testCaseRunPassed'));
        return;
      }

      toast.error(result.message || t.project('toasts.testCaseRunFinished', { status: result.status }));
    },
  });
}
