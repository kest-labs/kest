/**
 * React Query Hooks for Kest API
 * Provides data fetching, caching, and mutations
 */

import { useQuery, useMutation, useQueryClient, type UseQueryOptions } from '@tanstack/react-query'
import { kestApi } from '@/services/kest-api.service'
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
    SyncRequest,
    SyncResponse,
    AuditLog,
    PaginatedResponse,
} from '@/types/kest-api'

// ========== Query Keys ==========

export const queryKeys = {
    projects: ['projects'] as const,
    project: (id: number) => ['projects', id] as const,

    environments: (projectId: number) => ['environments', projectId] as const,

    apiSpecs: (projectId: number) => ['api-specs', projectId] as const,
    apiSpec: (id: number) => ['api-specs', id] as const,
    apiSpecWithExamples: (id: number) => ['api-specs', id, 'examples'] as const,

    categories: (projectId: number) => ['categories', projectId] as const,
    categoryTree: (projectId: number) => ['categories', projectId, 'tree'] as const,
    category: (projectId: number, categoryId: number) => ['categories', projectId, categoryId] as const,

    testCases: (apiSpecId: number) => ['test-cases', apiSpecId] as const,
    testCase: (id: number) => ['test-cases', id] as const,

    testCollections: (projectId: number) => ['test-collections', projectId] as const,
    testCollection: (id: number) => ['test-collections', id] as const,
    testCollectionRuns: (collectionId: number) => ['test-runs', collectionId] as const,

    auditLogs: (params?: any) => ['audit-logs', params] as const,
}

// ========== Project Hooks ==========

export function useProjects(options?: UseQueryOptions<PaginatedResponse<Project>>) {
    return useQuery({
        queryKey: queryKeys.projects,
        queryFn: () => kestApi.project.list(),
        ...options,
    })
}

export function useProject(id: number, options?: UseQueryOptions<Project>) {
    return useQuery({
        queryKey: queryKeys.project(id),
        queryFn: () => kestApi.project.get(id),
        enabled: !!id,
        ...options,
    })
}


export function useCreateProject() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (data: CreateProjectRequest) => kestApi.project.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.projects })
        },
    })
}

export function useUpdateProject() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: ({ id, data }: { id: number; data: UpdateProjectRequest }) =>
            kestApi.project.update(id, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.projects })
            queryClient.invalidateQueries({ queryKey: queryKeys.project(variables.id) })
        },
    })
}

export function useDeleteProject() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (id: number) => kestApi.project.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.projects })
        },
    })
}

// ========== Environment Hooks ==========

export function useEnvironments(projectId: number) {
    return useQuery({
        queryKey: queryKeys.environments(projectId),
        queryFn: () => kestApi.environment.list(projectId),
        enabled: !!projectId,
    })
}

// ========== API Spec Hooks ==========

export function useAPISpecs(projectId: number, page = 1, pageSize = 50) {
    return useQuery({
        queryKey: [...queryKeys.apiSpecs(projectId), page, pageSize],
        queryFn: () => kestApi.apiSpec.list(projectId, { page, page_size: pageSize }),
        enabled: !!projectId,
    })
}

export function useAllAPISpecs(projectId: number) {
    return useQuery({
        queryKey: queryKeys.apiSpecs(projectId),
        queryFn: () => kestApi.apiSpec.list(projectId, { page_size: 1000 }), // Using large page_size for "all"
        enabled: !!projectId,
    })
}

export function useAPISpec(projectId: number, id: number) {
    return useQuery({
        queryKey: queryKeys.apiSpec(id),
        queryFn: () => kestApi.apiSpec.get(projectId, id),
        enabled: !!id && !!projectId,
    })
}

export function useAPISpecWithExamples(projectId: number, id: number) {
    return useQuery({
        queryKey: queryKeys.apiSpecWithExamples(id),
        queryFn: () => kestApi.apiSpec.getWithExamples(projectId, id),
        enabled: !!id && !!projectId,
    })
}

export function useCreateAPISpec() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: ({ projectId, data }: { projectId: number; data: Omit<CreateAPISpecRequest, 'project_id'> }) =>
            kestApi.apiSpec.create(projectId, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.apiSpecs(variables.projectId) })
        },
    })
}

export function useUpdateAPISpec() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: ({ projectId, id, data }: { projectId: number; id: number; data: UpdateAPISpecRequest }) =>
            kestApi.apiSpec.update(projectId, id, data),
        onSuccess: (result) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.apiSpec(result.id) })
            queryClient.invalidateQueries({ queryKey: queryKeys.apiSpecs(result.project_id) })
        },
    })
}

export function useDeleteAPISpec() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: ({ projectId, id }: { projectId: number; id: number }) =>
            kestApi.apiSpec.delete(projectId, id),
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.projects })
            queryClient.invalidateQueries({ queryKey: queryKeys.apiSpecs(variables.projectId) })
        },
    })
}

// ========== Test Case Hooks ==========

export function useTestCases(projectId: number, apiSpecId: number) {
    return useQuery({
        queryKey: queryKeys.testCases(apiSpecId),
        queryFn: () => kestApi.testCase.list(projectId, apiSpecId),
        enabled: !!projectId && !!apiSpecId,
    })
}

export function useTestCase(projectId: number, id: number) {
    return useQuery({
        queryKey: queryKeys.testCase(id),
        queryFn: () => kestApi.testCase.get(projectId, id),
        enabled: !!projectId && !!id,
    })
}

export function useCreateTestCase(projectId: number) {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (data: CreateTestCaseRequest) => kestApi.testCase.create(projectId, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.testCases(variables.api_spec_id) })
        },
    })
}

export function useRunTestCase(projectId: number) {
    return useMutation({
        mutationFn: ({ id, environment }: { id: number; environment?: string }) =>
            kestApi.testCase.run(projectId, id, environment),
    })
}

// ========== Test Collection Hooks ==========

export function useTestCollections(projectId: number) {
    return useQuery({
        queryKey: queryKeys.testCollections(projectId),
        queryFn: () => kestApi.testCollection.list(projectId),
        enabled: !!projectId,
    })
}

export function useTestCollection(id: number) {
    return useQuery({
        queryKey: queryKeys.testCollection(id),
        queryFn: () => kestApi.testCollection.get(id),
        enabled: !!id,
    })
}

export function useCreateTestCollection() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (data: CreateTestCollectionRequest) => kestApi.testCollection.create(data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.testCollections(variables.project_id) })
        },
    })
}

export function useRunTestCollection() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (id: number) => kestApi.testCollection.run(id),
        onSuccess: (_, collectionId) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.testCollectionRuns(collectionId) })
        },
    })
}

export function useTestCollectionRuns(collectionId: number) {
    return useQuery({
        queryKey: queryKeys.testCollectionRuns(collectionId),
        queryFn: () => kestApi.testCollection.getRuns(collectionId),
        enabled: !!collectionId,
    })
}

// ========== Category Hooks ==========

export function useCategories(projectId: number, params?: {
    page?: number
    per_page?: number
    search?: string
    include_count?: boolean
}) {
    return useQuery({
        queryKey: [...queryKeys.categories(projectId), params],
        queryFn: () => kestApi.category.list(projectId, params),
        enabled: !!projectId,
    })
}

export function useCategoryTree(projectId: number) {
    const buildTree = (list: APICategory[]): CategoryTree[] => {
        const nodeMap = new Map<number, CategoryTree>()
        const roots: CategoryTree[] = []

        list.forEach((item) => {
            nodeMap.set(item.id, { ...item, children: [] })
        })

        nodeMap.forEach((node) => {
            if (node.parent_id && nodeMap.has(node.parent_id)) {
                nodeMap.get(node.parent_id)!.children!.push(node)
                return
            }
            roots.push(node)
        })

        return roots
    }

    return useQuery({
        queryKey: queryKeys.categoryTree(projectId),
        queryFn: async () => {
            const res = await kestApi.category.tree(projectId)
            const items = Array.isArray((res as any)?.items)
                ? (res as any).items
                : (Array.isArray(res) ? res : [])
            return buildTree(items)
        },
        enabled: !!projectId,
    })
}

export function useCategory(projectId: number, categoryId: number) {
    return useQuery({
        queryKey: queryKeys.category(projectId, categoryId),
        queryFn: () => kestApi.category.get(projectId, categoryId),
        enabled: !!projectId && !!categoryId,
    })
}

export function useCreateCategory() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ projectId, data }: { projectId: number; data: CreateCategoryRequest }) =>
            kestApi.category.create(projectId, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.categories(variables.projectId) })
            queryClient.invalidateQueries({ queryKey: queryKeys.categoryTree(variables.projectId) })
        },
    })
}

export function useUpdateCategory() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({
            projectId,
            categoryId,
            data,
        }: {
            projectId: number
            categoryId: number
            data: UpdateCategoryRequest
        }) => kestApi.category.update(projectId, categoryId, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.categories(variables.projectId) })
            queryClient.invalidateQueries({ queryKey: queryKeys.categoryTree(variables.projectId) })
            queryClient.invalidateQueries({
                queryKey: queryKeys.category(variables.projectId, variables.categoryId),
            })
        },
    })
}

export function useDeleteCategory() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({
            projectId,
            categoryId,
            moveTo,
        }: {
            projectId: number
            categoryId: number
            moveTo?: number
        }) => kestApi.category.delete(projectId, categoryId, moveTo),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.categories(variables.projectId) })
            queryClient.invalidateQueries({ queryKey: queryKeys.categoryTree(variables.projectId) })
        },
    })
}

// ========== Test Execution Hooks ==========

export function useExecuteTest() {
    return useMutation({
        mutationFn: (data: TestExecutionRequest) => kestApi.testExecution.execute(data),
    })
}

// ========== Audit Log Hooks ==========

export function useAuditLogs(params?: {
    page?: number
    page_size?: number
    action?: string
    resource?: string
    user_id?: number
    start_time?: string
    end_time?: string
}) {
    return useQuery({
        queryKey: queryKeys.auditLogs(params),
        queryFn: () => kestApi.audit.list(params),
    })
}

// ========== Export all hooks ==========

export const useKestApi = {
    // Projects
    useProjects,
    useProject,
    useCreateProject,
    useUpdateProject,
    useDeleteProject,

    // Environments
    useEnvironments,

    // API Specs
    useAPISpecs,
    useAllAPISpecs,
    useAPISpec,
    useAPISpecWithExamples,
    useCreateAPISpec,
    useUpdateAPISpec,
    useDeleteAPISpec,

    // Test Cases
    useTestCases,
    useTestCase,
    useCreateTestCase,
    useRunTestCase,

    // Test Collections
    useTestCollections,
    useTestCollection,
    useCreateTestCollection,
    useRunTestCollection,
    useTestCollectionRuns,

    // Categories
    useCategories,
    useCategoryTree,
    useCategory,
    useCreateCategory,
    useUpdateCategory,
    useDeleteCategory,

    // Test Execution
    useExecuteTest,

    // Audit Logs
    useAuditLogs,
}
