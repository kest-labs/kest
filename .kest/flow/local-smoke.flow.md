# Local API Smoke Flow

This flow checks a small set of stable API behavior used by local builds.

```flow
@flow local-smoke
@name Local API Smoke
@version 1.0
@env local
@tags smoke, local, api
```

## 1. Health check

```step
@id health
@name Health check

GET /v1/health

[Asserts]
status == 200
body.status == "ok"
```

## 2. System feature flags

```step
@id system-features
@name System feature flags

GET /v1/system-features

[Asserts]
status == 200
body.code == 0
body.data.enable_email_password_login == true
body.data.enable_cli_sync == true
```

## 3. Setup status

```step
@id setup-status
@name Setup status

GET /v1/setup-status

[Asserts]
status == 200
body.code == 0
body.data.is_setup == true
body.data.version exists
```

## 4. Workspace list requires login

```step
@id workspace-auth-required
@name Workspace list requires login

GET /v1/workspaces

[Asserts]
status == 401
body.code == 401
```

## 5. User profile requires login

```step
@id profile-auth-required
@name User profile requires login

GET /v1/users/profile

[Asserts]
status == 401
body.code == 401
```

