## Account / Identity

| Term | Source / Status | Definition | Examples |
| --- | --- | --- | --- |
| User | Current + DBML | A person account that can sign in, own resources, and collaborate in organizations, workspaces, or projects. | `mingde@example.com` signs in and creates a workspace. |
| Account | Product | The user's identity and access container, including credentials, profile, and status. | An account is disabled after repeated abuse. |
| Profile | Current | Public or editable user-facing identity information such as nickname, avatar, phone, and bio. | A user updates their avatar and bio from account settings. |
| Username | Current + DBML | A unique or displayable login identifier for a user. | `mingde` is used as a username. |
| Email | Current + DBML | A unique contact and login identifier for a user. | `dev@company.com` receives invitation emails. |
| Password | Current | A secret credential stored as a password hash in persistence. | A password is changed from the profile security page. |
| Avatar | Current | A URL or asset representing the user visually. | The member list shows the user's avatar beside their name. |
| Bio | Current | A short user profile description. | `Backend engineer on the payments team`. |
| User Status | Current + DBML | The lifecycle state of a user account, such as active or disabled. | `active`, `disabled`, or `banned`. |
| Super Admin | Current + DBML | A system-level administrator with elevated access across normal workspace boundaries. | A super admin can inspect setup status for the whole instance. |
| Access Token | Current API | A bearer token used by clients to authenticate API requests. | `Authorization: Bearer eyJ...` on API calls. |
| JWT | Current API | The current token format used for authenticated web/API sessions. | The login endpoint returns a JWT access token. |
| Session | Product | A user's authenticated interaction period with the web console or API. | A browser session remains signed in until the token expires. |
| Login | Current API | The act of authenticating a user and issuing an access token. | `POST /login` with username and password. |
| Registration | Current API | The act of creating a new user account. | `POST /register` creates a new account. |
| Password Reset | Current API | The recovery flow for resetting a user's password. | `POST /password/reset` starts recovery by email. |

## Organization / Workspace

| Term | Source / Status | Definition | Examples |
| --- | --- | --- | --- |
| Organization | New DBML | A team or company-level container that can own multiple workspaces. | `Acme Platform` owns `Payments API` and `Mobile API` workspaces. |
| Organization Member | New DBML | A user's membership record inside an organization. | Alice is an admin in the Acme organization. |
| Workspace | Current + DBML | The proposed primary collaboration and resource boundary for API assets, environments, runs, and members. | `Payments API Workspace` contains collections, environments, and tests. |
| Workspace Member | Current + DBML | A user's membership record inside a workspace, including role and status. | Bob has `write` access to a workspace. |
| Project | Current / Legacy Candidate | The current primary resource boundary in Kest; likely to be replaced by or migrated into Workspace. | Current route: `/projects/:id/api-specs`. |
| Project Member | Current / Legacy Candidate | Current project-scoped membership model with owner/admin/write/read roles. | A project member is assigned the `admin` role. |
| Owner | Current + DBML | The highest scoped role for a project, workspace, or organization. | The workspace creator is added as owner. |
| Admin | Current + DBML | A scoped management role below owner. | An admin invites teammates and manages roles. |
| Member | Current + DBML | A user associated with an organization, workspace, or project. | A member can view shared API requests. |
| Editor | Current Workspace | A workspace role with write-like permissions in the current workspace module. | An editor updates a request description. |
| Viewer | Current Workspace | A workspace role with read-only access in the current workspace module. | A viewer opens API docs but cannot edit them. |
| Write | Current Project | A project role that allows mutation of project resources. | A write user creates a new environment. |
| Read | Current Project | A project role that allows viewing project resources. | A read user lists collections and runs. |
| Role | Current + DBML | A named access level or permission bundle. | `owner`, `admin`, `write`, and `read`. |
| Permission | Current API | A granular authorization capability. | `api_specs:write` allows editing API specs. |
| Role Permission | Current | A mapping between a role and a permission. | The admin role grants `members:write`. |
| User Role | Current | A mapping between a user and a role. | Alice is assigned the `admin` role. |
| Visibility | Current + DBML | The exposure level of a workspace or documentation resource, such as private, team, or public. | Documentation visibility is set to `public`. |
| Slug | Current + DBML | A URL-friendly unique identifier for organizations, workspaces, or projects. | `payments-api` appears in a share URL. |
| Settings | Current + DBML | JSON-backed configuration attached to a workspace or collection-like resource. | A workspace setting stores preferred locale. |
| Invitation | Current + DBML | An invite record used to add a user to a project or workspace. | An invitation grants `read` access to a workspace. |
| Invite Token | Current + DBML | A secret or hashed token used to accept an invitation. | An invite link includes a one-time token. |
| Inviter | New DBML | The user who created an invitation. | Alice invites Bob to the workspace. |
| CLI Token | Current + DBML | A scoped token used by the CLI for sync or run operations. | `kest_pat_...` is used by `kest sync`. |
| Token Prefix | Current + DBML | A safe visible prefix used to identify a token without exposing the full secret. | `kest_pat_ab12cd34` is displayed in token lists. |
| Token Hash | Current + DBML | The hashed token value stored for verification. | The raw CLI token is never stored, only its hash. |
| Scope | Current + DBML | A token or variable boundary describing what an operation can access. | `spec:write` lets the CLI upload API specs. |
| Public Key | Current Project | A project identifier used by current ingest or integration flows. | A DSN includes the project public key. |

## Environment / Variables

| Term | Source / Status | Definition | Examples |
| --- | --- | --- | --- |
| Environment | Current + DBML | A named runtime configuration context for requests and tests. | `development`, `staging`, or `production`. |
| Default Environment | New DBML | The workspace environment selected by default for execution. | The workspace defaults to `staging` when running requests. |
| Variable | Current + DBML | A named value that can be resolved into request URLs, headers, bodies, or scripts. | `{{base_url}}` resolves to `https://api.example.com`. |
| Workspace Variable | New DBML | A variable scoped to an entire workspace. | `company_id` is available to all collections. |
| Collection Variable | New DBML | A variable scoped to a collection. | `catalog_version` is only used by the Catalog collection. |
| Environment Variable | Current + DBML | A variable scoped to an environment. | `base_url` differs between staging and production. |
| Runtime Variable | New DBML | A variable produced or overridden during execution. | A login step captures `access_token` for later steps. |
| Scope Type | New DBML | The kind of scope a variable belongs to, such as workspace, collection, environment, or runtime. | `scope_type = environment`. |
| Scope ID | New DBML | The concrete resource ID associated with a variable scope. | A variable points to a specific environment ID. |
| Initial Value | New DBML | The shared or default value of a variable. | `initial_value = https://api.example.com`. |
| Current Value | New DBML | The local or runtime value of a variable. | `current_value = https://staging.example.com`. |
| Secret | New DBML | A variable whose value should be protected from normal display or logs. | `api_token` is masked in the UI. |
| Plain Variable | New DBML | A normal variable that is safe to display. | `region = eu-west-1`. |
| Base URL | Current | The environment-level base endpoint used to resolve request URLs. | `{{base_url}}/v1/users`. |
| Headers | Current | A set of HTTP headers applied to a request, example, environment, or execution. | `Authorization` and `Content-Type` headers. |

## Collection / Request

| Term | Source / Status | Definition | Examples |
| --- | --- | --- | --- |
| Collection | Current + DBML | A group of API requests and folders within a workspace. | `User Management API` collection. |
| Folder | New DBML | A nested grouping unit inside a collection. | `Auth` folder inside a collection. |
| Request | Current + DBML | A saved HTTP request definition. | `GET {{base_url}}/v1/users`. |
| HTTP Method | Current + DBML | The request verb, such as GET, POST, PUT, PATCH, or DELETE. | `POST` for creating a user. |
| URL | Current + DBML | The target URL or templated URL for a request. | `{{base_url}}/v1/orders/:id`. |
| Path | Current | The path portion of an API endpoint or request URL. | `/v1/users/{id}`. |
| Header | Current + DBML | A single HTTP header key-value pair. | `Content-Type: application/json`. |
| Query Parameter | Current + DBML | A key-value parameter encoded in the request URL query string. | `page=1` and `per_page=20`. |
| Path Parameter | Current + DBML | A named parameter embedded in the URL path. | `id` in `/users/:id`. |
| Request Body | Current + DBML | The payload sent with a request. | `{ "name": "Alice" }`. |
| Body Type | Current | The body format, such as none, json, form-data, urlencoded, binary, or graphql. | `json` for a JSON payload. |
| Authentication Config | Current | Request-level auth settings such as basic, bearer, API key, or OAuth2. | A request uses bearer token auth. |
| Basic Auth | Current | Username/password HTTP authentication configuration. | Username `demo`, password `secret`. |
| Bearer Token | Current | Token-based HTTP authentication configuration. | `Bearer {{access_token}}`. |
| API Key Auth | Current | API key authentication configuration. | `x-api-key: {{api_key}}`. |
| OAuth2 | Current | OAuth2 authentication configuration for requests. | Client credentials flow for machine access. |
| Pre-request Script | Current + DBML | A script executed before sending a request or running a test. | A script sets `timestamp` before sending. |
| Test Script | Current + DBML | A script used to validate or process a response. | A script checks that status is 200. |
| Sort Order | Current + DBML | A numeric field used to order resources in lists or trees. | `sort_order = 10` places a request after another. |
| Import | Current API | The act of creating resources from an external format. | Import a Postman collection JSON file. |
| Export | Current API | The act of producing an external representation of resources. | Export a collection as Postman JSON. |
| Postman Collection | Current API | A Postman-compatible import/export format. | `postman_collection.json`. |
| Markdown Collection | Current API | A Markdown-based import format for collections and requests. | `api-reference.md` is imported into requests. |

## API Specification / Documentation

| Term | Source / Status | Definition | Examples |
| --- | --- | --- | --- |
| API Spec | Current + DBML | A machine-readable or curated representation of an API contract. | The OpenAPI spec for the Payments API. |
| API Specification | Current API | The formal API contract resource managed by Kest. | `GET /projects/:id/api-specs`. |
| API Endpoint | Current / Recommended | A concrete operation identified by method and path. | `GET /v1/users/{id}`. |
| Operation | New DBML / Recommended | A method-and-path unit inside an API specification. | The `createUser` operation in OpenAPI. |
| API Category | Current | A project-scoped grouping for API specs. | `Authentication` category. |
| Category | Current | A hierarchical grouping label for API specs. | `Billing` with child category `Invoices`. |
| Tag | Current | A lightweight label attached to an API spec or operation. | `internal`, `beta`, or `payments`. |
| Version | Current + DBML | The API or documentation version string. | `v1` or `2026-05`. |
| Summary | Current | A short human-readable description. | `List users`. |
| Description | Current + DBML | A longer human-readable explanation. | `Returns a paginated list of active users.` |
| Parameter | Current | A query, path, header, or cookie parameter definition. | `page` query parameter. |
| Request Body Spec | Current | The schema or description for an operation request body. | JSON schema for creating a user. |
| Response Spec | Current | The expected response schema and metadata for an operation. | `200` response with `User[]`. |
| API Example | Current | A request/response example attached to an API spec. | Example response for `GET /users`. |
| Response Example | New DBML | A reusable saved example response attached to a request or API spec. | `201 Created` response for create user. |
| Documentation | New DBML | Human-readable content generated from or attached to API specs or collections. | Public docs page for the Payments API. |
| API Documentation | Current Product | User-facing documentation for API specs or endpoints. | Markdown docs generated from a spec. |
| Doc Markdown | Current | Markdown-formatted API documentation content. | `## List Users` markdown content. |
| Doc Source | Current | The origin of documentation content, such as manual or AI. | `manual` or `ai`. |
| Public Share | Current | A public share link for API documentation or an API spec snapshot. | `/public/api-spec-shares/catalog-api`. |
| Share Snapshot | Current | The serialized public copy of a shareable API spec. | A frozen copy of a spec at publish time. |
| AI Draft | Current | An AI-generated API spec draft before acceptance. | AI drafts `POST /orders` from a prompt. |
| Draft | Current + DBML | A non-final resource version or generated proposal. | A generated spec draft not yet accepted. |
| Accepted Spec | Current | The API spec created from an accepted AI draft. | A draft becomes a saved API spec. |
| Field Insight | Current | AI-generated confidence or source metadata for generated fields. | `path` inferred with high confidence. |
| Convention | Current | Project-level API style or response pattern inferred for AI generation. | Responses use `{ code, message, data }`. |
| Assumption | Current | A documented AI or generation assumption. | Assume auth uses bearer tokens. |
| Question | Current | A clarification question produced during AI draft generation. | Should this endpoint be public or private? |
| OpenAPI | Current + DBML | A supported API schema format. | `openapi.yaml`. |
| Swagger | Current | A legacy or compatible naming for OpenAPI-style exports. | Export specs as Swagger JSON. |
| GraphQL | New DBML | A proposed API spec format. | GraphQL schema for a gateway API. |
| AsyncAPI | New DBML | A proposed API spec format for asynchronous APIs. | AsyncAPI schema for Kafka events. |

## Execution / Testing

| Term | Source / Status | Definition | Examples |
| --- | --- | --- | --- |
| Run | Current + DBML | A recorded execution of a request, collection, test case, or flow. | A manual run of `GET /health`. |
| Run Step | New DBML | A single step result inside a run. | Step 2 executes the login request. |
| Request Run | New DBML | A run targeting a single request. | Run only `GET /users`. |
| Collection Run | New DBML | A run targeting an entire collection. | Run all requests in `Smoke Tests`. |
| Folder Run | New DBML | A run targeting a folder inside a collection. | Run the `Auth` folder. |
| Flow Run | Current + DBML | A run targeting a flow. | Execute the `Checkout Flow`. |
| Test Run | Current + DBML | A run targeting a test case. | Run `Create user succeeds`. |
| Test Case | Current + DBML | A saved test definition with request overrides, scripts, and assertions. | `Login returns access token`. |
| Assertion | Current + DBML | A rule used to validate a response or execution result. | Assert status code equals 200. |
| Assertion Result | Current + DBML | The outcome of evaluating an assertion. | `passed = true` for status assertion. |
| Extract Variable | Current | A rule for extracting a variable from a response. | Extract `token` from `$.data.access_token`. |
| Request Override | New DBML | Test-case-specific request changes applied before execution. | Override body email for a test case. |
| Resolved Request | New DBML | The fully materialized request after variables and overrides are applied. | `{{base_url}}` becomes `https://staging.example.com`. |
| Response Snapshot | New DBML | The captured response data stored with history or run results. | Stored status, headers, and body from a run. |
| Duration | Current + DBML | Execution time in milliseconds. | `duration_ms = 142`. |
| Logs | New DBML | Execution logs captured during a run step. | Console output from a script step. |
| Error | Current + DBML | Failure information produced by validation or execution. | `connection timeout`. |
| Triggered By | Current + DBML | The initiator or mode of a run, such as manual, CLI, or API. | `manual`, `cli`, or `api`. |
| Execution Mode | Current Frontend | The runtime mode used for execution, such as server or local. | Run through the local bridge. |
| Target Type | New DBML | The type of resource a run targets. | `request`, `collection`, `test_case`, or `flow`. |
| Target ID | New DBML | The concrete resource ID a run targets. | The ID of the request being executed. |

## Flow

| Term | Source / Status | Definition | Examples |
| --- | --- | --- | --- |
| Flow | Current + DBML | A scenario or graph of executable API-related steps. | `Login -> Create Order -> Pay`. |
| Flow Step | Current + DBML | A node or step inside a flow. | `Create Order` request step. |
| Flow Edge | Current / Missing in DBML | A connection between two flow steps. | Edge from login step to create order step. |
| Source Step | Current | The start side of a flow edge. | Login is the source step. |
| Target Step | Current | The destination side of a flow edge. | Create order is the target step. |
| Variable Mapping | Current | A rule that maps captured data from one step to another. | Map `access_token` to authorization header. |
| Capture | Current | A rule for capturing values from a step response. | Capture `order_id` from response JSON. |
| Condition | New DBML | A proposed flow step type for branching logic. | Continue only if stock is available. |
| Script Step | New DBML | A proposed flow step type for custom script execution. | Generate a random email address. |
| Delay Step | New DBML | A proposed flow step type for waiting. | Wait 5 seconds before polling status. |
| Loop Step | New DBML | A proposed flow step type for iteration. | Repeat polling until status is complete. |
| Step Result | Current | The execution result of a flow step. | Step failed because assertion failed. |
| Position | Current | The x/y location of a flow step in the visual editor. | `position_x = 240`, `position_y = 120`. |

## History / Audit

| Term | Source / Status | Definition | Examples |
| --- | --- | --- | --- |
| History | Current | A generic record of entity changes or CLI sync events. | A request update creates a history record. |
| Entity History | Current / Recommended | A versioned change record for a resource identified by entity type and entity ID. | History for request `req_123`. |
| Request History | New DBML | A record of request execution, including resolved request and response snapshots. | A record of `GET /users` run at 10:30. |
| Audit Log | Current | A security or operational log of user actions. | Alice deleted an environment. |
| Entity Type | Current | The type name of the resource referenced by a history record. | `request`, `collection`, or `api_spec`. |
| Entity ID | Current | The concrete resource ID referenced by a history record. | `req_01HX...`. |
| Source | Current | The origin of a history event, such as web or CLI. | `web` or `cli`. |
| Source Event ID | Current | An idempotency key for external or CLI-originated history events. | CLI event ID `evt_123`. |
| Action | Current | The change or audit action, such as create, update, delete, or move. | `create`, `update`, `delete`, or `move`. |
| Diff | Current | A structured representation of what changed. | `method` changed from GET to POST. |
| Snapshot | Current + DBML | A captured serialized state of a resource or response. | Request JSON before rollback. |
| Message | Current | A human-readable note attached to a history record. | `Imported from CLI sync`. |
| Change Event | Recommended | A domain or sync event representing a resource change. | `request.updated`. |

## System / API

| Term | Source / Status | Definition | Examples |
| --- | --- | --- | --- |
| API Response | Current API | The standard response envelope returned by the backend. | `{ code, message, data }`. |
| API Error | Current API | A structured error returned by the backend. | `{ code: 404, message: "not found" }`. |
| Error Code | Current API | A machine-readable code used to identify error categories. | `VALIDATION_FAILED`. |
| Pagination | Current API | The metadata and query pattern used for paginated lists. | `page=1&per_page=20`. |
| Page | Current API | The requested page index for a paginated list. | `page = 2`. |
| Page Size | Current API | The requested number of items per page. | `per_page = 50`. |
| Rate Limit | Current API | A control limiting request frequency. | 1000 requests per minute. |
| Health Check | Current API | An endpoint or operation used to verify system health. | `GET /health`. |
| System Feature | Current API | A server-reported product capability flag. | Feature flag for AI spec generation. |
| Setup Status | Current API | Server-reported setup or bootstrap state. | Setup is complete or pending. |
| Web Console | Product | The browser-based Kest interface. | The user edits requests in the web console. |
| CLI | Current Product | The Kest command-line client. | `kest run` or `kest sync`. |
| Local Bridge | Current Product | A local HTTP bridge used by the web app to execute real API requests from the user's machine. | `kest bridge` listens on localhost. |
| Spec Sync | Current API | CLI-to-server upload of inferred or authored API specs. | `POST /projects/:id/cli/spec-sync`. |
| History Sync | Current API | CLI-to-server upload of execution or change history. | `POST /projects/:id/cli/history-sync`. |
| Ingest | Current API | A server-side intake endpoint or flow for external events. | Project DSN sends events to ingest. |
| Export Postman | Current API | Exporting a collection in Postman-compatible format. | Download a Postman JSON export. |
