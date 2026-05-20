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
    workspaceId,
    page = 1,
    pageSize = 10,
    apiSpecId,
    env,
    keyword,
  }: TestCaseListParams) =>
    request.get<TestCaseListResponse>(`/workspaces/${workspaceId}/test-cases`, {
      params: normalizePayload({
        page,
        page_size: pageSize,
        api_spec_id: apiSpecId,
        env,
        keyword,
      }),
    }),

  getById: (workspaceId: number | string, testCaseId: number | string) =>
    request.get<ProjectTestCase>(`/workspaces/${workspaceId}/test-cases/${testCaseId}`),

  create: (workspaceId: number | string, data: CreateTestCaseRequest) =>
    request.post<ProjectTestCase>(
      `/workspaces/${workspaceId}/test-cases`,
      normalizePayload(data)
    ),

  update: (
    workspaceId: number | string,
    testCaseId: number | string,
    data: UpdateTestCaseRequest
  ) =>
    request.patch<ProjectTestCase>(
      `/workspaces/${workspaceId}/test-cases/${testCaseId}`,
      normalizePayload(data)
    ),

  delete: (workspaceId: number | string, testCaseId: number | string) =>
    request.delete<void>(`/workspaces/${workspaceId}/test-cases/${testCaseId}`),

  duplicate: (
    workspaceId: number | string,
    testCaseId: number | string,
    data: DuplicateTestCaseRequest
  ) =>
    request.post<ProjectTestCase>(
      `/workspaces/${workspaceId}/test-cases/${testCaseId}/duplicate`,
      data
    ),

  fromSpec: (workspaceId: number | string, data: CreateTestCaseFromSpecRequest) =>
    request.post<ProjectTestCase>(
      `/workspaces/${workspaceId}/test-cases/from-spec`,
      normalizePayload(data)
    ),

  run: (
    workspaceId: number | string,
    testCaseId: number | string,
    data: RunTestCaseRequest
  ) =>
    request.post<RunTestCaseResponse>(
      `/workspaces/${workspaceId}/test-cases/${testCaseId}/run`,
      normalizePayload(data)
    ),

  listRuns: ({
    workspaceId,
    testCaseId,
    page = 1,
    pageSize = 10,
    status,
  }: TestCaseRunListParams) =>
    request.get<TestCaseRunListResponse>(
      `/workspaces/${workspaceId}/test-cases/${testCaseId}/runs`,
      {
        params: normalizePayload({
          page,
          page_size: pageSize,
          status,
        }),
      }
    ),

  getRunById: (
    workspaceId: number | string,
    testCaseId: number | string,
    runId: number | string
  ) =>
    request.get<TestCaseRun>(
      `/workspaces/${workspaceId}/test-cases/${testCaseId}/runs/${runId}`
    ),
};

export type TestCaseService = typeof testCaseService;
