import request from '@/http';
import type {
  CreateTestCaseFromSpecRequest,
  CreateTestCaseRequest,
  DuplicateTestCaseRequest,
  ProjectTestCase,
  RunTestCaseRequest,
  RunTestCaseResponse,
  TestCaseListParams,
  TestCaseListResponse,
  TestCaseRun,
  TestCaseRunListParams,
  TestCaseRunListResponse,
  UpdateTestCaseRequest,
} from '@/types/test-case';

const normalizePayload = <T extends object>(payload: T) =>
  Object.fromEntries(
    Object.entries(payload as Record<string, unknown>).filter(([, value]) => value !== undefined)
  ) as T;

export const testCaseService = {
  list: ({
    projectId,
    page = 1,
    pageSize = 10,
    apiSpecId,
    env,
    keyword,
  }: TestCaseListParams) =>
    request.get<TestCaseListResponse>(`/workspaces/${projectId}/test-cases`, {
      params: normalizePayload({
        page,
        page_size: pageSize,
        api_spec_id: apiSpecId,
        env,
        keyword,
      }),
    }),

  getById: (projectId: number | string, testCaseId: number | string) =>
    request.get<ProjectTestCase>(`/workspaces/${projectId}/test-cases/${testCaseId}`),

  create: (projectId: number | string, data: CreateTestCaseRequest) =>
    request.post<ProjectTestCase>(
      `/workspaces/${projectId}/test-cases`,
      normalizePayload(data)
    ),

  update: (
    projectId: number | string,
    testCaseId: number | string,
    data: UpdateTestCaseRequest
  ) =>
    request.patch<ProjectTestCase>(
      `/workspaces/${projectId}/test-cases/${testCaseId}`,
      normalizePayload(data)
    ),

  delete: (projectId: number | string, testCaseId: number | string) =>
    request.delete<void>(`/workspaces/${projectId}/test-cases/${testCaseId}`),

  duplicate: (
    projectId: number | string,
    testCaseId: number | string,
    data: DuplicateTestCaseRequest
  ) =>
    request.post<ProjectTestCase>(
      `/workspaces/${projectId}/test-cases/${testCaseId}/duplicate`,
      data
    ),

  fromSpec: (projectId: number | string, data: CreateTestCaseFromSpecRequest) =>
    request.post<ProjectTestCase>(
      `/workspaces/${projectId}/test-cases/from-spec`,
      normalizePayload(data)
    ),

  run: (
    projectId: number | string,
    testCaseId: number | string,
    data: RunTestCaseRequest
  ) =>
    request.post<RunTestCaseResponse>(
      `/workspaces/${projectId}/test-cases/${testCaseId}/run`,
      normalizePayload(data)
    ),

  listRuns: ({
    projectId,
    testCaseId,
    page = 1,
    pageSize = 10,
    status,
  }: TestCaseRunListParams) =>
    request.get<TestCaseRunListResponse>(
      `/workspaces/${projectId}/test-cases/${testCaseId}/runs`,
      {
        params: normalizePayload({
          page,
          page_size: pageSize,
          status,
        }),
      }
    ),

  getRunById: (
    projectId: number | string,
    testCaseId: number | string,
    runId: number | string
  ) =>
    request.get<TestCaseRun>(
      `/workspaces/${projectId}/test-cases/${testCaseId}/runs/${runId}`
    ),
};

export type TestCaseService = typeof testCaseService;
