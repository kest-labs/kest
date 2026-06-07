import fs from "node:fs";
import path from "node:path";

const outDir = path.resolve(process.cwd(), "docs-site/openapi");

function schema(type, extra = {}) {
  return { type, ...extra };
}

function nullable(type, extra = {}) {
  return { type: [type, "null"], ...extra };
}

function ref(name) {
  return { $ref: `#/components/schemas/${name}` };
}

function responseRef(name, description = "Success") {
  return {
    description,
    content: {
      "application/json": {
        schema: ref(name),
      },
    },
  };
}

function noContent(description = "No Content") {
  return { description };
}

function op(summary, extra = {}) {
  return {
    summary,
    ...extra,
  };
}

function pathId(name, description) {
  return {
    name,
    in: "path",
    required: true,
    schema: { type: "string" },
    description,
  };
}

function queryInt(name, description, defaultValue) {
  return {
    name,
    in: "query",
    schema: { type: "integer", default: defaultValue, minimum: 1 },
    description,
  };
}

function body(name, schemaRef, required = true) {
  return {
    required,
    content: {
      "application/json": {
        schema: schemaRef,
      },
    },
  };
}

function buildSpec(locale) {
  const isZh = locale === "zh";
  const t = {
    title: isZh ? "Kest API 参考" : "Kest API Reference",
    description: isZh
      ? "Kest 平台 API 的公开契约。该文档以当前代码中真实存在的路由为准。"
      : "Public contract for the Kest platform API. This specification follows the currently implemented routes in the codebase.",
    healthSummary: isZh ? "检查 API v1 健康状态" : "Check API v1 health",
    register: isZh ? "注册用户" : "Register a user",
    login: isZh ? "用户登录" : "Log in a user",
    resetPassword: isZh ? "发起密码重置" : "Request a password reset",
    getProfile: isZh ? "获取当前用户信息" : "Get current user profile",
    updateProfile: isZh ? "更新当前用户信息" : "Update current user profile",
    changePassword: isZh ? "修改当前用户密码" : "Change current user password",
    deleteAccount: isZh ? "删除当前用户账号" : "Delete current user account",
    listUsers: isZh ? "分页列出用户" : "List users",
    searchUsers: isZh ? "搜索用户" : "Search users",
    getUser: isZh ? "获取用户" : "Get a user",
    createCliToken: isZh ? "生成工作区 CLI Token" : "Generate a workspace CLI token",
    listCliTokens: isZh ? "列出工作区 CLI Tokens" : "List workspace CLI tokens",
    syncSpecs: isZh ? "通过 Kest Cloud Sync 同步 API Specs" : "Sync API specs with Kest Cloud Sync",
    syncHistory: isZh ? "通过 Kest Cloud Sync 同步历史记录" : "Sync history with Kest Cloud Sync",
    listApiSpecs: isZh ? "列出 API Specs" : "List API specs",
    createApiSpec: isZh ? "创建 API Spec" : "Create an API spec",
    importApiSpecs: isZh ? "导入多个 API Specs" : "Import multiple API specs",
    exportApiSpecs: isZh ? "导出 API Specs" : "Export API specs",
    getApiSpec: isZh ? "获取 API Spec" : "Get an API spec",
    getApiSpecFull: isZh ? "获取带示例的 API Spec" : "Get an API spec with examples",
    updateApiSpec: isZh ? "更新 API Spec" : "Update an API spec",
    deleteApiSpec: isZh ? "删除 API Spec" : "Delete an API spec",
    listApiSpecExamples: isZh ? "列出 API Spec 示例" : "List API spec examples",
    createApiSpecExample: isZh ? "创建 API Spec 示例" : "Create an API spec example",
    listEnvironments: isZh ? "列出环境" : "List environments",
    createEnvironment: isZh ? "创建环境" : "Create an environment",
    getEnvironment: isZh ? "获取环境" : "Get an environment",
    updateEnvironment: isZh ? "更新环境" : "Update an environment",
    deleteEnvironment: isZh ? "删除环境" : "Delete an environment",
    duplicateEnvironment: isZh ? "复制环境" : "Duplicate an environment",
    listCategories: isZh ? "列出分类" : "List categories",
    createCategory: isZh ? "创建分类" : "Create a category",
    sortCategories: isZh ? "排序分类" : "Sort categories",
    getCategory: isZh ? "获取分类" : "Get a category",
    updateCategory: isZh ? "更新分类" : "Update a category",
    deleteCategory: isZh ? "删除分类" : "Delete a category",
    listTestCases: isZh ? "列出测试用例" : "List test cases",
    createTestCase: isZh ? "创建测试用例" : "Create a test case",
    createTestCaseFromSpec: isZh ? "从 API Spec 生成测试用例" : "Create a test case from an API spec",
    getTestCase: isZh ? "获取测试用例" : "Get a test case",
    updateTestCase: isZh ? "更新测试用例" : "Update a test case",
    deleteTestCase: isZh ? "删除测试用例" : "Delete a test case",
    duplicateTestCase: isZh ? "复制测试用例" : "Duplicate a test case",
    runTestCase: isZh ? "运行测试用例" : "Run a test case",
    listTestRuns: isZh ? "列出测试运行记录" : "List test runs",
    getTestRun: isZh ? "获取测试运行记录" : "Get a test run",
    listPermissions: isZh ? "列出权限" : "List permissions",
    listRoles: isZh ? "列出角色" : "List roles",
    createRole: isZh ? "创建角色" : "Create a role",
    getRole: isZh ? "获取角色" : "Get a role",
    updateRole: isZh ? "更新角色" : "Update a role",
    deleteRole: isZh ? "删除角色" : "Delete a role",
    assignRole: isZh ? "为用户分配角色" : "Assign a role to a user",
    removeRole: isZh ? "移除用户角色" : "Remove a role from a user",
    getUserRoles: isZh ? "获取用户角色" : "Get user roles",
    listCollections: isZh ? "列出集合" : "List collections",
    createCollection: isZh ? "创建集合" : "Create a collection",
    getCollection: isZh ? "获取集合" : "Get a collection",
    updateCollection: isZh ? "更新集合" : "Update a collection",
    deleteCollection: isZh ? "删除集合" : "Delete a collection",
    getCollectionTree: isZh ? "获取集合树" : "Get collection tree",
    moveCollection: isZh ? "移动集合" : "Move a collection",
    listRequests: isZh ? "列出请求" : "List requests",
    createRequest: isZh ? "创建请求" : "Create a request",
    getRequest: isZh ? "获取请求" : "Get a request",
    updateRequest: isZh ? "更新请求" : "Update a request",
    deleteRequest: isZh ? "删除请求" : "Delete a request",
    moveRequest: isZh ? "移动请求" : "Move a request",
    rollbackRequest: isZh ? "回滚请求版本" : "Rollback a request version",
    listHistory: isZh ? "列出历史记录" : "List history entries",
    createHistory: isZh ? "创建历史记录" : "Create a history entry",
    getHistory: isZh ? "获取历史记录" : "Get a history entry",
    listWorkspaces: isZh ? "列出工作区" : "List workspaces",
    createWorkspace: isZh ? "创建工作区" : "Create a workspace",
    getWorkspace: isZh ? "获取工作区" : "Get a workspace",
    updateWorkspace: isZh ? "更新工作区" : "Update a workspace",
    deleteWorkspace: isZh ? "删除工作区" : "Delete a workspace",
    listWorkspaceMembers: isZh ? "列出工作区成员" : "List workspace members",
    addWorkspaceMember: isZh ? "添加工作区成员" : "Add a workspace member",
    updateWorkspaceMemberRole: isZh ? "更新工作区成员角色" : "Update a workspace member role",
    removeWorkspaceMember: isZh ? "移除工作区成员" : "Remove a workspace member",
    getSystemFeatures: isZh ? "获取系统功能开关" : "Get system feature flags",
    getSetupStatus: isZh ? "获取系统初始化状态" : "Get setup status",
    rootHealth: isZh ? "检查根路径健康状态" : "Check root health",
    liveness: isZh ? "检查存活状态" : "Check liveness",
    readiness: isZh ? "检查就绪状态" : "Check readiness",
  };

  const tagDescriptions = {
    "Auth & Users": isZh ? "认证、账户与用户信息接口。" : "Authentication, account, and user profile endpoints.",
    "Kest Cloud Sync": isZh ? "Kest Cloud Sync 产物同步与工作区 CLI token 接口。" : "Kest Cloud Sync endpoints and workspace-scoped CLI token workflows.",
    "API Specs": isZh ? "工作区 API 规格、示例与导入导出接口。" : "Workspace-scoped API specification, examples, import, and export endpoints.",
    Environments: isZh ? "工作区环境与变量管理接口。" : "Workspace environment and variable management endpoints.",
    Categories: isZh ? "工作区分类与目录组织接口。" : "Workspace category and tree organization endpoints.",
    "Test Cases": isZh ? "工作区测试用例生成、执行与运行记录接口。" : "Workspace test case generation, execution, and run record endpoints.",
    Permissions: isZh ? "角色与权限管理接口。" : "Role and permission management endpoints.",
    Collections: isZh ? "工作区请求集合管理接口。" : "Workspace request collection management endpoints.",
    Requests: isZh ? "工作区请求模型与版本操作接口。" : "Workspace request model and version operation endpoints.",
    History: isZh ? "工作区历史记录接口。" : "Workspace history and activity record endpoints.",
    Workspaces: isZh ? "工作区与成员管理接口。" : "Workspace and workspace member management endpoints.",
    System: isZh ? "健康检查与系统元数据接口。" : "Health checks and system metadata endpoints.",
  };

  return {
    openapi: "3.1.0",
    info: {
      title: t.title,
      version: "1.0.0",
      description: t.description,
      license: {
        name: "Apache-2.0",
        url: "https://www.apache.org/licenses/LICENSE-2.0",
      },
      contact: {
        name: "Kest API Support",
        email: "support@kest.dev",
        url: "https://kest.dev",
      },
    },
    security: [{ BearerAuth: [] }],
    servers: [
      { url: "https://api.kest.dev", description: isZh ? "生产环境" : "Production" },
    ],
    tags: [
      "Auth & Users",
      "Kest Cloud Sync",
      "API Specs",
      "Environments",
      "Categories",
      "Test Cases",
      "Permissions",
      "Collections",
      "Requests",
      "History",
      "Workspaces",
      "System",
    ].map((name) => ({
      name,
      description: tagDescriptions[name],
    })),
    components: {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
        WorkspaceCLIToken: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "Kest workspace CLI token",
        },
      },
      schemas: {
        GenericData: schema("object", { additionalProperties: true }),
        SuccessEnvelope: schema("object", {
          properties: {
            code: schema("integer", { example: 0 }),
            message: schema("string", { example: "success" }),
            data: ref("GenericData"),
          },
          required: ["code", "message", "data"],
        }),
        ErrorEnvelope: schema("object", {
          properties: {
            code: schema("integer", { example: 400 }),
            message: schema("string"),
            error: schema("string"),
          },
          required: ["code", "message"],
        }),
        MetaEnvelope: schema("object", {
          properties: {
            total: schema("integer"),
            page: schema("integer"),
            per_page: schema("integer"),
            page_size: schema("integer"),
            pages: schema("integer"),
            total_pages: schema("integer"),
          },
          additionalProperties: true,
        }),
        KeyValue: schema("object", {
          properties: {
            key: schema("string"),
            value: schema("string"),
            type: schema("string"),
            enabled: schema("boolean"),
            description: schema("string"),
          },
          required: ["key", "value"],
        }),
        User: schema("object", {
          properties: {
            id: schema("string"),
            username: schema("string"),
            email: schema("string", { format: "email" }),
            nickname: schema("string"),
            avatar: schema("string"),
            phone: schema("string"),
            bio: schema("string"),
            status: schema("integer"),
            is_super_admin: schema("boolean"),
            last_login: schema("string", { format: "date-time" }),
            created_at: schema("string", { format: "date-time" }),
            updated_at: schema("string", { format: "date-time" }),
          },
          required: ["id", "username", "email", "status", "is_super_admin", "created_at", "updated_at"],
        }),
        UserRegisterRequest: schema("object", {
          properties: {
            username: schema("string"),
            password: schema("string"),
            email: schema("string", { format: "email" }),
            nickname: schema("string"),
            phone: schema("string"),
          },
          required: ["username", "password", "email"],
        }),
        UserLoginRequest: schema("object", {
          properties: {
            username: schema("string"),
            password: schema("string"),
          },
          required: ["username", "password"],
        }),
        UserLoginResponse: schema("object", {
          properties: {
            access_token: schema("string"),
            user: ref("User"),
          },
          required: ["access_token", "user"],
        }),
        UserLoginEnvelope: schema("object", {
          properties: {
            code: schema("integer"),
            message: schema("string"),
            data: ref("UserLoginResponse"),
          },
          required: ["code", "message", "data"],
        }),
        UserUpdateRequest: schema("object", {
          properties: {
            nickname: schema("string"),
            avatar: schema("string"),
            phone: schema("string"),
            bio: schema("string"),
          },
        }),
        UserChangePasswordRequest: schema("object", {
          properties: {
            old_password: schema("string"),
            new_password: schema("string"),
          },
          required: ["old_password", "new_password"],
        }),
        UserPasswordResetRequest: schema("object", {
          properties: {
            email: schema("string", { format: "email" }),
          },
          required: ["email"],
        }),
        UserListData: schema("object", {
          properties: {
            code: schema("integer"),
            message: schema("string"),
            data: {
              type: "array",
              items: ref("User"),
            },
            meta: schema("object", {
              properties: {
                current_page: schema("integer"),
                per_page: schema("integer"),
                total: schema("integer"),
                last_page: schema("integer"),
                from: schema("integer"),
                to: schema("integer"),
              },
            }),
            links: schema("object", {
              properties: {
                first: schema("string"),
                last: schema("string"),
                prev: nullable("string"),
                next: nullable("string"),
              },
            }),
          },
          required: ["code", "message", "data"],
        }),
        GenerateWorkspaceCLITokenRequest: schema("object", {
          properties: {
            name: schema("string"),
            scopes: schema("array", {
              items: schema("string", { enum: ["collection:read", "collection:run", "environment:read", "test_case:run", "flow:run", "flow:write"] }),
            }),
            expires_at: schema("string", { format: "date-time" }),
          },
        }),
        WorkspaceCLITokenInfo: schema("object", {
          properties: {
            id: schema("string"),
            workspace_id: schema("string"),
            name: schema("string"),
            token_prefix: schema("string"),
            scopes: schema("array", { items: schema("string") }),
            last_used_at: schema("string", { format: "date-time" }),
            expires_at: schema("string", { format: "date-time" }),
            created_at: schema("string", { format: "date-time" }),
          },
          required: ["id", "workspace_id", "name", "token_prefix", "scopes", "created_at"],
        }),
        GenerateWorkspaceCLITokenResponse: schema("object", {
          properties: {
            token: schema("string"),
            token_type: schema("string"),
            workspace_id: schema("string"),
            token_info: ref("WorkspaceCLITokenInfo"),
          },
          required: ["token", "token_type", "workspace_id", "token_info"],
        }),
        GenerateWorkspaceCLITokenEnvelope: schema("object", {
          properties: {
            code: schema("integer"),
            message: schema("string"),
            data: ref("GenerateWorkspaceCLITokenResponse"),
          },
          required: ["code", "message", "data"],
        }),
        WorkspaceCLITokenArrayEnvelope: schema("object", {
          properties: {
            code: schema("integer"),
            message: schema("string"),
            data: schema("array", { items: ref("WorkspaceCLITokenInfo") }),
          },
          required: ["code", "message", "data"],
        }),
        CLISpecSyncRequestBodySpec: schema("object", {
          properties: {
            description: schema("string"),
            required: schema("boolean"),
            content_type: schema("string"),
            schema: schema("object", { additionalProperties: true }),
          },
          required: ["required"],
        }),
        CLISpecSyncParameter: schema("object", {
          properties: {
            name: schema("string"),
            in: schema("string"),
            description: schema("string"),
            required: schema("boolean"),
            schema: schema("object", { additionalProperties: true }),
            example: {},
          },
          required: ["name", "in", "required"],
        }),
        CLISpecSyncResponse: schema("object", {
          properties: {
            description: schema("string"),
            content_type: schema("string"),
            schema: schema("object", { additionalProperties: true }),
          },
          required: ["description"],
        }),
        CLISpecSyncExample: schema("object", {
          properties: {
            name: schema("string"),
            request_headers: schema("object", { additionalProperties: { type: "string" } }),
            request_body: schema("string"),
            response_status: schema("integer"),
            response_body: schema("string"),
            duration_ms: schema("integer"),
          },
          required: ["name", "response_status", "duration_ms"],
        }),
        CLISpecSyncSpec: schema("object", {
          properties: {
            method: schema("string", { enum: ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"] }),
            path: schema("string"),
            title: schema("string"),
            summary: schema("string"),
            description: schema("string"),
            version: schema("string"),
            request_body: ref("CLISpecSyncRequestBodySpec"),
            parameters: schema("array", { items: ref("CLISpecSyncParameter") }),
            responses: schema("object", { additionalProperties: ref("CLISpecSyncResponse") }),
            examples: schema("array", { items: ref("CLISpecSyncExample") }),
          },
          required: ["method", "path", "title", "version"],
        }),
        CLISpecSyncRequest: schema("object", {
          properties: {
            workspace_id: schema("string"),
            source: schema("string"),
            metadata: schema("object", { additionalProperties: true }),
            specs: schema("array", { items: ref("CLISpecSyncSpec") }),
          },
          required: ["specs"],
        }),
        SyncSummary: schema("object", {
          properties: {
            created: schema("integer"),
            updated: schema("integer"),
            skipped: schema("integer"),
            errors: schema("array", { items: schema("string") }),
          },
          required: ["created", "updated", "skipped"],
        }),
        SyncSummaryEnvelope: schema("object", {
          properties: {
            code: schema("integer"),
            message: schema("string"),
            data: ref("SyncSummary"),
          },
          required: ["code", "message", "data"],
        }),
        CLIHistorySyncEntry: schema("object", {
          properties: {
            source_event_id: schema("string"),
            event_type: schema("string"),
            occurred_at: schema("string", { format: "date-time" }),
            entity_type: schema("string"),
            entity_id: schema("string"),
            action: schema("string"),
            message: schema("string"),
            data: schema("object", { additionalProperties: true }),
          },
          required: ["source_event_id", "event_type", "occurred_at", "entity_type", "entity_id", "action", "message", "data"],
        }),
        CLIHistorySyncRequest: schema("object", {
          properties: {
            workspace_id: schema("string"),
            source: schema("string"),
            metadata: schema("object", { additionalProperties: true }),
            entries: schema("array", { items: ref("CLIHistorySyncEntry") }),
          },
          required: ["entries"],
        }),
        RequestBodySpec: schema("object", {
          properties: {
            description: schema("string"),
            required: schema("boolean"),
            content_type: schema("string"),
            schema: schema("object", { additionalProperties: true }),
          },
          required: ["required"],
        }),
        ParameterSpec: schema("object", {
          properties: {
            name: schema("string"),
            in: schema("string"),
            description: schema("string"),
            required: schema("boolean"),
            schema: schema("object", { additionalProperties: true }),
            example: {},
          },
          required: ["name", "in", "required"],
        }),
        ResponseSpec: schema("object", {
          properties: {
            description: schema("string"),
            content_type: schema("string"),
            schema: schema("object", { additionalProperties: true }),
          },
          required: ["description"],
        }),
        APISpec: schema("object", {
          properties: {
            id: schema("string"),
            workspace_id: schema("string"),
            category_id: schema("string"),
            method: schema("string"),
            path: schema("string"),
            summary: schema("string"),
            description: schema("string"),
            doc_markdown: schema("string"),
            doc_markdown_zh: schema("string"),
            doc_markdown_en: schema("string"),
            doc_source: schema("string"),
            tags: schema("array", { items: schema("string") }),
            request_body: ref("RequestBodySpec"),
            parameters: schema("array", { items: ref("ParameterSpec") }),
            responses: schema("object", { additionalProperties: ref("ResponseSpec") }),
            version: schema("string"),
            is_public: schema("boolean"),
            created_at: schema("string", { format: "date-time" }),
            updated_at: schema("string", { format: "date-time" }),
          },
          required: ["id", "workspace_id", "method", "path", "summary", "description", "tags", "version", "is_public", "created_at", "updated_at"],
        }),
        APISpecExample: schema("object", {
          properties: {
            id: schema("string"),
            api_spec_id: schema("string"),
            name: schema("string"),
            request_headers: schema("object", { additionalProperties: { type: "string" } }),
            request_body: schema("object", { additionalProperties: true }),
            response_status: schema("integer"),
            response_body: schema("object", { additionalProperties: true }),
            duration_ms: schema("integer"),
            created_at: schema("string", { format: "date-time" }),
          },
          required: ["id", "api_spec_id", "name", "response_status", "duration_ms", "created_at"],
        }),
        CreateAPISpecRequest: schema("object", {
          properties: {
            category_id: schema("string"),
            method: schema("string", { enum: ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"] }),
            path: schema("string"),
            summary: schema("string"),
            description: schema("string"),
            doc_markdown: schema("string"),
            doc_markdown_zh: schema("string"),
            doc_markdown_en: schema("string"),
            doc_source: schema("string", { enum: ["manual", "ai"] }),
            tags: schema("array", { items: schema("string") }),
            request_body: ref("RequestBodySpec"),
            parameters: schema("array", { items: ref("ParameterSpec") }),
            responses: schema("object", { additionalProperties: ref("ResponseSpec") }),
            version: schema("string"),
            is_public: schema("boolean"),
          },
          required: ["method", "path", "version"],
        }),
        UpdateAPISpecRequest: schema("object", {
          properties: {
            category_id: schema("string"),
            summary: schema("string"),
            description: schema("string"),
            doc_markdown: schema("string"),
            doc_markdown_zh: schema("string"),
            doc_markdown_en: schema("string"),
            doc_source: schema("string", { enum: ["manual", "ai"] }),
            tags: schema("array", { items: schema("string") }),
            request_body: ref("RequestBodySpec"),
            parameters: schema("array", { items: ref("ParameterSpec") }),
            responses: schema("object", { additionalProperties: ref("ResponseSpec") }),
            is_public: schema("boolean"),
          },
        }),
        ImportAPISpecsRequest: schema("object", {
          properties: {
            specs: schema("array", { items: ref("CreateAPISpecRequest") }),
          },
          required: ["specs"],
        }),
        CreateAPIExampleRequest: schema("object", {
          properties: {
            name: schema("string"),
            request_headers: schema("object", { additionalProperties: { type: "string" } }),
            request_body: schema("object", { additionalProperties: true }),
            response_status: schema("integer"),
            response_body: schema("object", { additionalProperties: true }),
            duration_ms: schema("integer"),
          },
          required: ["name", "response_status"],
        }),
        APISpecEnvelope: schema("object", {
          properties: {
            code: schema("integer"),
            message: schema("string"),
            data: ref("APISpec"),
          },
          required: ["code", "message", "data"],
        }),
        APISpecListEnvelope: schema("object", {
          properties: {
            code: schema("integer"),
            message: schema("string"),
            data: schema("object", {
              properties: {
                items: schema("array", { items: ref("APISpec") }),
                meta: ref("MetaEnvelope"),
              },
              required: ["items", "meta"],
            }),
          },
          required: ["code", "message", "data"],
        }),
        APISpecExamplesEnvelope: schema("object", {
          properties: {
            code: schema("integer"),
            message: schema("string"),
            data: schema("object", {
              properties: {
                items: schema("array", { items: ref("APISpecExample") }),
                total: schema("integer"),
              },
              required: ["items", "total"],
            }),
          },
          required: ["code", "message", "data"],
        }),
        Environment: schema("object", {
          properties: {
            id: schema("string"),
            workspace_id: schema("string"),
            name: schema("string"),
            display_name: schema("string"),
            base_url: schema("string"),
            variables: schema("object", { additionalProperties: true }),
            headers: schema("object", { additionalProperties: { type: "string" } }),
            created_at: schema("string", { format: "date-time" }),
            updated_at: schema("string", { format: "date-time" }),
          },
          required: ["id", "workspace_id", "name", "created_at", "updated_at"],
        }),
        CreateEnvironmentRequest: schema("object", {
          properties: {
            name: schema("string"),
            display_name: schema("string"),
            base_url: schema("string"),
            variables: schema("object", { additionalProperties: true }),
            headers: schema("object", { additionalProperties: { type: "string" } }),
          },
          required: ["name"],
        }),
        UpdateEnvironmentRequest: schema("object", {
          properties: {
            name: schema("string"),
            display_name: schema("string"),
            base_url: schema("string"),
            variables: schema("object", { additionalProperties: true }),
            headers: schema("object", { additionalProperties: { type: "string" } }),
          },
        }),
        DuplicateEnvironmentRequest: schema("object", {
          properties: {
            name: schema("string"),
            override_vars: schema("object", { additionalProperties: true }),
          },
          required: ["name"],
        }),
        EnvironmentEnvelope: schema("object", {
          properties: {
            code: schema("integer"),
            message: schema("string"),
            data: ref("Environment"),
          },
          required: ["code", "message", "data"],
        }),
        EnvironmentArrayEnvelope: schema("object", {
          properties: {
            code: schema("integer"),
            message: schema("string"),
            data: schema("array", { items: ref("Environment") }),
          },
          required: ["code", "message", "data"],
        }),
        Category: schema("object", {
          properties: {
            id: schema("string"),
            workspace_id: schema("string"),
            name: schema("string"),
            parent_id: schema("string"),
            description: schema("string"),
            sort_order: schema("integer"),
            children: schema("array", { items: ref("Category") }),
            created_at: schema("string", { format: "date-time" }),
            updated_at: schema("string", { format: "date-time" }),
          },
          required: ["id", "workspace_id", "name", "sort_order", "created_at", "updated_at"],
        }),
        CreateCategoryRequest: schema("object", {
          properties: {
            name: schema("string"),
            parent_id: schema("string"),
            description: schema("string"),
            sort_order: schema("integer"),
          },
          required: ["name"],
        }),
        UpdateCategoryRequest: schema("object", {
          properties: {
            name: schema("string"),
            parent_id: nullable("string"),
            description: schema("string"),
            sort_order: schema("integer"),
          },
        }),
        SortCategoriesRequest: schema("object", {
          properties: {
            category_ids: schema("array", { items: schema("string") }),
          },
          required: ["category_ids"],
        }),
        CategoryListEnvelope: schema("object", {
          properties: {
            code: schema("integer"),
            message: schema("string"),
            data: schema("object", {
              properties: {
                items: schema("array", { items: ref("Category") }),
                total: schema("integer"),
                pagination: ref("MetaEnvelope"),
              },
              required: ["items"],
            }),
          },
          required: ["code", "message", "data"],
        }),
        CategoryEnvelope: schema("object", {
          properties: {
            code: schema("integer"),
            message: schema("string"),
            data: ref("Category"),
          },
          required: ["code", "message", "data"],
        }),
        Assertion: schema("object", {
          properties: {
            type: schema("string"),
            path: schema("string"),
            operator: schema("string"),
            expect: {},
            message: schema("string"),
          },
          required: ["type", "operator"],
        }),
        ExtractVar: schema("object", {
          properties: {
            name: schema("string"),
            source: schema("string"),
            path: schema("string"),
          },
          required: ["name", "source", "path"],
        }),
        TestCase: schema("object", {
          properties: {
            id: schema("string"),
            api_spec_id: schema("string"),
            method: schema("string"),
            path: schema("string"),
            name: schema("string"),
            description: schema("string"),
            env: schema("string"),
            headers: schema("object", { additionalProperties: { type: "string" } }),
            query_params: schema("object", { additionalProperties: { type: "string" } }),
            path_params: schema("object", { additionalProperties: { type: "string" } }),
            request_body: schema("object", { additionalProperties: true }),
            pre_script: schema("string"),
            post_script: schema("string"),
            assertions: schema("array", { items: ref("Assertion") }),
            extract_vars: schema("array", { items: ref("ExtractVar") }),
            created_by: schema("string"),
            created_at: schema("string", { format: "date-time" }),
            updated_at: schema("string", { format: "date-time" }),
          },
          required: ["id", "api_spec_id", "name", "created_by", "created_at", "updated_at"],
        }),
        CreateTestCaseRequest: schema("object", {
          properties: {
            api_spec_id: schema("string"),
            name: schema("string"),
            description: schema("string"),
            env: schema("string"),
            headers: schema("object", { additionalProperties: { type: "string" } }),
            query_params: schema("object", { additionalProperties: { type: "string" } }),
            path_params: schema("object", { additionalProperties: { type: "string" } }),
            request_body: schema("object", { additionalProperties: true }),
            pre_script: schema("string"),
            post_script: schema("string"),
            assertions: schema("array", { items: ref("Assertion") }),
            extract_vars: schema("array", { items: ref("ExtractVar") }),
          },
          required: ["api_spec_id", "name"],
        }),
        UpdateTestCaseRequest: schema("object", {
          properties: {
            name: schema("string"),
            description: schema("string"),
            env: schema("string"),
            headers: schema("object", { additionalProperties: { type: "string" } }),
            query_params: schema("object", { additionalProperties: { type: "string" } }),
            path_params: schema("object", { additionalProperties: { type: "string" } }),
            request_body: schema("object", { additionalProperties: true }),
            pre_script: schema("string"),
            post_script: schema("string"),
            assertions: schema("array", { items: ref("Assertion") }),
            extract_vars: schema("array", { items: ref("ExtractVar") }),
          },
        }),
        FromSpecRequest: schema("object", {
          properties: {
            api_spec_id: schema("string"),
            name: schema("string"),
            env: schema("string"),
            use_example: schema("boolean"),
            example_id: schema("string"),
          },
          required: ["api_spec_id", "name"],
        }),
        DuplicateTestCaseRequest: schema("object", {
          properties: {
            name: schema("string"),
          },
          required: ["name"],
        }),
        RunTestCaseRequest: schema("object", {
          properties: {
            env_id: schema("string"),
            global_vars: schema("object", { additionalProperties: true }),
            variable_keys: schema("object", { additionalProperties: { type: "string" } }),
          },
        }),
        RunRequestInfo: schema("object", {
          properties: {
            method: schema("string"),
            url: schema("string"),
            headers: schema("object", { additionalProperties: { type: "string" } }),
            body: schema("object", { additionalProperties: true }),
          },
          required: ["method", "url", "headers"],
        }),
        RunResponseInfo: schema("object", {
          properties: {
            status: schema("integer"),
            headers: schema("object", { additionalProperties: { type: "string" } }),
            body: schema("object", { additionalProperties: true }),
          },
          required: ["status", "headers"],
        }),
        AssertionResult: schema("object", {
          properties: {
            type: schema("string"),
            operator: schema("string"),
            path: schema("string"),
            expect: {},
            actual: {},
            passed: schema("boolean"),
            message: schema("string"),
          },
          required: ["type", "operator", "passed", "message"],
        }),
        TestRun: schema("object", {
          properties: {
            id: schema("string"),
            test_case_id: schema("string"),
            status: schema("string"),
            duration_ms: schema("integer"),
            request: ref("RunRequestInfo"),
            response: ref("RunResponseInfo"),
            assertions: schema("array", { items: ref("AssertionResult") }),
            variables: schema("object", { additionalProperties: true }),
            message: schema("string"),
            created_at: schema("string", { format: "date-time" }),
          },
          required: ["id", "test_case_id", "status", "duration_ms", "created_at"],
        }),
        RunTestCaseResponse: schema("object", {
          properties: {
            test_case_id: schema("string"),
            status: schema("string"),
            message: schema("string"),
            duration_ms: schema("integer"),
            request: ref("RunRequestInfo"),
            response: ref("RunResponseInfo"),
            assertions: schema("array", { items: ref("AssertionResult") }),
            variables: schema("object", { additionalProperties: true }),
          },
          required: ["test_case_id", "status", "duration_ms", "request", "response", "assertions", "variables"],
        }),
        TestCaseEnvelope: schema("object", {
          properties: {
            code: schema("integer"),
            message: schema("string"),
            data: ref("TestCase"),
          },
          required: ["code", "message", "data"],
        }),
        TestCaseListEnvelope: schema("object", {
          properties: {
            code: schema("integer"),
            message: schema("string"),
            data: schema("object", {
              properties: {
                items: schema("array", { items: ref("TestCase") }),
                meta: ref("MetaEnvelope"),
              },
              required: ["items", "meta"],
            }),
          },
          required: ["code", "message", "data"],
        }),
        RunResultEnvelope: schema("object", {
          properties: {
            code: schema("integer"),
            message: schema("string"),
            data: ref("RunTestCaseResponse"),
          },
          required: ["code", "message", "data"],
        }),
        TestRunEnvelope: schema("object", {
          properties: {
            code: schema("integer"),
            message: schema("string"),
            data: ref("TestRun"),
          },
          required: ["code", "message", "data"],
        }),
        TestRunListEnvelope: schema("object", {
          properties: {
            code: schema("integer"),
            message: schema("string"),
            data: schema("object", {
              properties: {
                items: schema("array", { items: ref("TestRun") }),
                meta: schema("object", {
                  properties: {
                    page: schema("integer"),
                    page_size: schema("integer"),
                    total: schema("integer"),
                    total_pages: schema("integer"),
                  },
                }),
              },
              required: ["items", "meta"],
            }),
          },
          required: ["code", "message", "data"],
        }),
        Role: schema("object", {
          properties: {
            id: schema("string"),
            name: schema("string"),
            display_name: schema("string"),
            description: schema("string"),
            is_default: schema("boolean"),
            created_at: schema("string"),
          },
          required: ["id", "name", "display_name", "description", "is_default", "created_at"],
        }),
        Permission: schema("object", {
          properties: {
            id: schema("string"),
            name: schema("string"),
            display_name: schema("string"),
            description: schema("string"),
            module: schema("string"),
          },
          required: ["id", "name", "display_name", "description", "module"],
        }),
        CreateRoleRequest: schema("object", {
          properties: {
            name: schema("string"),
            display_name: schema("string"),
            description: schema("string"),
            is_default: schema("boolean"),
          },
          required: ["name"],
        }),
        UpdateRoleRequest: schema("object", {
          properties: {
            name: schema("string"),
            display_name: schema("string"),
            description: schema("string"),
          },
        }),
        AssignRoleRequest: schema("object", {
          properties: {
            user_id: schema("string"),
            role_id: schema("string"),
          },
          required: ["user_id", "role_id"],
        }),
        UserRolesEnvelope: schema("object", {
          properties: {
            user_id: schema("string"),
            roles: schema("array", { items: ref("Role") }),
          },
          required: ["user_id", "roles"],
        }),
        RoleEnvelope: schema("object", {
          properties: {
            id: schema("string"),
            name: schema("string"),
            display_name: schema("string"),
            description: schema("string"),
            is_default: schema("boolean"),
            created_at: schema("string"),
          },
          required: ["id", "name", "display_name", "description", "is_default", "created_at"],
        }),
        RoleArrayEnvelope: schema("array", { items: ref("Role") }),
        PermissionArrayEnvelope: schema("array", { items: ref("Permission") }),
        Collection: schema("object", {
          properties: {
            id: schema("string"),
            name: schema("string"),
            description: schema("string"),
            workspace_id: schema("string"),
            parent_id: schema("string"),
            is_folder: schema("boolean"),
            sort_order: schema("integer"),
            created_at: schema("string", { format: "date-time" }),
            updated_at: schema("string", { format: "date-time" }),
          },
          required: ["id", "name", "description", "workspace_id", "is_folder", "sort_order", "created_at", "updated_at"],
        }),
        CollectionTreeNode: schema("object", {
          properties: {
            id: schema("string"),
            name: schema("string"),
            description: schema("string"),
            workspace_id: schema("string"),
            parent_id: schema("string"),
            is_folder: schema("boolean"),
            sort_order: schema("integer"),
            children: schema("array", { items: ref("CollectionTreeNode") }),
            request_count: schema("integer"),
          },
          required: ["id", "name", "description", "workspace_id", "is_folder", "sort_order"],
        }),
        CreateCollectionRequest: schema("object", {
          properties: {
            name: schema("string"),
            description: schema("string"),
            parent_id: schema("string"),
            is_folder: schema("boolean"),
            sort_order: schema("integer"),
          },
          required: ["name"],
        }),
        UpdateCollectionRequest: schema("object", {
          properties: {
            name: schema("string"),
            description: schema("string"),
            parent_id: schema("string"),
            sort_order: schema("integer"),
          },
        }),
        MoveCollectionRequest: schema("object", {
          properties: {
            parent_id: schema("string"),
            sort_order: schema("integer"),
          },
        }),
        CollectionEnvelope: schema("object", {
          properties: {
            code: schema("integer"),
            message: schema("string"),
            data: ref("Collection"),
          },
          required: ["code", "message", "data"],
        }),
        CollectionListEnvelope: schema("object", {
          properties: {
            code: schema("integer"),
            message: schema("string"),
            data: schema("object", {
              properties: {
                items: schema("array", { items: ref("Collection") }),
                meta: ref("MetaEnvelope"),
              },
              required: ["items", "meta"],
            }),
          },
          required: ["code", "message", "data"],
        }),
        CollectionTreeEnvelope: schema("object", {
          properties: {
            code: schema("integer"),
            message: schema("string"),
            data: schema("array", { items: ref("CollectionTreeNode") }),
          },
          required: ["code", "message", "data"],
        }),
        BasicAuth: schema("object", {
          properties: {
            username: schema("string"),
            password: schema("string"),
          },
          required: ["username", "password"],
        }),
        BearerToken: schema("object", {
          properties: {
            token: schema("string"),
          },
          required: ["token"],
        }),
        APIKeyAuth: schema("object", {
          properties: {
            key: schema("string"),
            value: schema("string"),
            in: schema("string"),
            add_to: schema("string"),
          },
          required: ["key", "value", "in"],
        }),
        OAuth2Config: schema("object", {
          properties: {
            grant_type: schema("string"),
            auth_url: schema("string"),
            token_url: schema("string"),
            client_id: schema("string"),
            client_secret: schema("string"),
            scope: schema("string"),
            username: schema("string"),
            password: schema("string"),
          },
          required: ["grant_type"],
        }),
        AuthConfig: schema("object", {
          properties: {
            type: schema("string"),
            basic: ref("BasicAuth"),
            bearer: ref("BearerToken"),
            api_key: ref("APIKeyAuth"),
            oauth2: ref("OAuth2Config"),
          },
          required: ["type"],
        }),
        Request: schema("object", {
          properties: {
            id: schema("string"),
            collection_id: schema("string"),
            name: schema("string"),
            description: schema("string"),
            method: schema("string"),
            url: schema("string"),
            headers: schema("array", { items: ref("KeyValue") }),
            query_params: schema("array", { items: ref("KeyValue") }),
            path_params: schema("object", { additionalProperties: { type: "string" } }),
            body: schema("string"),
            body_type: schema("string"),
            auth: ref("AuthConfig"),
            pre_request: schema("string"),
            test: schema("string"),
            sort_order: schema("integer"),
            created_at: schema("string", { format: "date-time" }),
            updated_at: schema("string", { format: "date-time" }),
          },
          required: ["id", "collection_id", "name", "description", "method", "url", "headers", "query_params", "path_params", "body", "body_type", "sort_order", "created_at", "updated_at"],
        }),
        CreateRequestRequest: schema("object", {
          properties: {
            name: schema("string"),
            description: schema("string"),
            method: schema("string", { enum: ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] }),
            url: schema("string"),
            headers: schema("array", { items: ref("KeyValue") }),
            query_params: schema("array", { items: ref("KeyValue") }),
            path_params: schema("object", { additionalProperties: { type: "string" } }),
            body: schema("string"),
            body_type: schema("string"),
            auth: ref("AuthConfig"),
            pre_request: schema("string"),
            test: schema("string"),
            sort_order: schema("integer"),
          },
          required: ["name", "method", "url"],
        }),
        UpdateRequestRequest: schema("object", {
          properties: {
            name: schema("string"),
            description: schema("string"),
            method: schema("string", { enum: ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] }),
            url: schema("string"),
            headers: schema("array", { items: ref("KeyValue") }),
            query_params: schema("array", { items: ref("KeyValue") }),
            path_params: schema("object", { additionalProperties: { type: "string" } }),
            body: schema("string"),
            body_type: schema("string"),
            auth: ref("AuthConfig"),
            pre_request: schema("string"),
            test: schema("string"),
            sort_order: schema("integer"),
          },
        }),
        MoveRequestRequest: schema("object", {
          properties: {
            collection_id: schema("string"),
            sort_order: schema("integer"),
          },
        }),
        RollbackRequest: schema("object", {
          properties: {
            version_id: schema("string"),
          },
          required: ["version_id"],
        }),
        RequestEnvelope: schema("object", {
          properties: {
            code: schema("integer"),
            message: schema("string"),
            data: ref("Request"),
          },
          required: ["code", "message", "data"],
        }),
        RequestListEnvelope: schema("object", {
          properties: {
            code: schema("integer"),
            message: schema("string"),
            data: schema("object", {
              properties: {
                items: schema("array", { items: ref("Request") }),
                meta: ref("MetaEnvelope"),
              },
              required: ["items", "meta"],
            }),
          },
          required: ["code", "message", "data"],
        }),
        History: schema("object", {
          properties: {
            id: schema("string"),
            entity_type: schema("string"),
            entity_id: schema("string"),
            workspace_id: schema("string"),
            user_id: schema("string"),
            source: schema("string"),
            source_event_id: schema("string"),
            action: schema("string"),
            data: schema("object", { additionalProperties: true }),
            diff: schema("object", { additionalProperties: true }),
            message: schema("string"),
            created_at: schema("string", { format: "date-time" }),
          },
          required: ["id", "entity_type", "entity_id", "workspace_id", "user_id", "action", "data", "message", "created_at"],
        }),
        RecordHistoryRequest: schema("object", {
          properties: {
            entity_type: schema("string"),
            entity_id: schema("string"),
            source: schema("string"),
            source_event_id: schema("string"),
            action: schema("string"),
            data: schema("object", { additionalProperties: true }),
            diff: schema("object", { additionalProperties: true }),
            message: schema("string"),
          },
          required: ["entity_type", "entity_id", "action", "data"],
        }),
        HistoryEnvelope: schema("object", {
          properties: {
            code: schema("integer"),
            message: schema("string"),
            data: ref("History"),
          },
          required: ["code", "message", "data"],
        }),
        HistoryListEnvelope: schema("object", {
          properties: {
            code: schema("integer"),
            message: schema("string"),
            data: schema("object", {
              properties: {
                items: schema("array", { items: ref("History") }),
                meta: ref("MetaEnvelope"),
              },
              required: ["items", "meta"],
            }),
          },
          required: ["code", "message", "data"],
        }),
        Workspace: schema("object", {
          properties: {
            id: schema("string"),
            name: schema("string"),
            slug: schema("string"),
            description: schema("string"),
            type: schema("string", { enum: ["personal", "team", "public"] }),
            owner_id: schema("string"),
            visibility: schema("string", { enum: ["private", "team", "public"] }),
            settings: schema("object", { additionalProperties: true }),
            created_at: schema("string", { format: "date-time" }),
            updated_at: schema("string", { format: "date-time" }),
          },
          required: ["id", "name", "slug", "description", "type", "owner_id", "visibility", "created_at", "updated_at"],
        }),
        WorkspaceMember: schema("object", {
          properties: {
            id: schema("string"),
            workspace_id: schema("string"),
            user_id: schema("string"),
            username: schema("string"),
            email: schema("string"),
            role: schema("string", { enum: ["owner", "admin", "write", "read"] }),
            invited_by: schema("string"),
            joined_at: schema("string", { format: "date-time" }),
          },
          required: ["id", "workspace_id", "user_id", "role", "invited_by", "joined_at"],
        }),
        CreateWorkspaceRequest: schema("object", {
          properties: {
            name: schema("string"),
            slug: schema("string"),
            description: schema("string"),
            type: schema("string", { enum: ["personal", "team", "public"] }),
            visibility: schema("string", { enum: ["private", "team", "public"] }),
          },
          required: ["name", "slug", "type"],
        }),
        UpdateWorkspaceRequest: schema("object", {
          properties: {
            name: schema("string"),
            description: schema("string"),
            visibility: schema("string", { enum: ["private", "team", "public"] }),
          },
        }),
        AddWorkspaceMemberRequest: schema("object", {
          properties: {
            user_id: schema("string"),
            role: schema("string", { enum: ["owner", "admin", "write", "read"] }),
          },
          required: ["user_id", "role"],
        }),
        UpdateWorkspaceMemberRoleRequest: schema("object", {
          properties: {
            role: schema("string", { enum: ["owner", "admin", "write", "read"] }),
          },
          required: ["role"],
        }),
        WorkspaceEnvelope: schema("object", {
          properties: {
            code: schema("integer"),
            message: schema("string"),
            data: ref("Workspace"),
          },
          required: ["code", "message", "data"],
        }),
        WorkspaceArrayEnvelope: schema("object", {
          properties: {
            code: schema("integer"),
            message: schema("string"),
            data: schema("array", { items: ref("Workspace") }),
          },
          required: ["code", "message", "data"],
        }),
        WorkspaceMemberArrayEnvelope: schema("object", {
          properties: {
            code: schema("integer"),
            message: schema("string"),
            data: schema("array", { items: ref("WorkspaceMember") }),
          },
          required: ["code", "message", "data"],
        }),
        SystemFeatures: schema("object", {
          properties: {
            enable_email_password_login: schema("boolean"),
            enable_social_oauth_login: schema("boolean"),
            is_allow_register: schema("boolean"),
            enable_api_documentation: schema("boolean"),
            enable_test_runner: schema("boolean"),
            enable_cli_sync: schema("boolean"),
          },
          required: [
            "enable_email_password_login",
            "enable_social_oauth_login",
            "is_allow_register",
            "enable_api_documentation",
            "enable_test_runner",
            "enable_cli_sync",
          ],
        }),
        SetupStatus: schema("object", {
          properties: {
            step: schema("string"),
            setup_at: schema("string", { format: "date-time" }),
            is_setup: schema("boolean"),
            has_admin: schema("boolean"),
            version: schema("string"),
          },
          required: ["step", "is_setup", "has_admin", "version"],
        }),
        SystemFeaturesEnvelope: schema("object", {
          properties: {
            code: schema("integer"),
            message: schema("string"),
            data: ref("SystemFeatures"),
          },
          required: ["code", "message", "data"],
        }),
        SetupStatusEnvelope: schema("object", {
          properties: {
            code: schema("integer"),
            message: schema("string"),
            data: ref("SetupStatus"),
          },
          required: ["code", "message", "data"],
        }),
        RootHealth: schema("object", {
          properties: {
            status: schema("string"),
          },
          required: ["status"],
        }),
        V1Health: schema("object", {
          properties: {
            status: schema("string"),
            version: schema("string"),
          },
          required: ["status", "version"],
        }),
      },
    },
    paths: {
      "/v1/health": {
        get: op(t.healthSummary, {
          tags: ["System"],
          operationId: "getApiV1Health",
          security: [],
          responses: {
            200: {
              description: "OK",
              content: { "application/json": { schema: ref("V1Health") } },
            },
            400: responseRef("ErrorEnvelope", "Bad Request"),
          },
        }),
      },
      "/health": {
        get: op(t.rootHealth, {
          tags: ["System"],
          operationId: "getRootHealth",
          security: [],
          responses: {
            200: {
              description: "OK",
              content: { "application/json": { schema: ref("RootHealth") } },
            },
            400: responseRef("ErrorEnvelope", "Bad Request"),
          },
        }),
      },
      "/health/live": {
        get: op(t.liveness, {
          tags: ["System"],
          operationId: "getLiveness",
          security: [],
          responses: {
            200: {
              description: "OK",
              content: { "application/json": { schema: ref("RootHealth") } },
            },
            400: responseRef("ErrorEnvelope", "Bad Request"),
          },
        }),
      },
      "/health/ready": {
        get: op(t.readiness, {
          tags: ["System"],
          operationId: "getReadiness",
          security: [],
          responses: {
            200: {
              description: "OK",
              content: { "application/json": { schema: ref("RootHealth") } },
            },
            400: responseRef("ErrorEnvelope", "Bad Request"),
            503: {
              description: "Service unavailable",
              content: { "application/json": { schema: ref("RootHealth") } },
            },
          },
        }),
      },
      "/v1/register": {
        post: op(t.register, {
          tags: ["Auth & Users"],
          operationId: "registerUser",
          security: [],
          requestBody: body("register", ref("UserRegisterRequest")),
          responses: {
            201: responseRef("SuccessEnvelope", "Created"),
            400: responseRef("ErrorEnvelope", "Bad Request"),
          },
        }),
      },
      "/v1/login": {
        post: op(t.login, {
          tags: ["Auth & Users"],
          operationId: "loginUser",
          security: [],
          requestBody: body("login", ref("UserLoginRequest")),
          responses: {
            200: responseRef("UserLoginEnvelope", "OK"),
            400: responseRef("ErrorEnvelope", "Bad Request"),
            401: responseRef("ErrorEnvelope", "Unauthorized"),
          },
        }),
      },
      "/v1/password/reset": {
        post: op(t.resetPassword, {
          tags: ["Auth & Users"],
          operationId: "resetPassword",
          security: [],
          requestBody: body("reset", ref("UserPasswordResetRequest")),
          responses: {
            200: responseRef("SuccessEnvelope", "OK"),
            400: responseRef("ErrorEnvelope", "Bad Request"),
          },
        }),
      },
      "/v1/users/profile": {
        get: op(t.getProfile, {
          tags: ["Auth & Users"],
          operationId: "getProfile",
          security: [{ BearerAuth: [] }],
          responses: {
            200: responseRef("SuccessEnvelope", "OK"),
            401: responseRef("ErrorEnvelope", "Unauthorized"),
          },
        }),
        put: op(t.updateProfile, {
          tags: ["Auth & Users"],
          operationId: "updateProfile",
          security: [{ BearerAuth: [] }],
          requestBody: body("updateProfile", ref("UserUpdateRequest")),
          responses: {
            200: responseRef("SuccessEnvelope", "OK"),
            400: responseRef("ErrorEnvelope", "Bad Request"),
            401: responseRef("ErrorEnvelope", "Unauthorized"),
          },
        }),
      },
      "/v1/users/password": {
        put: op(t.changePassword, {
          tags: ["Auth & Users"],
          operationId: "changePassword",
          security: [{ BearerAuth: [] }],
          requestBody: body("changePassword", ref("UserChangePasswordRequest")),
          responses: {
            200: responseRef("SuccessEnvelope", "OK"),
            400: responseRef("ErrorEnvelope", "Bad Request"),
            401: responseRef("ErrorEnvelope", "Unauthorized"),
          },
        }),
      },
      "/v1/users/account": {
        delete: op(t.deleteAccount, {
          tags: ["Auth & Users"],
          operationId: "deleteAccount",
          security: [{ BearerAuth: [] }],
          responses: {
            204: noContent(),
            401: responseRef("ErrorEnvelope", "Unauthorized"),
          },
        }),
      },
      "/v1/users": {
        get: op(t.listUsers, {
          tags: ["Auth & Users"],
          operationId: "listUsers",
          security: [{ BearerAuth: [] }],
          parameters: [queryInt("page", "Page number", 1), queryInt("per_page", "Items per page", 20)],
          responses: {
            200: responseRef("UserListData", "OK"),
            401: responseRef("ErrorEnvelope", "Unauthorized"),
          },
        }),
      },
      "/v1/users/search": {
        get: op(t.searchUsers, {
          tags: ["Auth & Users"],
          operationId: "searchUsers",
          security: [{ BearerAuth: [] }],
          parameters: [
            { name: "q", in: "query", required: true, schema: { type: "string" }, description: isZh ? "搜索关键字" : "Search query" },
            { name: "limit", in: "query", schema: { type: "integer", default: 20 }, description: isZh ? "返回数量" : "Maximum results" },
          ],
          responses: {
            200: responseRef("SuccessEnvelope", "OK"),
            400: responseRef("ErrorEnvelope", "Bad Request"),
            401: responseRef("ErrorEnvelope", "Unauthorized"),
          },
        }),
      },
      "/v1/users/{id}": {
        get: op(t.getUser, {
          tags: ["Auth & Users"],
          operationId: "getUser",
          security: [{ BearerAuth: [] }],
          parameters: [pathId("id", isZh ? "用户 ID" : "User ID")],
          responses: {
            200: responseRef("SuccessEnvelope", "OK"),
            401: responseRef("ErrorEnvelope", "Unauthorized"),
            404: responseRef("ErrorEnvelope", "Not Found"),
          },
        }),
      },
      "/v1/users/{id}/info": {
        get: op(t.getUser, {
          tags: ["Auth & Users"],
          operationId: "getUserInfo",
          security: [{ BearerAuth: [] }],
          parameters: [pathId("id", isZh ? "用户 ID" : "User ID")],
          responses: {
            200: responseRef("SuccessEnvelope", "OK"),
            401: responseRef("ErrorEnvelope", "Unauthorized"),
            404: responseRef("ErrorEnvelope", "Not Found"),
          },
        }),
      },
      "/v1/workspaces/{id}/cli-tokens": {
        get: op(t.listCliTokens, {
          tags: ["Kest Cloud Sync"],
          operationId: "listWorkspaceCliTokens",
          security: [{ BearerAuth: [] }],
          parameters: [pathId("id", isZh ? "工作区 ID" : "Workspace ID")],
          responses: {
            200: responseRef("WorkspaceCLITokenArrayEnvelope", "OK"),
            401: responseRef("ErrorEnvelope", "Unauthorized"),
            404: responseRef("ErrorEnvelope", "Not Found"),
          },
        }),
        post: op(t.createCliToken, {
          tags: ["Kest Cloud Sync"],
          operationId: "createWorkspaceCliToken",
          security: [{ BearerAuth: [] }],
          parameters: [pathId("id", isZh ? "工作区 ID" : "Workspace ID")],
          requestBody: body("cliToken", ref("GenerateWorkspaceCLITokenRequest")),
          responses: {
            201: responseRef("GenerateWorkspaceCLITokenEnvelope", "Created"),
            400: responseRef("ErrorEnvelope", "Bad Request"),
            401: responseRef("ErrorEnvelope", "Unauthorized"),
            404: responseRef("ErrorEnvelope", "Not Found"),
          },
        }),
      },
      "/v1/workspaces/{id}/cli/spec-sync": {
        post: op(t.syncSpecs, {
          tags: ["Kest Cloud Sync"],
          operationId: "syncWorkspaceSpecsFromCli",
          security: [{ WorkspaceCLIToken: [] }],
          parameters: [pathId("id", isZh ? "工作区 ID" : "Workspace ID")],
          requestBody: body("syncSpecs", ref("CLISpecSyncRequest")),
          responses: {
            200: responseRef("SyncSummaryEnvelope", "OK"),
            400: responseRef("ErrorEnvelope", "Bad Request"),
            401: responseRef("ErrorEnvelope", "Unauthorized"),
            503: responseRef("ErrorEnvelope", "Service unavailable"),
          },
        }),
      },
      "/v1/workspaces/{id}/cli/history-sync": {
        post: op(t.syncHistory, {
          tags: ["Kest Cloud Sync"],
          operationId: "syncWorkspaceHistoryFromCli",
          security: [{ WorkspaceCLIToken: [] }],
          parameters: [pathId("id", isZh ? "工作区 ID" : "Workspace ID")],
          requestBody: body("syncHistory", ref("CLIHistorySyncRequest")),
          responses: {
            200: responseRef("SyncSummaryEnvelope", "OK"),
            400: responseRef("ErrorEnvelope", "Bad Request"),
            401: responseRef("ErrorEnvelope", "Unauthorized"),
            503: responseRef("ErrorEnvelope", "Service unavailable"),
          },
        }),
      },
      "/v1/workspaces/{id}/api-specs": {
        get: op(t.listApiSpecs, {
          tags: ["API Specs"],
          operationId: "listApiSpecs",
          security: [{ BearerAuth: [] }],
          parameters: [
            pathId("id", isZh ? "工作区 ID" : "Workspace ID"),
            queryInt("page", "Page number", 1),
            { name: "page_size", in: "query", schema: { type: "integer", default: 20, minimum: 1 }, description: isZh ? "每页数量" : "Page size" },
            { name: "version", in: "query", schema: { type: "string" } },
            { name: "method", in: "query", schema: { type: "string" } },
            { name: "tag", in: "query", schema: { type: "string" } },
            { name: "keyword", in: "query", schema: { type: "string" } },
          ],
          responses: {
            200: responseRef("APISpecListEnvelope", "OK"),
            401: responseRef("ErrorEnvelope", "Unauthorized"),
          },
        }),
        post: op(t.createApiSpec, {
          tags: ["API Specs"],
          operationId: "createApiSpec",
          security: [{ BearerAuth: [] }],
          parameters: [pathId("id", isZh ? "工作区 ID" : "Workspace ID")],
          requestBody: body("apiSpec", ref("CreateAPISpecRequest")),
          responses: {
            201: responseRef("APISpecEnvelope", "Created"),
            400: responseRef("ErrorEnvelope", "Bad Request"),
            401: responseRef("ErrorEnvelope", "Unauthorized"),
            409: responseRef("ErrorEnvelope", "Conflict"),
          },
        }),
      },
      "/v1/workspaces/{id}/api-specs/import": {
        post: op(t.importApiSpecs, {
          tags: ["API Specs"],
          operationId: "importApiSpecs",
          security: [{ BearerAuth: [] }],
          parameters: [pathId("id", isZh ? "工作区 ID" : "Workspace ID")],
          requestBody: body("importApiSpecs", ref("ImportAPISpecsRequest")),
          responses: {
            200: responseRef("SuccessEnvelope", "OK"),
            400: responseRef("ErrorEnvelope", "Bad Request"),
            401: responseRef("ErrorEnvelope", "Unauthorized"),
          },
        }),
      },
      "/v1/workspaces/{id}/api-specs/export": {
        get: op(t.exportApiSpecs, {
          tags: ["API Specs"],
          operationId: "exportApiSpecs",
          security: [{ BearerAuth: [] }],
          parameters: [
            pathId("id", isZh ? "工作区 ID" : "Workspace ID"),
            { name: "format", in: "query", schema: { type: "string", enum: ["json", "openapi", "swagger", "markdown"], default: "json" } },
          ],
          responses: {
            200: responseRef("SuccessEnvelope", "OK"),
            401: responseRef("ErrorEnvelope", "Unauthorized"),
          },
        }),
      },
      "/v1/workspaces/{id}/api-specs/{sid}": {
        get: op(t.getApiSpec, {
          tags: ["API Specs"],
          operationId: "getApiSpec",
          security: [{ BearerAuth: [] }],
          parameters: [pathId("id", isZh ? "工作区 ID" : "Workspace ID"), pathId("sid", isZh ? "Spec ID" : "Spec ID")],
          responses: {
            200: responseRef("APISpecEnvelope", "OK"),
            401: responseRef("ErrorEnvelope", "Unauthorized"),
            404: responseRef("ErrorEnvelope", "Not Found"),
          },
        }),
        patch: op(t.updateApiSpec, {
          tags: ["API Specs"],
          operationId: "updateApiSpec",
          security: [{ BearerAuth: [] }],
          parameters: [pathId("id", isZh ? "工作区 ID" : "Workspace ID"), pathId("sid", isZh ? "Spec ID" : "Spec ID")],
          requestBody: body("apiSpec", ref("UpdateAPISpecRequest")),
          responses: {
            200: responseRef("APISpecEnvelope", "OK"),
            400: responseRef("ErrorEnvelope", "Bad Request"),
            401: responseRef("ErrorEnvelope", "Unauthorized"),
            404: responseRef("ErrorEnvelope", "Not Found"),
          },
        }),
        delete: op(t.deleteApiSpec, {
          tags: ["API Specs"],
          operationId: "deleteApiSpec",
          security: [{ BearerAuth: [] }],
          parameters: [pathId("id", isZh ? "工作区 ID" : "Workspace ID"), pathId("sid", isZh ? "Spec ID" : "Spec ID")],
          responses: {
            204: noContent(),
            401: responseRef("ErrorEnvelope", "Unauthorized"),
            404: responseRef("ErrorEnvelope", "Not Found"),
          },
        }),
      },
      "/v1/workspaces/{id}/api-specs/{sid}/full": {
        get: op(t.getApiSpecFull, {
          tags: ["API Specs"],
          operationId: "getApiSpecWithExamples",
          security: [{ BearerAuth: [] }],
          parameters: [pathId("id", isZh ? "工作区 ID" : "Workspace ID"), pathId("sid", isZh ? "Spec ID" : "Spec ID")],
          responses: {
            200: responseRef("APISpecEnvelope", "OK"),
            401: responseRef("ErrorEnvelope", "Unauthorized"),
            404: responseRef("ErrorEnvelope", "Not Found"),
          },
        }),
      },
      "/v1/workspaces/{id}/api-specs/{sid}/examples": {
        get: op(t.listApiSpecExamples, {
          tags: ["API Specs"],
          operationId: "listApiSpecExamples",
          security: [{ BearerAuth: [] }],
          parameters: [pathId("id", isZh ? "工作区 ID" : "Workspace ID"), pathId("sid", isZh ? "Spec ID" : "Spec ID")],
          responses: {
            200: responseRef("APISpecExamplesEnvelope", "OK"),
            401: responseRef("ErrorEnvelope", "Unauthorized"),
            404: responseRef("ErrorEnvelope", "Not Found"),
          },
        }),
        post: op(t.createApiSpecExample, {
          tags: ["API Specs"],
          operationId: "createApiSpecExample",
          security: [{ BearerAuth: [] }],
          parameters: [pathId("id", isZh ? "工作区 ID" : "Workspace ID"), pathId("sid", isZh ? "Spec ID" : "Spec ID")],
          requestBody: body("apiSpecExample", ref("CreateAPIExampleRequest")),
          responses: {
            201: responseRef("SuccessEnvelope", "Created"),
            400: responseRef("ErrorEnvelope", "Bad Request"),
            401: responseRef("ErrorEnvelope", "Unauthorized"),
            404: responseRef("ErrorEnvelope", "Not Found"),
          },
        }),
      },
      "/v1/workspaces/{id}/environments": {
        get: op(t.listEnvironments, {
          tags: ["Environments"],
          operationId: "listEnvironments",
          security: [{ BearerAuth: [] }],
          parameters: [pathId("id", isZh ? "工作区 ID" : "Workspace ID")],
          responses: {
            200: responseRef("EnvironmentArrayEnvelope", "OK"),
            401: responseRef("ErrorEnvelope", "Unauthorized"),
          },
        }),
        post: op(t.createEnvironment, {
          tags: ["Environments"],
          operationId: "createEnvironment",
          security: [{ BearerAuth: [] }],
          parameters: [pathId("id", isZh ? "工作区 ID" : "Workspace ID")],
          requestBody: body("environment", ref("CreateEnvironmentRequest")),
          responses: {
            201: responseRef("EnvironmentEnvelope", "Created"),
            400: responseRef("ErrorEnvelope", "Bad Request"),
            401: responseRef("ErrorEnvelope", "Unauthorized"),
          },
        }),
      },
      "/v1/workspaces/{id}/environments/{eid}": {
        get: op(t.getEnvironment, {
          tags: ["Environments"],
          operationId: "getEnvironment",
          security: [{ BearerAuth: [] }],
          parameters: [pathId("id", isZh ? "工作区 ID" : "Workspace ID"), pathId("eid", isZh ? "环境 ID" : "Environment ID")],
          responses: {
            200: responseRef("EnvironmentEnvelope", "OK"),
            401: responseRef("ErrorEnvelope", "Unauthorized"),
            404: responseRef("ErrorEnvelope", "Not Found"),
          },
        }),
        patch: op(t.updateEnvironment, {
          tags: ["Environments"],
          operationId: "updateEnvironment",
          security: [{ BearerAuth: [] }],
          parameters: [pathId("id", isZh ? "工作区 ID" : "Workspace ID"), pathId("eid", isZh ? "环境 ID" : "Environment ID")],
          requestBody: body("environment", ref("UpdateEnvironmentRequest")),
          responses: {
            200: responseRef("EnvironmentEnvelope", "OK"),
            400: responseRef("ErrorEnvelope", "Bad Request"),
            401: responseRef("ErrorEnvelope", "Unauthorized"),
            404: responseRef("ErrorEnvelope", "Not Found"),
          },
        }),
        delete: op(t.deleteEnvironment, {
          tags: ["Environments"],
          operationId: "deleteEnvironment",
          security: [{ BearerAuth: [] }],
          parameters: [pathId("id", isZh ? "工作区 ID" : "Workspace ID"), pathId("eid", isZh ? "环境 ID" : "Environment ID")],
          responses: {
            204: noContent(),
            401: responseRef("ErrorEnvelope", "Unauthorized"),
            404: responseRef("ErrorEnvelope", "Not Found"),
          },
        }),
      },
      "/v1/workspaces/{id}/environments/{eid}/duplicate": {
        post: op(t.duplicateEnvironment, {
          tags: ["Environments"],
          operationId: "duplicateEnvironment",
          security: [{ BearerAuth: [] }],
          parameters: [pathId("id", isZh ? "工作区 ID" : "Workspace ID"), pathId("eid", isZh ? "环境 ID" : "Environment ID")],
          requestBody: body("duplicateEnvironment", ref("DuplicateEnvironmentRequest")),
          responses: {
            200: responseRef("EnvironmentEnvelope", "OK"),
            400: responseRef("ErrorEnvelope", "Bad Request"),
            401: responseRef("ErrorEnvelope", "Unauthorized"),
            404: responseRef("ErrorEnvelope", "Not Found"),
          },
        }),
      },
      "/v1/workspaces/{id}/categories": {
        get: op(t.listCategories, {
          tags: ["Categories"],
          operationId: "listCategories",
          security: [{ BearerAuth: [] }],
          parameters: [pathId("id", isZh ? "工作区 ID" : "Workspace ID"), queryInt("page", "Page number", 1), { name: "per_page", in: "query", schema: { type: "integer", default: 20 } }],
          responses: {
            200: responseRef("CategoryListEnvelope", "OK"),
            401: responseRef("ErrorEnvelope", "Unauthorized"),
          },
        }),
        post: op(t.createCategory, {
          tags: ["Categories"],
          operationId: "createCategory",
          security: [{ BearerAuth: [] }],
          parameters: [pathId("id", isZh ? "工作区 ID" : "Workspace ID")],
          requestBody: body("category", ref("CreateCategoryRequest")),
          responses: {
            201: responseRef("CategoryEnvelope", "Created"),
            400: responseRef("ErrorEnvelope", "Bad Request"),
            401: responseRef("ErrorEnvelope", "Unauthorized"),
          },
        }),
      },
      "/v1/workspaces/{id}/categories/sort": {
        put: op(t.sortCategories, {
          tags: ["Categories"],
          operationId: "sortCategories",
          security: [{ BearerAuth: [] }],
          parameters: [pathId("id", isZh ? "工作区 ID" : "Workspace ID")],
          requestBody: body("sortCategories", ref("SortCategoriesRequest")),
          responses: {
            200: responseRef("SuccessEnvelope", "OK"),
            400: responseRef("ErrorEnvelope", "Bad Request"),
            401: responseRef("ErrorEnvelope", "Unauthorized"),
          },
        }),
      },
      "/v1/workspaces/{id}/categories/{cid}": {
        get: op(t.getCategory, {
          tags: ["Categories"],
          operationId: "getCategory",
          security: [{ BearerAuth: [] }],
          parameters: [pathId("id", isZh ? "工作区 ID" : "Workspace ID"), pathId("cid", isZh ? "分类 ID" : "Category ID")],
          responses: {
            200: responseRef("CategoryEnvelope", "OK"),
            401: responseRef("ErrorEnvelope", "Unauthorized"),
            404: responseRef("ErrorEnvelope", "Not Found"),
          },
        }),
        patch: op(t.updateCategory, {
          tags: ["Categories"],
          operationId: "updateCategory",
          security: [{ BearerAuth: [] }],
          parameters: [pathId("id", isZh ? "工作区 ID" : "Workspace ID"), pathId("cid", isZh ? "分类 ID" : "Category ID")],
          requestBody: body("category", ref("UpdateCategoryRequest")),
          responses: {
            200: responseRef("CategoryEnvelope", "OK"),
            400: responseRef("ErrorEnvelope", "Bad Request"),
            401: responseRef("ErrorEnvelope", "Unauthorized"),
            404: responseRef("ErrorEnvelope", "Not Found"),
          },
        }),
        delete: op(t.deleteCategory, {
          tags: ["Categories"],
          operationId: "deleteCategory",
          security: [{ BearerAuth: [] }],
          parameters: [pathId("id", isZh ? "工作区 ID" : "Workspace ID"), pathId("cid", isZh ? "分类 ID" : "Category ID")],
          responses: {
            204: noContent(),
            401: responseRef("ErrorEnvelope", "Unauthorized"),
            404: responseRef("ErrorEnvelope", "Not Found"),
          },
        }),
      },
      "/v1/workspaces/{id}/test-cases": {
        get: op(t.listTestCases, {
          tags: ["Test Cases"],
          operationId: "listTestCases",
          security: [{ BearerAuth: [] }],
          parameters: [
            pathId("id", isZh ? "工作区 ID" : "Workspace ID"),
            { name: "api_spec_id", in: "query", schema: { type: "string" } },
            { name: "env", in: "query", schema: { type: "string" } },
            { name: "keyword", in: "query", schema: { type: "string" } },
            queryInt("page", "Page number", 1),
            { name: "page_size", in: "query", schema: { type: "integer", default: 20 } },
          ],
          responses: {
            200: responseRef("TestCaseListEnvelope", "OK"),
            401: responseRef("ErrorEnvelope", "Unauthorized"),
          },
        }),
        post: op(t.createTestCase, {
          tags: ["Test Cases"],
          operationId: "createTestCase",
          security: [{ BearerAuth: [] }],
          parameters: [pathId("id", isZh ? "工作区 ID" : "Workspace ID")],
          requestBody: body("testCase", ref("CreateTestCaseRequest")),
          responses: {
            201: responseRef("TestCaseEnvelope", "Created"),
            400: responseRef("ErrorEnvelope", "Bad Request"),
            401: responseRef("ErrorEnvelope", "Unauthorized"),
          },
        }),
      },
      "/v1/workspaces/{id}/test-cases/from-spec": {
        post: op(t.createTestCaseFromSpec, {
          tags: ["Test Cases"],
          operationId: "createTestCaseFromSpec",
          security: [{ BearerAuth: [] }],
          parameters: [pathId("id", isZh ? "工作区 ID" : "Workspace ID")],
          requestBody: body("fromSpec", ref("FromSpecRequest")),
          responses: {
            201: responseRef("TestCaseEnvelope", "Created"),
            400: responseRef("ErrorEnvelope", "Bad Request"),
            401: responseRef("ErrorEnvelope", "Unauthorized"),
            404: responseRef("ErrorEnvelope", "Not Found"),
          },
        }),
      },
      "/v1/workspaces/{id}/test-cases/{tcid}": {
        get: op(t.getTestCase, {
          tags: ["Test Cases"],
          operationId: "getTestCase",
          security: [{ BearerAuth: [] }],
          parameters: [pathId("id", isZh ? "工作区 ID" : "Workspace ID"), pathId("tcid", isZh ? "测试用例 ID" : "Test case ID")],
          responses: {
            200: responseRef("TestCaseEnvelope", "OK"),
            401: responseRef("ErrorEnvelope", "Unauthorized"),
            404: responseRef("ErrorEnvelope", "Not Found"),
          },
        }),
        patch: op(t.updateTestCase, {
          tags: ["Test Cases"],
          operationId: "updateTestCase",
          security: [{ BearerAuth: [] }],
          parameters: [pathId("id", isZh ? "工作区 ID" : "Workspace ID"), pathId("tcid", isZh ? "测试用例 ID" : "Test case ID")],
          requestBody: body("testCase", ref("UpdateTestCaseRequest")),
          responses: {
            200: responseRef("TestCaseEnvelope", "OK"),
            400: responseRef("ErrorEnvelope", "Bad Request"),
            401: responseRef("ErrorEnvelope", "Unauthorized"),
            404: responseRef("ErrorEnvelope", "Not Found"),
          },
        }),
        delete: op(t.deleteTestCase, {
          tags: ["Test Cases"],
          operationId: "deleteTestCase",
          security: [{ BearerAuth: [] }],
          parameters: [pathId("id", isZh ? "工作区 ID" : "Workspace ID"), pathId("tcid", isZh ? "测试用例 ID" : "Test case ID")],
          responses: {
            204: noContent(),
            401: responseRef("ErrorEnvelope", "Unauthorized"),
            404: responseRef("ErrorEnvelope", "Not Found"),
          },
        }),
      },
      "/v1/workspaces/{id}/test-cases/{tcid}/duplicate": {
        post: op(t.duplicateTestCase, {
          tags: ["Test Cases"],
          operationId: "duplicateTestCase",
          security: [{ BearerAuth: [] }],
          parameters: [pathId("id", isZh ? "工作区 ID" : "Workspace ID"), pathId("tcid", isZh ? "测试用例 ID" : "Test case ID")],
          requestBody: body("duplicate", ref("DuplicateTestCaseRequest")),
          responses: {
            201: responseRef("TestCaseEnvelope", "Created"),
            400: responseRef("ErrorEnvelope", "Bad Request"),
            401: responseRef("ErrorEnvelope", "Unauthorized"),
            404: responseRef("ErrorEnvelope", "Not Found"),
          },
        }),
      },
      "/v1/workspaces/{id}/test-cases/{tcid}/run": {
        post: op(t.runTestCase, {
          tags: ["Test Cases"],
          operationId: "runTestCase",
          security: [{ BearerAuth: [] }],
          parameters: [pathId("id", isZh ? "工作区 ID" : "Workspace ID"), pathId("tcid", isZh ? "测试用例 ID" : "Test case ID")],
          requestBody: body("run", ref("RunTestCaseRequest"), false),
          responses: {
            200: responseRef("RunResultEnvelope", "OK"),
            401: responseRef("ErrorEnvelope", "Unauthorized"),
            404: responseRef("ErrorEnvelope", "Not Found"),
          },
        }),
      },
      "/v1/workspaces/{id}/test-cases/{tcid}/runs": {
        get: op(t.listTestRuns, {
          tags: ["Test Cases"],
          operationId: "listTestRuns",
          security: [{ BearerAuth: [] }],
          parameters: [
            pathId("id", isZh ? "工作区 ID" : "Workspace ID"),
            pathId("tcid", isZh ? "测试用例 ID" : "Test case ID"),
            { name: "status", in: "query", schema: { type: "string" } },
            queryInt("page", "Page number", 1),
            { name: "page_size", in: "query", schema: { type: "integer", default: 20 } },
          ],
          responses: {
            200: responseRef("TestRunListEnvelope", "OK"),
            401: responseRef("ErrorEnvelope", "Unauthorized"),
          },
        }),
      },
      "/v1/workspaces/{id}/test-cases/{tcid}/runs/{rid}": {
        get: op(t.getTestRun, {
          tags: ["Test Cases"],
          operationId: "getTestRun",
          security: [{ BearerAuth: [] }],
          parameters: [
            pathId("id", isZh ? "工作区 ID" : "Workspace ID"),
            pathId("tcid", isZh ? "测试用例 ID" : "Test case ID"),
            pathId("rid", isZh ? "运行 ID" : "Run ID"),
          ],
          responses: {
            200: responseRef("TestRunEnvelope", "OK"),
            401: responseRef("ErrorEnvelope", "Unauthorized"),
            404: responseRef("ErrorEnvelope", "Not Found"),
          },
        }),
      },
      "/v1/permissions": {
        get: op(t.listPermissions, {
          tags: ["Permissions"],
          operationId: "listPermissions",
          security: [{ BearerAuth: [] }],
          responses: {
            200: {
              description: "OK",
              content: { "application/json": { schema: ref("PermissionArrayEnvelope") } },
            },
            401: responseRef("ErrorEnvelope", "Unauthorized"),
          },
        }),
      },
      "/v1/roles": {
        get: op(t.listRoles, {
          tags: ["Permissions"],
          operationId: "listRoles",
          security: [{ BearerAuth: [] }],
          responses: {
            200: {
              description: "OK",
              content: { "application/json": { schema: ref("RoleArrayEnvelope") } },
            },
            401: responseRef("ErrorEnvelope", "Unauthorized"),
          },
        }),
        post: op(t.createRole, {
          tags: ["Permissions"],
          operationId: "createRole",
          security: [{ BearerAuth: [] }],
          requestBody: body("role", ref("CreateRoleRequest")),
          responses: {
            201: {
              description: "Created",
              content: { "application/json": { schema: ref("RoleEnvelope") } },
            },
            400: responseRef("ErrorEnvelope", "Bad Request"),
            401: responseRef("ErrorEnvelope", "Unauthorized"),
          },
        }),
      },
      "/v1/roles/{id}": {
        get: op(t.getRole, {
          tags: ["Permissions"],
          operationId: "getRole",
          security: [{ BearerAuth: [] }],
          parameters: [pathId("id", isZh ? "角色 ID" : "Role ID")],
          responses: {
            200: {
              description: "OK",
              content: { "application/json": { schema: ref("RoleEnvelope") } },
            },
            401: responseRef("ErrorEnvelope", "Unauthorized"),
            404: responseRef("ErrorEnvelope", "Not Found"),
          },
        }),
        put: op(t.updateRole, {
          tags: ["Permissions"],
          operationId: "updateRole",
          security: [{ BearerAuth: [] }],
          parameters: [pathId("id", isZh ? "角色 ID" : "Role ID")],
          requestBody: body("role", ref("UpdateRoleRequest")),
          responses: {
            200: {
              description: "OK",
              content: { "application/json": { schema: ref("RoleEnvelope") } },
            },
            400: responseRef("ErrorEnvelope", "Bad Request"),
            401: responseRef("ErrorEnvelope", "Unauthorized"),
          },
        }),
        delete: op(t.deleteRole, {
          tags: ["Permissions"],
          operationId: "deleteRole",
          security: [{ BearerAuth: [] }],
          parameters: [pathId("id", isZh ? "角色 ID" : "Role ID")],
          responses: {
            204: noContent(),
            401: responseRef("ErrorEnvelope", "Unauthorized"),
          },
        }),
      },
      "/v1/roles/assign": {
        post: op(t.assignRole, {
          tags: ["Permissions"],
          operationId: "assignRole",
          security: [{ BearerAuth: [] }],
          requestBody: body("assignRole", ref("AssignRoleRequest")),
          responses: {
            204: noContent(),
            400: responseRef("ErrorEnvelope", "Bad Request"),
            401: responseRef("ErrorEnvelope", "Unauthorized"),
          },
        }),
      },
      "/v1/roles/remove": {
        post: op(t.removeRole, {
          tags: ["Permissions"],
          operationId: "removeRole",
          security: [{ BearerAuth: [] }],
          requestBody: body("removeRole", ref("AssignRoleRequest")),
          responses: {
            204: noContent(),
            400: responseRef("ErrorEnvelope", "Bad Request"),
            401: responseRef("ErrorEnvelope", "Unauthorized"),
          },
        }),
      },
      "/v1/users/{id}/roles": {
        get: op(t.getUserRoles, {
          tags: ["Permissions"],
          operationId: "getUserRoles",
          security: [{ BearerAuth: [] }],
          parameters: [pathId("id", isZh ? "用户 ID" : "User ID")],
          responses: {
            200: {
              description: "OK",
              content: { "application/json": { schema: ref("UserRolesEnvelope") } },
            },
            401: responseRef("ErrorEnvelope", "Unauthorized"),
          },
        }),
      },
      "/v1/workspaces/{id}/collections": {
        get: op(t.listCollections, {
          tags: ["Collections"],
          operationId: "listCollections",
          security: [{ BearerAuth: [] }],
          parameters: [pathId("id", isZh ? "工作区 ID" : "Workspace ID"), queryInt("page", "Page number", 1), { name: "per_page", in: "query", schema: { type: "integer", default: 20 } }],
          responses: {
            200: responseRef("CollectionListEnvelope", "OK"),
            401: responseRef("ErrorEnvelope", "Unauthorized"),
          },
        }),
        post: op(t.createCollection, {
          tags: ["Collections"],
          operationId: "createCollection",
          security: [{ BearerAuth: [] }],
          parameters: [pathId("id", isZh ? "工作区 ID" : "Workspace ID")],
          requestBody: body("collection", ref("CreateCollectionRequest")),
          responses: {
            201: responseRef("CollectionEnvelope", "Created"),
            400: responseRef("ErrorEnvelope", "Bad Request"),
            401: responseRef("ErrorEnvelope", "Unauthorized"),
          },
        }),
      },
      "/v1/workspaces/{id}/collections/tree": {
        get: op(t.getCollectionTree, {
          tags: ["Collections"],
          operationId: "getCollectionTree",
          security: [{ BearerAuth: [] }],
          parameters: [pathId("id", isZh ? "工作区 ID" : "Workspace ID")],
          responses: {
            200: responseRef("CollectionTreeEnvelope", "OK"),
            401: responseRef("ErrorEnvelope", "Unauthorized"),
          },
        }),
      },
      "/v1/workspaces/{id}/collections/{cid}": {
        get: op(t.getCollection, {
          tags: ["Collections"],
          operationId: "getCollection",
          security: [{ BearerAuth: [] }],
          parameters: [pathId("id", isZh ? "工作区 ID" : "Workspace ID"), pathId("cid", isZh ? "集合 ID" : "Collection ID")],
          responses: {
            200: responseRef("CollectionEnvelope", "OK"),
            401: responseRef("ErrorEnvelope", "Unauthorized"),
            404: responseRef("ErrorEnvelope", "Not Found"),
          },
        }),
        put: op(t.updateCollection, {
          tags: ["Collections"],
          operationId: "updateCollection",
          security: [{ BearerAuth: [] }],
          parameters: [pathId("id", isZh ? "工作区 ID" : "Workspace ID"), pathId("cid", isZh ? "集合 ID" : "Collection ID")],
          requestBody: body("collection", ref("UpdateCollectionRequest")),
          responses: {
            200: responseRef("CollectionEnvelope", "OK"),
            400: responseRef("ErrorEnvelope", "Bad Request"),
            401: responseRef("ErrorEnvelope", "Unauthorized"),
            404: responseRef("ErrorEnvelope", "Not Found"),
          },
        }),
        delete: op(t.deleteCollection, {
          tags: ["Collections"],
          operationId: "deleteCollection",
          security: [{ BearerAuth: [] }],
          parameters: [pathId("id", isZh ? "工作区 ID" : "Workspace ID"), pathId("cid", isZh ? "集合 ID" : "Collection ID")],
          responses: {
            200: responseRef("SuccessEnvelope", "OK"),
            401: responseRef("ErrorEnvelope", "Unauthorized"),
            404: responseRef("ErrorEnvelope", "Not Found"),
          },
        }),
      },
      "/v1/workspaces/{id}/collections/{cid}/move": {
        patch: op(t.moveCollection, {
          tags: ["Collections"],
          operationId: "moveCollection",
          security: [{ BearerAuth: [] }],
          parameters: [pathId("id", isZh ? "工作区 ID" : "Workspace ID"), pathId("cid", isZh ? "集合 ID" : "Collection ID")],
          requestBody: body("collectionMove", ref("MoveCollectionRequest")),
          responses: {
            200: responseRef("CollectionEnvelope", "OK"),
            400: responseRef("ErrorEnvelope", "Bad Request"),
            401: responseRef("ErrorEnvelope", "Unauthorized"),
            404: responseRef("ErrorEnvelope", "Not Found"),
          },
        }),
      },
      "/v1/workspaces/{id}/collections/{cid}/requests": {
        get: op(t.listRequests, {
          tags: ["Requests"],
          operationId: "listRequests",
          security: [{ BearerAuth: [] }],
          parameters: [
            pathId("id", isZh ? "工作区 ID" : "Workspace ID"),
            pathId("cid", isZh ? "集合 ID" : "Collection ID"),
            queryInt("page", "Page number", 1),
            { name: "per_page", in: "query", schema: { type: "integer", default: 20 } },
          ],
          responses: {
            200: responseRef("RequestListEnvelope", "OK"),
            401: responseRef("ErrorEnvelope", "Unauthorized"),
            404: responseRef("ErrorEnvelope", "Not Found"),
          },
        }),
        post: op(t.createRequest, {
          tags: ["Requests"],
          operationId: "createRequest",
          security: [{ BearerAuth: [] }],
          parameters: [pathId("id", isZh ? "工作区 ID" : "Workspace ID"), pathId("cid", isZh ? "集合 ID" : "Collection ID")],
          requestBody: body("request", ref("CreateRequestRequest")),
          responses: {
            201: responseRef("RequestEnvelope", "Created"),
            400: responseRef("ErrorEnvelope", "Bad Request"),
            401: responseRef("ErrorEnvelope", "Unauthorized"),
            404: responseRef("ErrorEnvelope", "Not Found"),
          },
        }),
      },
      "/v1/workspaces/{id}/collections/{cid}/requests/{rid}": {
        get: op(t.getRequest, {
          tags: ["Requests"],
          operationId: "getRequest",
          security: [{ BearerAuth: [] }],
          parameters: [
            pathId("id", isZh ? "工作区 ID" : "Workspace ID"),
            pathId("cid", isZh ? "集合 ID" : "Collection ID"),
            pathId("rid", isZh ? "请求 ID" : "Request ID"),
          ],
          responses: {
            200: responseRef("RequestEnvelope", "OK"),
            401: responseRef("ErrorEnvelope", "Unauthorized"),
            404: responseRef("ErrorEnvelope", "Not Found"),
          },
        }),
        put: op(t.updateRequest, {
          tags: ["Requests"],
          operationId: "updateRequest",
          security: [{ BearerAuth: [] }],
          parameters: [
            pathId("id", isZh ? "工作区 ID" : "Workspace ID"),
            pathId("cid", isZh ? "集合 ID" : "Collection ID"),
            pathId("rid", isZh ? "请求 ID" : "Request ID"),
          ],
          requestBody: body("request", ref("UpdateRequestRequest")),
          responses: {
            200: responseRef("RequestEnvelope", "OK"),
            400: responseRef("ErrorEnvelope", "Bad Request"),
            401: responseRef("ErrorEnvelope", "Unauthorized"),
            404: responseRef("ErrorEnvelope", "Not Found"),
          },
        }),
        delete: op(t.deleteRequest, {
          tags: ["Requests"],
          operationId: "deleteRequest",
          security: [{ BearerAuth: [] }],
          parameters: [
            pathId("id", isZh ? "工作区 ID" : "Workspace ID"),
            pathId("cid", isZh ? "集合 ID" : "Collection ID"),
            pathId("rid", isZh ? "请求 ID" : "Request ID"),
          ],
          responses: {
            200: responseRef("SuccessEnvelope", "OK"),
            401: responseRef("ErrorEnvelope", "Unauthorized"),
            404: responseRef("ErrorEnvelope", "Not Found"),
          },
        }),
      },
      "/v1/workspaces/{id}/collections/{cid}/requests/{rid}/move": {
        patch: op(t.moveRequest, {
          tags: ["Requests"],
          operationId: "moveRequest",
          security: [{ BearerAuth: [] }],
          parameters: [
            pathId("id", isZh ? "工作区 ID" : "Workspace ID"),
            pathId("cid", isZh ? "集合 ID" : "Collection ID"),
            pathId("rid", isZh ? "请求 ID" : "Request ID"),
          ],
          requestBody: body("requestMove", ref("MoveRequestRequest")),
          responses: {
            200: responseRef("RequestEnvelope", "OK"),
            400: responseRef("ErrorEnvelope", "Bad Request"),
            401: responseRef("ErrorEnvelope", "Unauthorized"),
            404: responseRef("ErrorEnvelope", "Not Found"),
          },
        }),
      },
      "/v1/workspaces/{id}/collections/{cid}/requests/{rid}/rollback": {
        post: op(t.rollbackRequest, {
          tags: ["Requests"],
          operationId: "rollbackRequest",
          security: [{ BearerAuth: [] }],
          parameters: [
            pathId("id", isZh ? "工作区 ID" : "Workspace ID"),
            pathId("cid", isZh ? "集合 ID" : "Collection ID"),
            pathId("rid", isZh ? "请求 ID" : "Request ID"),
          ],
          requestBody: body("rollback", ref("RollbackRequest")),
          responses: {
            200: responseRef("RequestEnvelope", "OK"),
            400: responseRef("ErrorEnvelope", "Bad Request"),
            401: responseRef("ErrorEnvelope", "Unauthorized"),
            404: responseRef("ErrorEnvelope", "Not Found"),
          },
        }),
      },
      "/v1/workspaces/{id}/history": {
        get: op(t.listHistory, {
          tags: ["History"],
          operationId: "listHistory",
          security: [{ BearerAuth: [] }],
          parameters: [
            pathId("id", isZh ? "工作区 ID" : "Workspace ID"),
            { name: "entity_type", in: "query", schema: { type: "string" } },
            { name: "entity_id", in: "query", schema: { type: "string" } },
            queryInt("page", "Page number", 1),
            { name: "per_page", in: "query", schema: { type: "integer", default: 20 } },
          ],
          responses: {
            200: responseRef("HistoryListEnvelope", "OK"),
            401: responseRef("ErrorEnvelope", "Unauthorized"),
          },
        }),
        post: op(t.createHistory, {
          tags: ["History"],
          operationId: "createHistory",
          security: [{ BearerAuth: [] }],
          parameters: [pathId("id", isZh ? "工作区 ID" : "Workspace ID")],
          requestBody: body("history", ref("RecordHistoryRequest")),
          responses: {
            201: responseRef("HistoryEnvelope", "Created"),
            400: responseRef("ErrorEnvelope", "Bad Request"),
            401: responseRef("ErrorEnvelope", "Unauthorized"),
          },
        }),
      },
      "/v1/workspaces/{id}/history/{hid}": {
        get: op(t.getHistory, {
          tags: ["History"],
          operationId: "getHistory",
          security: [{ BearerAuth: [] }],
          parameters: [pathId("id", isZh ? "工作区 ID" : "Workspace ID"), pathId("hid", isZh ? "历史记录 ID" : "History ID")],
          responses: {
            200: responseRef("HistoryEnvelope", "OK"),
            401: responseRef("ErrorEnvelope", "Unauthorized"),
            404: responseRef("ErrorEnvelope", "Not Found"),
          },
        }),
      },
      "/v1/workspaces": {
        get: op(t.listWorkspaces, {
          tags: ["Workspaces"],
          operationId: "listWorkspaces",
          security: [{ BearerAuth: [] }],
          responses: {
            200: responseRef("WorkspaceArrayEnvelope", "OK"),
            401: responseRef("ErrorEnvelope", "Unauthorized"),
          },
        }),
        post: op(t.createWorkspace, {
          tags: ["Workspaces"],
          operationId: "createWorkspace",
          security: [{ BearerAuth: [] }],
          requestBody: body("workspace", ref("CreateWorkspaceRequest")),
          responses: {
            201: responseRef("WorkspaceEnvelope", "Created"),
            400: responseRef("ErrorEnvelope", "Bad Request"),
            401: responseRef("ErrorEnvelope", "Unauthorized"),
          },
        }),
      },
      "/v1/workspaces/{id}": {
        get: op(t.getWorkspace, {
          tags: ["Workspaces"],
          operationId: "getWorkspace",
          security: [{ BearerAuth: [] }],
          parameters: [pathId("id", isZh ? "工作区 ID" : "Workspace ID")],
          responses: {
            200: responseRef("WorkspaceEnvelope", "OK"),
            401: responseRef("ErrorEnvelope", "Unauthorized"),
            404: responseRef("ErrorEnvelope", "Not Found"),
          },
        }),
        patch: op(t.updateWorkspace, {
          tags: ["Workspaces"],
          operationId: "updateWorkspace",
          security: [{ BearerAuth: [] }],
          parameters: [pathId("id", isZh ? "工作区 ID" : "Workspace ID")],
          requestBody: body("workspace", ref("UpdateWorkspaceRequest")),
          responses: {
            200: responseRef("WorkspaceEnvelope", "OK"),
            400: responseRef("ErrorEnvelope", "Bad Request"),
            401: responseRef("ErrorEnvelope", "Unauthorized"),
          },
        }),
        delete: op(t.deleteWorkspace, {
          tags: ["Workspaces"],
          operationId: "deleteWorkspace",
          security: [{ BearerAuth: [] }],
          parameters: [pathId("id", isZh ? "工作区 ID" : "Workspace ID")],
          responses: {
            204: noContent(),
            401: responseRef("ErrorEnvelope", "Unauthorized"),
          },
        }),
      },
      "/v1/workspaces/{id}/members": {
        get: op(t.listWorkspaceMembers, {
          tags: ["Workspaces"],
          operationId: "listWorkspaceMembers",
          security: [{ BearerAuth: [] }],
          parameters: [pathId("id", isZh ? "工作区 ID" : "Workspace ID")],
          responses: {
            200: responseRef("WorkspaceMemberArrayEnvelope", "OK"),
            401: responseRef("ErrorEnvelope", "Unauthorized"),
          },
        }),
        post: op(t.addWorkspaceMember, {
          tags: ["Workspaces"],
          operationId: "addWorkspaceMember",
          security: [{ BearerAuth: [] }],
          parameters: [pathId("id", isZh ? "工作区 ID" : "Workspace ID")],
          requestBody: body("workspaceMember", ref("AddWorkspaceMemberRequest")),
          responses: {
            201: responseRef("SuccessEnvelope", "Created"),
            400: responseRef("ErrorEnvelope", "Bad Request"),
            401: responseRef("ErrorEnvelope", "Unauthorized"),
          },
        }),
      },
      "/v1/workspaces/{id}/members/{uid}": {
        patch: op(t.updateWorkspaceMemberRole, {
          tags: ["Workspaces"],
          operationId: "updateWorkspaceMemberRole",
          security: [{ BearerAuth: [] }],
          parameters: [pathId("id", isZh ? "工作区 ID" : "Workspace ID"), pathId("uid", isZh ? "用户 ID" : "User ID")],
          requestBody: body("workspaceMember", ref("UpdateWorkspaceMemberRoleRequest")),
          responses: {
            200: responseRef("SuccessEnvelope", "OK"),
            400: responseRef("ErrorEnvelope", "Bad Request"),
            401: responseRef("ErrorEnvelope", "Unauthorized"),
          },
        }),
        delete: op(t.removeWorkspaceMember, {
          tags: ["Workspaces"],
          operationId: "removeWorkspaceMember",
          security: [{ BearerAuth: [] }],
          parameters: [pathId("id", isZh ? "工作区 ID" : "Workspace ID"), pathId("uid", isZh ? "用户 ID" : "User ID")],
          responses: {
            204: noContent(),
            401: responseRef("ErrorEnvelope", "Unauthorized"),
          },
        }),
      },
      "/v1/system-features": {
        get: op(t.getSystemFeatures, {
          tags: ["System"],
          operationId: "getSystemFeatures",
          security: [],
          responses: {
            200: responseRef("SystemFeaturesEnvelope", "OK"),
            400: responseRef("ErrorEnvelope", "Bad Request"),
          },
        }),
      },
      "/v1/setup-status": {
        get: op(t.getSetupStatus, {
          tags: ["System"],
          operationId: "getSetupStatus",
          security: [],
          responses: {
            200: responseRef("SetupStatusEnvelope", "OK"),
            400: responseRef("ErrorEnvelope", "Bad Request"),
          },
        }),
      },
    },
  };
}

function write(locale) {
  const spec = buildSpec(locale);
  const target = path.join(outDir, `kest-v1-${locale}.yaml`);
  fs.writeFileSync(target, `${JSON.stringify(spec, null, 2)}\n`);
}

fs.mkdirSync(outDir, { recursive: true });
write("en");
write("zh");
