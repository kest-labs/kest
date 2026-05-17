# User Stories

## Account and Profile

As a user, I want to manage my account identity and access, so that I can securely use Kest and keep my profile up to date.

- Register a new account
- Log in
- Reset password
- View personal profile
- Update personal profile
- Delete account

## Organization and Workspace Management

As a team owner, I want to create and manage organizations and workspaces, so that my team can collaborate around API assets in a clear boundary.

- Create organization
- Manage organization members
- Create workspace
- Update workspace
- Delete workspace
- Set workspace visibility and settings

## Members and Invitations

As a workspace admin, I want to invite teammates and manage their roles, so that each person has the right level of access.

- Invite workspace members
- Accept invitation
- Revoke invitation
- Manage member roles
- View workspace members

## CLI Access Management

As a workspace admin, I want to create and manage CLI tokens, so that automation and local development can sync data safely.

- Create CLI token
- Manage CLI token
- Assign token scopes
- Revoke or expire CLI token

## Environments and Variables

As an API tester, I want to manage environments and variables, so that requests can run correctly across development, staging, and production.

- Create environment
- Set default environment
- Manage environment variables
- Manage workspace variables
- Manage collection variables
- Manage runtime variables
- Manage secret variables

## Collections, Folders, and Requests

As an API developer, I want to organize and edit requests in collections and folders, so that I can maintain reusable API workflows.

- Create collection
- Create folder
- Create request
- Edit request
- Move request
- Configure request authentication
- Configure request scripts
- Send request

## Import and Export

As a user migrating API assets, I want to import and export collections and specs, so that I can reuse work from other tools and share data externally.

- Import Postman collection
- Import Markdown collection
- Export Postman collection
- Import API specification
- Export API specification

## Response Examples

As an API maintainer, I want to save response examples, so that documentation and tests can reuse real or curated responses.

- Save response example
- Attach response example to request
- Attach response example to API spec
- View response examples

## API Specifications and Documentation

As an API maintainer, I want to manage API specifications and documentation, so that my team has accurate API contracts and readable docs.

- Create API specification
- Edit API endpoint
- Manage API categories
- Generate API documentation
- Publish public documentation

## AI-Assisted API Drafting

As an API designer, I want AI to draft and refine API specs, so that I can create consistent API contracts faster.

- Create AI API draft
- Refine AI API draft
- Review AI assumptions and questions
- Accept AI API draft

## Test Cases and Assertions

As a QA engineer, I want to create and run test cases with assertions, so that API behavior can be verified repeatedly.

- Create test case
- Generate test case from API specification
- Edit test assertions
- Extract variables from responses
- Run test case
- View test run result

## Flows

As an API tester, I want to build multi-step flows, so that I can validate API scenarios that depend on previous steps.

- Create flow
- Edit flow steps
- Connect flow steps
- Configure variable mapping
- Run flow
- View flow run result

## Execution History and Rollback

As a collaborator, I want to inspect request and entity history, so that I can understand changes and recover previous versions when needed.

- View request history
- View entity change history
- Roll back history version
- View synced CLI history

## Audit and Compliance

As an administrator, I want to inspect audit logs, so that sensitive actions can be reviewed and traced.

- View audit logs
- Filter audit logs by project or workspace
- Inspect user actions

## CLI Sync

As a CLI user, I want to sync local API activity with the web console, so that local development and team documentation stay aligned.

- CLI sync API specifications
- CLI sync history records
- Use scoped CLI token for sync

## Local Bridge Execution

As a web console user, I want to run requests through a local bridge, so that browser CORS restrictions do not block real API testing.

- Start local bridge
- Check local bridge health
- Send request through local bridge
- Resolve environment variables before bridge execution
