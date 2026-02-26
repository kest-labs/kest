# User API

> Generated: 2026-02-23 23:34:25

## Base URL

See [API Documentation](./api.md) for environment-specific base URLs.

## Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/v1/register` | Register new user | 🔓 |
| `POST` | `/v1/login` | user login | 🔓 |
| `POST` | `/v1/password/reset` | Reset password | 🔓 |
| `GET` | `/v1/users/profile` | Get current user profile | 🔓 |
| `PUT` | `/v1/users/profile` | Update current user profile | 🔓 |
| `PUT` | `/v1/users/password` | Change password | 🔓 |
| `DELETE` | `/v1/users/account` | Delete account | 🔓 |
| `GET` | `/v1/users` | List users | 🔓 |
| `GET` | `/v1/users/search` | Search Users user | 🔓 |
| `GET` | `/v1/users/:id` | Get user details | 🔓 |
| `GET` | `/v1/users/:id/info` | Get User Info user | 🔓 |

---

## Details

### POST `/v1/register`

**Register new user**

| Property | Value |
|----------|-------|
| Auth | 🔓 Not required |
| Route Name | `auth.register` |

#### Request Body

```json
{
  "email": "user@example.com",
  "nickname": "John Doe",
  "password": "********",
  "phone": "+1234567890",
  "username": "John Doe"
}
```

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `username` | `string` | ✅ | Required, Min: 3, Max: 50 |
| `password` | `string` | ✅ | Required, Min: 6, Max: 50 |
| `email` | `string` | ✅ | Required, Email format |
| `nickname` | `string` | ❌ | Max: 50 |
| `phone` | `string` | ❌ | Max: 20 |

#### Example

```bash
curl -X POST 'http://localhost:8025/api/v1/v1/register' \
  -H 'Content-Type: application/json' \
  -d '{"email": "user@example.com","nickname": "John Doe","password": "********","phone": "+1234567890","username": "John Doe"}'
```

---

### POST `/v1/login`

**user login**

| Property | Value |
|----------|-------|
| Auth | 🔓 Not required |
| Route Name | `auth.login` |

#### Request Body

```json
{
  "password": "********",
  "username": "John Doe"
}
```

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `username` | `string` | ✅ | Required |
| `password` | `string` | ✅ | Required |

#### Response

```json
{
  "access_token": "string",
  "user": null
}
```

#### Example

```bash
curl -X POST 'http://localhost:8025/api/v1/v1/login' \
  -H 'Content-Type: application/json' \
  -d '{"password": "********","username": "John Doe"}'
```

---

### POST `/v1/password/reset`

**Reset password**

| Property | Value |
|----------|-------|
| Auth | 🔓 Not required |
| Route Name | `auth.password.reset` |

#### Request Body

```json
{
  "email": "user@example.com"
}
```

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `email` | `string` | ✅ | Required, Email format |

#### Example

```bash
curl -X POST 'http://localhost:8025/api/v1/v1/password/reset' \
  -H 'Content-Type: application/json' \
  -d '{"email": "user@example.com"}'
```

---

### GET `/v1/users/profile`

**Get current user profile**

| Property | Value |
|----------|-------|
| Auth | 🔓 Not required |
| Route Name | `users.profile` |

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/v1/users/profile'
```

---

### PUT `/v1/users/profile`

**Update current user profile**

| Property | Value |
|----------|-------|
| Auth | 🔓 Not required |
| Route Name | `users.profile.update` |

#### Request Body

```json
{
  "avatar": "https://example.com/avatar.jpg",
  "bio": "string",
  "nickname": "John Doe",
  "phone": "+1234567890"
}
```

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `nickname` | `string` | ❌ | Max: 50 |
| `avatar` | `string` | ❌ | Max: 255 |
| `phone` | `string` | ❌ | Max: 20 |
| `bio` | `string` | ❌ | Max: 500 |

#### Example

```bash
curl -X PUT 'http://localhost:8025/api/v1/v1/users/profile' \
  -H 'Content-Type: application/json' \
  -d '{"avatar": "https://example.com/avatar.jpg","bio": "string","nickname": "John Doe","phone": "+1234567890"}'
```

---

### PUT `/v1/users/password`

**Change password**

| Property | Value |
|----------|-------|
| Auth | 🔓 Not required |
| Route Name | `users.password.update` |

#### Request Body

```json
{
  "new_password": "********",
  "old_password": "********"
}
```

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `old_password` | `string` | ✅ | Required |
| `new_password` | `string` | ✅ | Required, Min: 6, Max: 50 |

#### Example

```bash
curl -X PUT 'http://localhost:8025/api/v1/v1/users/password' \
  -H 'Content-Type: application/json' \
  -d '{"new_password": "********","old_password": "********"}'
```

---

### DELETE `/v1/users/account`

**Delete account**

| Property | Value |
|----------|-------|
| Auth | 🔓 Not required |
| Route Name | `users.account.delete` |

#### Example

```bash
curl -X DELETE 'http://localhost:8025/api/v1/v1/users/account'
```

---

### GET `/v1/users`

**List users**

| Property | Value |
|----------|-------|
| Auth | 🔓 Not required |
| Route Name | `users.index` |

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/v1/users'
```

---

### GET `/v1/users/search`

**Search Users user**

| Property | Value |
|----------|-------|
| Auth | 🔓 Not required |
| Route Name | `users.search` |

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/v1/users/search'
```

---

### GET `/v1/users/:id`

**Get user details**

| Property | Value |
|----------|-------|
| Auth | 🔓 Not required |
| Route Name | `users.show` |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/v1/users/1'
```

---

### GET `/v1/users/:id/info`

**Get User Info user**

| Property | Value |
|----------|-------|
| Auth | 🔓 Not required |
| Route Name | `users.info` |

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `integer` | Resource identifier |

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/v1/users/1/info'
```

---

