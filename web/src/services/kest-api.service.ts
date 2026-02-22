/**
 * Kest API Service
 * Provides methods to interact with kest-api backend
 */

import request from '@/http'
import type {
    Project,
    CreateProjectRequest,
    UpdateProjectRequest,
    Environment,
    CreateEnvironmentRequest,
    APISpec,
    CreateAPISpecRequest,
    UpdateAPISpecRequest,
    APIExample,
    APICategory,
    CreateCategoryRequest,
    UpdateCategoryRequest,
    CategoryTree,
    TestCase,
    CreateTestCaseRequest,
    TestCollection,
    CreateTestCollectionRequest,
    TestExecutionRequest,
    TestExecutionResponse,
    TestRun,
    SyncRequest,
    SyncResponse,
    PaginatedResponse,
    AuditLog,
} from '@/types/kest-api'

// ========== Project APIs ==========

export const projectApi = {
    /**
     * Get all projects
     */
    list: (params?: { page?: number; per_page?: number; search?: string; platform?: string; status?: number }) =>
        request.get<PaginatedResponse<Project>>('/v1/projects', { params }),

    /**
     * Get project by ID
     */
    get: (id: number) => request.get<Project>(`/v1/projects/${id}`),

    /**
     * Create new project
     */
    create: (data: CreateProjectRequest) =>
        request.post<Project>('/v1/projects', data),

    /**
     * Update project
     */
    update: (id: number, data: UpdateProjectRequest) =>
        request.put<Project>(`/v1/projects/${id}`, data),

    /**
     * Delete project
     */
    delete: (id: number) => request.delete(`/v1/projects/${id}`),

    /**
     * Get project DSN
     */
    getDSN: (id: number) =>
        request.get<{ dsn: string; public_key: string; project_id: number; environment?: string }>(`/v1/projects/${id}/dsn`),
}

// ========== Environment APIs ==========

export const environmentApi = {
    /**
     * Get environments for a project
     */
    list: (projectId: number) =>
        request.get<Environment[]>(`/v1/projects/${projectId}/environments`),

    /**
     * Create environment
     */
    create: (projectId: number, data: CreateEnvironmentRequest) =>
        request.post<Environment>(`/v1/projects/${projectId}/environments`, data),

    /**
     * Update environment
     */
    update: (projectId: number, id: number, data: Partial<CreateEnvironmentRequest>) =>
        request.patch<Environment>(`/v1/projects/${projectId}/environments/${id}`, data),

    /**
     * Delete environment
     */
    delete: (projectId: number, id: number) => request.delete(`/v1/projects/${projectId}/environments/${id}`),
}

// ========== API Spec APIs ==========

export const apiSpecApi = {
    /**
     * List API specs for a project
     */
    list: (projectId: number, params?: {
        version?: string
        page?: number
        page_size?: number
    }) =>
        request.get<PaginatedResponse<APISpec>>(`/v1/projects/${projectId}/api-specs`, {
            params,
        }),

    /**
     * Get API spec by ID
     */
    get: (projectId: number, id: number) =>
        request.get<APISpec>(`/v1/projects/${projectId}/api-specs/${id}`),

    /**
     * Get API spec with examples
     */
    getWithExamples: (projectId: number, id: number) =>
        request.get<APISpec>(`/v1/projects/${projectId}/api-specs/${id}/full`),

    /**
     * Create API spec
     */
    create: (projectId: number, data: Omit<CreateAPISpecRequest, 'project_id'>) =>
        request.post<APISpec>(`/v1/projects/${projectId}/api-specs`, data),

    /**
     * Update API spec
     */
    update: (projectId: number, id: number, data: UpdateAPISpecRequest) =>
        request.patch<APISpec>(`/v1/projects/${projectId}/api-specs/${id}`, data),

    /**
     * Delete API spec
     */
    delete: (projectId: number, id: number) =>
        request.delete(`/v1/projects/${projectId}/api-specs/${id}`),

    /**
     * Batch import API specs
     */
    import: (projectId: number, specs: CreateAPISpecRequest[]) =>
        request.post<{ message: string }>(`/v1/projects/${projectId}/api-specs/import`, { specs }),

    /**
     * Export API specs
     */
    export: (projectId: number, format: 'json' | 'openapi' | 'markdown') =>
        request.get(`/v1/projects/${projectId}/api-specs/export`, {
            params: { format },
        }),

    /**
     * Add example to API spec
     */
    addExample: (projectId: number, apiSpecId: number, data: {
        name: string
        request_headers?: Record<string, string>
        request_body?: any
        response_status: number
        response_body?: any
        duration_ms?: number
    }) => request.post<APIExample>(`/v1/projects/${projectId}/api-specs/${apiSpecId}/examples`, data),
}

// ========== Test Case APIs ==========

export const testCaseApi = {
    /**
     * List test cases for an API
     */
    list: (projectId: number, apiSpecId?: number) =>
        request.get<TestCase[]>(`/v1/projects/${projectId}/test-cases`, {
            params: { api_spec_id: apiSpecId },
        }),

    /**
     * Get test case by ID
     */
    get: (projectId: number, id: number) =>
        request.get<TestCase>(`/v1/projects/${projectId}/test-cases/${id}`),

    /**
     * Create test case
     */
    create: (projectId: number, data: CreateTestCaseRequest) =>
        request.post<TestCase>(`/v1/projects/${projectId}/test-cases`, data),

    /**
     * Update test case
     */
    update: (projectId: number, id: number, data: Partial<CreateTestCaseRequest>) =>
        request.patch<TestCase>(`/v1/projects/${projectId}/test-cases/${id}`, data),

    /**
     * Delete test case
     */
    delete: (projectId: number, id: number) =>
        request.delete(`/v1/projects/${projectId}/test-cases/${id}`),

    /**
     * Run a single test case
     */
    run: (projectId: number, id: number, environment?: string) =>
        request.post<TestExecutionResponse>(`/v1/projects/${projectId}/test-cases/${id}/run`, {
            environment,
        }),
}

// ========== Test Collection APIs ==========

export const testCollectionApi = {
    /**
     * List test collections for a project
     */
    list: (projectId: number) =>
        request.get<TestCollection[]>(`/v1/projects/${projectId}/collections`),

    /**
     * Get test collection by ID
     */
    get: (id: number) =>
        request.get<TestCollection>(`/v1/test-collections/${id}`),

    /**
     * Create test collection
     */
    create: (data: CreateTestCollectionRequest) =>
        request.post<TestCollection>('/v1/test-collections', data),

    /**
     * Update test collection
     */
    update: (id: number, data: Partial<CreateTestCollectionRequest>) =>
        request.patch<TestCollection>(`/v1/test-collections/${id}`, data),

    /**
     * Delete test collection
     */
    delete: (id: number) => request.delete(`/v1/test-collections/${id}`),

    /**
     * Run test collection
     */
    run: (id: number) =>
        request.post<TestRun>(`/v1/test-collections/${id}/run`),

    /**
     * Get test runs for a collection
     */
    getRuns: (collectionId: number, params?: { page?: number; page_size?: number }) =>
        request.get<PaginatedResponse<TestRun>>(
            `/v1/test-collections/${collectionId}/runs`,
            { params }
        ),
}

// ========== Test Execution APIs ==========

export const testExecutionApi = {
    /**
     * Execute a test (real-time API testing)
     */
    execute: (data: TestExecutionRequest) =>
        request.post<TestExecutionResponse>('/v1/test/execute', data),

    /**
     * Get test run details
     */
    getRun: (id: number) => request.get<TestRun>(`/v1/test-runs/${id}`),
}

// ========== CLI Sync APIs ==========

export const syncApi = {
    /**
     * Sync APIs from CLI
     */
    sync: (data: SyncRequest) =>
        request.post<SyncResponse>('/v1/sync/apis', data),

    /**
     * Get sync history
     */
    history: (projectId: number) =>
        request.get(`/v1/sync/history`, {
            params: { project_id: projectId },
        }),
}

// ========== Category APIs ==========

export const categoryApi = {
    /**
     * Get all categories for a project
     */
    list: (projectId: number) =>
        request.get<PaginatedResponse<APICategory>>(
            `/v1/projects/${projectId}/categories`
        ),

    /**
     * Get category tree for a project
     */
    tree: (projectId: number) =>
        request.get<{ items: CategoryTree[]; total: number }>(
            `/v1/projects/${projectId}/categories?tree=true`
        ),

    /**
     * Get category by ID
     */
    get: (projectId: number, categoryId: number) =>
        request.get<APICategory>(
            `/v1/projects/${projectId}/categories/${categoryId}`
        ),

    /**
     * Create new category
     */
    create: (projectId: number, data: CreateCategoryRequest) =>
        request.post<APICategory>(
            `/v1/projects/${projectId}/categories`,
            data
        ),

    /**
     * Update category
     */
    update: (projectId: number, categoryId: number, data: UpdateCategoryRequest) =>
        request.patch<APICategory>(
            `/v1/projects/${projectId}/categories/${categoryId}`,
            data
        ),

    /**
     * Delete category
     */
    delete: (projectId: number, categoryId: number) =>
        request.delete(`/v1/projects/${projectId}/categories/${categoryId}`),

    /**
     * Sort categories
     */
    sort: (projectId: number, categoryIds: number[]) =>
        request.put(`/v1/projects/${projectId}/categories/sort`, {
            category_ids: categoryIds,
        }),
}

// ========== Audit Log APIs ==========

export const auditApi = {
    /**
     * Get audit logs
     */
    list: (params?: {
        page?: number
        page_size?: number
        action?: string
        resource?: string
        user_id?: number
        start_time?: string
        end_time?: string
    }) =>
        request.get<PaginatedResponse<AuditLog>>('/v1/audit-logs', {
            params,
        }),
}

// ========== Export all APIs ==========

export const kestApi = {
    project: projectApi,
    environment: environmentApi,
    apiSpec: apiSpecApi,
    category: categoryApi,
    testCase: testCaseApi,
    testCollection: testCollectionApi,
    testExecution: testExecutionApi,
    sync: syncApi,
    audit: auditApi,
}

export default kestApi
