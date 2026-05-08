# Members & Invitations API

## Overview

Project access is now managed through two related API groups:

- `Members`: read and maintain users who have already joined a project
- `Invitations`: create direct invitations or shareable invite links before membership is granted

The old direct-add endpoint `POST /v1/projects/:id/members` has been removed. Admins and owners should use the invitation APIs instead, so the invited user can accept or reject access on their own.

## Base Paths

```text
/v1/projects/:id/members
/v1/projects/:id/invitations
/v1/project-invitations
```

All endpoints require authentication unless explicitly marked as public.

---

## 1. List Project Members

### GET `/v1/projects/:id/members`

List all active members of a project.

**Authentication**: Required (`read` or above)

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/projects/1/members' \
  -H 'Authorization: Bearer <token>'
```

---

## 2. Get Current User Role

### GET `/v1/projects/:id/members/me`

Return the current authenticated user's role in the target project.

**Authentication**: Required (`read` or above)

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/projects/1/members/me' \
  -H 'Authorization: Bearer <token>'
```

---

## 3. Update Member Role

### PATCH `/v1/projects/:id/members/:uid`

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
curl -X PATCH 'http://localhost:8025/api/v1/projects/1/members/2' \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{"role":"write"}'
```

---

## 4. Remove Member

### DELETE `/v1/projects/:id/members/:uid`

Remove an existing member from the project.

**Authentication**: Required (`admin` or `owner`)

#### Example

```bash
curl -X DELETE 'http://localhost:8025/api/v1/projects/1/members/2' \
  -H 'Authorization: Bearer <token>'
```

---

## 5. Create Project Invitation

### POST `/v1/projects/:id/invitations`

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
curl -X POST 'http://localhost:8025/api/v1/projects/1/invitations' \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{"role":"read","invited_user_id":"user_123"}'
```

---

## 6. List Project Invitations

### GET `/v1/projects/:id/invitations`

List invitations created for a project, including direct invitations and shareable invite links.

**Authentication**: Required (`admin` or `owner`)

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/projects/1/invitations' \
  -H 'Authorization: Bearer <token>'
```

---

## 7. Revoke Project Invitation

### DELETE `/v1/projects/:id/invitations/:inviteId`

Revoke an invitation before it is accepted.

**Authentication**: Required (`admin` or `owner`)

#### Example

```bash
curl -X DELETE 'http://localhost:8025/api/v1/projects/1/invitations/1' \
  -H 'Authorization: Bearer <token>'
```

---

## 8. List My Received Invitations

### GET `/v1/project-invitations/received`

List active direct invitations addressed to the current user.

**Authentication**: Required

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/project-invitations/received' \
  -H 'Authorization: Bearer <token>'
```

---

## 9. Get Public Invitation Detail

### GET `/v1/project-invitations/:slug`

Get invitation details for rendering the invitation page.

**Authentication**: Not required

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/project-invitations/abc123'
```

---

## 10. Accept Invitation

### POST `/v1/project-invitations/:slug/accept`

Accept an invitation and join the project.

**Authentication**: Required

#### Example

```bash
curl -X POST 'http://localhost:8025/api/v1/project-invitations/abc123/accept' \
  -H 'Authorization: Bearer <token>'
```

---

## 11. Reject Invitation

### POST `/v1/project-invitations/:slug/reject`

Reject an invitation without joining the project.

**Authentication**: Required

#### Example

```bash
curl -X POST 'http://localhost:8025/api/v1/project-invitations/abc123/reject' \
  -H 'Authorization: Bearer <token>'
```

---

## Migration Note

If you previously integrated with `POST /v1/projects/:id/members`, update that flow to:

1. `POST /v1/projects/:id/invitations`
2. let the invited user review the invitation
3. `POST /v1/project-invitations/:slug/accept` or `POST /v1/project-invitations/:slug/reject`
