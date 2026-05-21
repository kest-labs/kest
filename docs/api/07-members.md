# Members & Invitations API

## Overview

Workspace access is now managed through two related API groups:

- `Members`: read and maintain users who have already joined a workspace
- `Invitations`: create direct invitations or shareable invite links before membership is granted

The old direct-add endpoint `POST /v1/workspaces/:id/members` has been removed. Admins and owners should use the invitation APIs instead, so the invited user can accept or reject access on their own.

## Base Paths

```text
/v1/workspaces/:id/members
/v1/workspaces/:id/invitations
/v1/workspace-invitations
```

All endpoints require authentication unless explicitly marked as public.

---

## 1. List Workspace Members

### GET `/v1/workspaces/:id/members`

List all active members of a workspace.

**Authentication**: Required (`read` or above)

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/workspaces/1/members' \
  -H 'Authorization: Bearer <token>'
```

---

## 2. Get Current User Role

### GET `/v1/workspaces/:id/members/me`

Return the current authenticated user's role in the target workspace.

**Authentication**: Required (`read` or above)

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/workspaces/1/members/me' \
  -H 'Authorization: Bearer <token>'
```

---

## 3. Update Member Role

### PATCH `/v1/workspaces/:id/members/:uid`

Update an existing member's role.

**Authentication**: Required (`admin` or `owner`)

#### Request Body

```json
{
  "role": "write"
}
```

#### Example

```bash
curl -X PATCH 'http://localhost:8025/api/v1/workspaces/1/members/2' \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{"role":"write"}'
```

---

## 4. Remove Member

### DELETE `/v1/workspaces/:id/members/:uid`

Remove an existing member from the workspace.

**Authentication**: Required (`admin` or `owner`)

#### Example

```bash
curl -X DELETE 'http://localhost:8025/api/v1/workspaces/1/members/2' \
  -H 'Authorization: Bearer <token>'
```

---

## 5. Create Workspace Invitation

### POST `/v1/workspaces/:id/invitations`

Create either:

- a direct invitation by providing `invited_user_id`
- a shareable invitation link by omitting `invited_user_id`

**Authentication**: Required (`admin` or `owner`)

#### Request Body

```json
{
  "role": "read",
  "invited_user_id": "user_123",
  "expires_at": "2026-05-15T00:00:00Z"
}
```

#### Notes

- Direct invitations are single-use and bound to the specified user.
- Shareable invite links can optionally set `max_uses` and do not target a single account.

#### Example

```bash
curl -X POST 'http://localhost:8025/api/v1/workspaces/1/invitations' \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{"role":"read","invited_user_id":"user_123"}'
```

---

## 6. List Workspace Invitations

### GET `/v1/workspaces/:id/invitations`

List invitations created for a workspace, including direct invitations and shareable invite links.

**Authentication**: Required (`admin` or `owner`)

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/workspaces/1/invitations' \
  -H 'Authorization: Bearer <token>'
```

---

## 7. Revoke Workspace Invitation

### DELETE `/v1/workspaces/:id/invitations/:inviteId`

Revoke an invitation before it is accepted.

**Authentication**: Required (`admin` or `owner`)

#### Example

```bash
curl -X DELETE 'http://localhost:8025/api/v1/workspaces/1/invitations/1' \
  -H 'Authorization: Bearer <token>'
```

---

## 8. List My Received Invitations

### GET `/v1/workspace-invitations/received`

List active direct invitations addressed to the current user.

**Authentication**: Required

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/workspace-invitations/received' \
  -H 'Authorization: Bearer <token>'
```

---

## 9. Get Public Invitation Detail

### GET `/v1/workspace-invitations/:slug`

Get invitation details for rendering the invitation page.

**Authentication**: Not required

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/workspace-invitations/abc123'
```

---

## 10. Accept Invitation

### POST `/v1/workspace-invitations/:slug/accept`

Accept an invitation and join the workspace.

**Authentication**: Required

#### Example

```bash
curl -X POST 'http://localhost:8025/api/v1/workspace-invitations/abc123/accept' \
  -H 'Authorization: Bearer <token>'
```

---

## 11. Reject Invitation

### POST `/v1/workspace-invitations/:slug/reject`

Reject an invitation without joining the workspace.

**Authentication**: Required

#### Example

```bash
curl -X POST 'http://localhost:8025/api/v1/workspace-invitations/abc123/reject' \
  -H 'Authorization: Bearer <token>'
```

---

## Migration Note

If you previously integrated with `POST /v1/workspaces/:id/members`, update that flow to:

1. `POST /v1/workspaces/:id/invitations`
2. let the invited user review the invitation
3. `POST /v1/workspace-invitations/:slug/accept` or `POST /v1/workspace-invitations/:slug/reject`
