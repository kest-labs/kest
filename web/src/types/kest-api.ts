/**
 * Kest Platform API Types
 * Matches backend API responses from kest-api
 */

// ========== Project Types ==========

export interface Project {
    id: number
    name: string
    slug: string
    description?: string // UI might use this even if backend doc doesn't explicitly list it in example, but good to keep
    base_url?: string // UI specific?
    public_key: string
    dsn: string
    platform: string
    status: number // 0=inactive, 1=active
    rate_limit_per_minute: number
    owner_id?: number // Doc doesn't show in response example but might be there
    created_at: string
    updated_at?: string
}

export interface CreateProjectRequest {
    name: string
    slug?: string
    platform?: string
    description?: string
}

export interface UpdateProjectRequest {
    name?: string
    platform?: string
    status?: number
    rate_limit_per_minute?: number
    description?: string
}

// ========== Member Types ==========

export type ProjectMemberRole = 'owner' | 'admin' | 'write' | 'read'

export interface ProjectMember {
    id: number
    project_id: number
    user_id: number
    role: ProjectMemberRole
    created_at: string
    updated_at: string
}

export interface AddMemberRequest {
    user_id: number
    role: ProjectMemberRole
}

export interface UpdateMemberRequest {
    role: ProjectMemberRole
}

// ========== Environment Types ==========

export interface Environment {
    id: number
    project_id: number
    name: string // 'development', 'test', 'production'
    base_url: string
    variables: Record<string, string>
    headers: Record<string, string>
    created_at: string
    updated_at: string
}

export interface CreateEnvironmentRequest {
    project_id: number
    name: string
    base_url: string
    variables?: Record<string, string>
    headers?: Record<string, string>
}

// ========== API Category Types ==========

export interface APICategory {
    id: number
    project_id: number
    name: string
    parent_id?: number
    sort_order: number
    description?: string
    color?: string
    icon?: string
    test_cases_count?: number
    parent_name?: string | null
    created_at: string
    updated_at: string
}

export interface CreateCategoryRequest {
    name: string
    parent_id?: number
    description?: string
    color?: string
    icon?: string
}

export interface UpdateCategoryRequest {
    name?: string
    parent_id?: number
    description?: string
    sort_order?: number
    color?: string
    icon?: string
}

export interface CategoryTree extends APICategory {
    children?: CategoryTree[]
}

// ========== API Spec Types ==========

export interface APISpec {
    id: number
    project_id: number
    category_id?: number
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'
    path: string
    summary: string
    description: string
    status?: 'undone' | 'done' | 'deprecated'
    tags: string[]
    version: string
    is_public: boolean
    doc_markdown?: string
    doc_source?: 'manual' | 'ai'
    doc_updated_at?: string

    // Request definition (single array, use 'in' field to distinguish: path, query, header, cookie)
    parameters?: Parameter[]
    request_body?: RequestBodySpec

    // Response definition
    responses?: Record<string, ResponseSpec>

    // Mock configuration
    mock_enabled?: boolean
    mock_data?: any

    // Examples
    examples?: APIExample[]

    // Metadata
    created_at: string
    updated_at: string
}

export interface Parameter {
    name: string
    in: 'query' | 'header' | 'path' | 'cookie'
    description?: string
    required: boolean
    schema: JSONSchema
    example?: any
}

export interface RequestBodySpec {
    description?: string
    required: boolean
    content_type: string // 'application/json', 'multipart/form-data', etc.
    schema: JSONSchema
}

export interface ResponseSpec {
    description: string
    content_type: string
    schema: JSONSchema
}

export interface JSONSchema {
    type: string
    properties?: Record<string, any>
    required?: string[]
    [key: string]: any
}

export interface APIExample {
    id: number
    api_spec_id: number
    name: string
    method?: string
    path?: string
    description?: string
    request_headers?: Record<string, string>
    request_body?: any
    response_headers?: Record<string, string>
    status_code?: number
    response_status: number
    response_body?: any
    duration_ms: number
    created_at: string
}

export interface CreateAPISpecRequest {
    project_id: number
    category_id?: number
    method: string
    path: string
    summary: string
    description?: string
    tags?: string[]
    version: string
    parameters?: Parameter[]
    request_body?: RequestBodySpec
    responses?: Record<string, ResponseSpec>
}

export interface UpdateAPISpecRequest {
    summary?: string
    description?: string
    tags?: string[]
    parameters?: Parameter[]
    request_body?: RequestBodySpec
    responses?: Record<string, ResponseSpec>
    is_public?: boolean
    doc_markdown?: string
    doc_source?: 'manual' | 'ai'
}

// ========== Test Types ==========

export interface TestCase {
    id: number
    api_spec_id?: number
    api_spec_name?: string
    name: string
    description?: string
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'
    path?: string
    environment?: string
    env?: string
    category_id?: number
    category_name?: string
    status?: 'active' | 'inactive' | 'archived'
    last_run_at?: string
    last_run_status?: 'passed' | 'failed' | 'running' | 'not_run'
    headers?: Record<string, string> // legacy
    request_headers?: Record<string, string>
    query_params?: Record<string, any>
    path_params?: Record<string, any>
    request_body?: any
    expected_status?: number
    expected_response?: any
    variables?: Record<string, any>
    setup_script?: string
    teardown_script?: string

    // Scripts
    pre_script?: string // JavaScript code
    post_script?: string // JavaScript code

    // Assertions
    assertions?: Assertion[]

    // Variable extraction
    extract_vars?: VariableExtraction[]

    created_at: string
    updated_at: string
}

export interface Assertion {
    type: 'status' | 'json_path' | 'response_time' | 'header' | 'custom'
    field?: string // legacy
    path?: string
    key?: string
    operator?: 'equals' | 'not_equals' | 'contains' | 'less_than' | 'greater_than' | 'exists'
    expect?: any // legacy
    value?: any
    actual?: any
    passed?: boolean
    custom_script?: string // For custom assertions
}

export interface VariableExtraction {
    name: string // Variable name
    path: string // JSONPath or header name
    type?: 'json' | 'header' | 'cookie'
}

export interface CreateTestCaseRequest {
    api_spec_id?: number
    name: string
    description?: string
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'
    path?: string
    environment?: string
    env?: string
    headers?: Record<string, string>
    request_headers?: Record<string, string>
    query_params?: Record<string, any>
    path_params?: Record<string, any>
    request_body?: any
    expected_status?: number
    expected_response?: any
    variables?: Record<string, any>
    setup_script?: string
    teardown_script?: string
    pre_script?: string
    post_script?: string
    assertions?: Assertion[]
    extract_vars?: VariableExtraction[]
}

export interface ListTestCasesParams {
    page?: number
    per_page?: number
    api_spec_id?: number
    env?: string
    keyword?: string
    status?: 'active' | 'inactive' | 'archived'
    category_id?: number
}

export interface UpdateTestCaseRequest extends Partial<CreateTestCaseRequest> {}

export interface DuplicateTestCaseRequest {
    name: string
    environment?: string
    description?: string
}

export interface GenerateTestCasesFromSpecRequest {
    api_spec_id: number
    environment?: string
    category_id?: number
    options?: {
        generate_positive_tests?: boolean
        generate_negative_tests?: boolean
        include_auth_tests?: boolean
        max_tests_per_endpoint?: number
    }
}

export interface GenerateTestCasesFromSpecResponse {
    generated: number
    updated: number
    test_cases: Array<{
        id: number
        name: string
        method: string
        path: string
    }>
}

export interface RunTestCaseRequest {
    environment?: string
    variables?: Record<string, any>
    async?: boolean
}

export interface RunTestCaseResponse {
    test_run_id?: string
    status?: string
    duration?: number
    started_at?: string
    completed_at?: string
    request?: {
        method?: string
        url?: string
        headers?: Record<string, string>
        body?: any
    }
    response?: {
        status?: number
        status_text?: string
        headers?: Record<string, string>
        body?: any
        response_time?: number
    }
    assertions?: Assertion[]
    error?: any
}

// ========== Test Collection Types ==========

export interface TestCollection {
    id: number
    project_id: number
    name: string
    description?: string
    test_case_ids: number[] // Ordered list
    global_vars?: Record<string, any>
    timeout: number
    parallel: boolean
    max_jobs: number
    schedule_cron?: string
    schedule_enabled: boolean
    created_at: string
    updated_at: string
}

export interface CreateTestCollectionRequest {
    project_id: number
    name: string
    description?: string
    test_case_ids: number[]
    global_vars?: Record<string, any>
    timeout?: number
    parallel?: boolean
    max_jobs?: number
}

// ========== Test Execution Types ==========

export interface TestExecutionRequest {
    api_spec_id?: number
    test_case_id?: number
    environment: string
    headers?: Record<string, string>
    query_params?: Record<string, any>
    path_params?: Record<string, any>
    body?: any
    pre_script?: string
    test_script?: string
}

export interface TestExecutionResponse {
    request: {
        method: string
        url: string
        headers: Record<string, string>
        body?: any
    }
    response: {
        status: number
        status_text: string
        headers: Record<string, string>
        body: any
        duration_ms: number
        size_bytes: number
    }
    test_results: TestResult[]
    variables: Record<string, any>
    console_logs: string[]
}

export interface TestResult {
    name: string
    passed: boolean
    error?: string
    duration_ms?: number
}

// ========== Test Run Types ==========

export interface TestRun {
    id: number
    collection_id?: number
    trigger_type: 'manual' | 'schedule' | 'ci'
    trigger_by?: number
    status: 'running' | 'success' | 'failed' | 'partial'
    total_cases: number
    passed_cases: number
    failed_cases: number
    duration_ms: number
    results: TestCaseResult[]
    started_at: string
    finished_at?: string
    created_at: string
}

export interface TestCaseResult {
    case_id: number
    case_name: string
    status: 'pass' | 'fail' | 'skip'
    duration_ms: number
    test_results: TestResult[]
    error?: string
    request: any
    response: any
    variables: Record<string, any>
}

// ========== CLI Sync Types ==========

export interface SyncRequest {
    project_id: number
    specs: CreateAPISpecRequest[]
    source: 'cli' | 'code_scan' | 'import'
    metadata?: {
        cli_version?: string
        scan_path?: string
        import_format?: string
    }
}

export interface SyncResponse {
    created: number
    updated: number
    skipped: number
    errors: string[]
}

// ========== Pagination Types ==========

export interface AuditLog {
    id: number
    user_id: number
    action: string
    resource: string
    method: string
    path: string
    ip: string
    user_agent: string
    status: number
    duration: number
    created_at: string
}

export interface PaginatedResponse<T> {
    items: T[]
    total?: number
    page?: number
    per_page?: number
    pages?: number
    pagination?: {
        page: number
        per_page: number
        total: number
        total_pages: number
        has_next: boolean
        has_prev: boolean
    }
}

// ========== Common Response Types ==========

export interface ApiResponse<T = any> {
    code: number
    message: string
    data: T
}

export interface ApiError {
    code: string | number
    message: string
    details?: any
}

// ========== Flow Types ==========

export interface Flow {
    id: number
    project_id: number
    name: string
    description: string
    created_by: number
    step_count?: number
    created_at: string
    updated_at: string
}

export interface FlowDetail extends Flow {
    steps: FlowStep[]
    edges: FlowEdge[]
}

export interface FlowStep {
    id: number
    flow_id: number
    name: string
    sort_order: number
    method: string
    url: string
    headers: string
    body: string
    captures: string
    asserts: string
    position_x: number
    position_y: number
    created_at: string
    updated_at: string
}

export interface FlowEdge {
    id: number
    flow_id: number
    source_step_id: number
    target_step_id: number
    variable_mapping: string
    created_at: string
    updated_at: string
}

export interface FlowRun {
    id: number
    flow_id: number
    status: 'pending' | 'running' | 'passed' | 'failed' | 'canceled'
    triggered_by: number
    started_at?: string
    finished_at?: string
    created_at: string
    updated_at: string
    step_results?: FlowStepResult[]
}

export interface FlowStepResult {
    id: number
    run_id: number
    step_id: number
    status: 'pending' | 'running' | 'passed' | 'failed'
    request: string
    response: string
    assert_results: string
    duration_ms: number
    variables_captured: string
    error_message: string
    created_at: string
}

export interface CreateFlowRequest {
    name: string
    description?: string
}

export interface CreateStepRequest {
    name: string
    sort_order: number
    method: string
    url: string
    headers?: string
    body?: string
    captures?: string
    asserts?: string
    position_x?: number
    position_y?: number
}

export interface CreateEdgeRequest {
    source_step_id: number
    target_step_id: number
    variable_mapping?: string
}

export interface SaveFlowRequest {
    name?: string
    description?: string
    steps: CreateStepRequest[]
    edges: CreateEdgeRequest[]
}

export interface FlowStepEvent {
    run_id: number
    step_id: number
    step_name: string
    status: string
    data?: any
}
