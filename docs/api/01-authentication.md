# Authentication & Users API

## Overview

The Authentication & Users module handles user registration, authentication, and profile management.

## Base Path

```
/v1
```

---

## 1. User Registration

### POST /register

Register a new user account.

**Authentication**: Not required

#### Request Headers

```
Content-Type: application/json
```

#### Request Body

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `username` | string | ✅ Yes | min: 3, max: 50 | Unique username |
| `password` | string | ✅ Yes | min: 6, max: 50 | User password |
| `email` | string | ✅ Yes | valid email | Email address |
| `nickname` | string | ❌ No | max: 50 | Display name |
| `phone` | string | ❌ No | max: 20 | Phone number |

#### Example Request

```json
{
  "username": "john_doe",
  "password": "SecurePass123",
  "email": "john@example.com",
  "nickname": "John",
  "phone": "+1234567890"
}
```

#### Response (201 Created)

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": 1,
    "username": "john_doe",
    "email": "john@example.com",
    "nickname": "John",
    "phone": "+1234567890",
    "avatar": "",
    "bio": "",
    "status": "active",
    "created_at": "2024-02-05T00:30:00Z",
    "updated_at": "2024-02-05T00:30:00Z"
  }
}
```

#### Error Responses

- **400 Bad Request**: Validation failed
- **409 Conflict**: Username or email already exists

---

## 2. User Login

### POST /login

Authenticate user and receive JWT token.

**Authentication**: Not required

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | ❌ No | Email (frontend default field) |
| `username` | string | ❌ No | Username (backward compatible) |
| `password` | string | ✅ Yes | User password |

At least one of `email` or `username` is required.

#### Example Request

```json
{
  "email": "john@example.com",
  "password": "SecurePass123"
}
```

#### Example Request (using username, backward compatible)

```json
{
  "username": "john_doe",
  "password": "SecurePass123"
}
```

#### Response (200 OK)

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "username": "john_doe",
      "email": "john@example.com",
      "nickname": "John",
      "avatar": "",
      "bio": "",
      "status": "active",
      "created_at": "2024-02-05T00:30:00Z",
      "updated_at": "2024-02-05T00:30:00Z"
    }
  }
}
```

#### Error Responses

- **401 Unauthorized**: Invalid credentials
- **403 Forbidden**: Account inactive or suspended

---

## 3. Password Reset

### POST /password/reset

Request password reset for user account.

**Authentication**: Not required

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | ✅ Yes | Registered email address |

#### Example Request

```json
{
  "email": "john@example.com"
}
```

#### Response (200 OK)

```json
{
  "code": 0,
  "message": "Password reset email sent",
  "data": null
}
```

---

## 4. Get User Profile

### GET /users/profile

Get current user's profile information.

**Authentication**: Required

#### Response (200 OK)

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": 1,
    "username": "john_doe",
    "email": "john@example.com",
    "nickname": "John",
    "phone": "+1234567890",
    "avatar": "https://example.com/avatar.jpg",
    "bio": "Software Developer",
    "status": "active",
    "created_at": "2024-02-05T00:30:00Z",
    "updated_at": "2024-02-05T00:30:00Z"
  }
}
```

---

## 5. Update User Profile

### PUT /users/profile

Update current user's profile information.

**Authentication**: Required

#### Request Body

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `nickname` | string | ❌ No | max: 50 | Display name |
| `avatar` | string | ❌ No | max: 255, url | Avatar URL |
| `phone` | string | ❌ No | max: 20 | Phone number |
| `bio` | string | ❌ No | max: 500 | User biography |

#### Example Request

```json
{
  "nickname": "John Doe",
  "avatar": "https://example.com/new-avatar.jpg",
  "phone": "+1234567890",
  "bio": "Senior Software Developer at Tech Corp"
}
```

#### Response (200 OK)

```json
{
  "code": 0,
  "message": "Profile updated successfully",
  "data": {
    "id": 1,
    "username": "john_doe",
    "email": "john@example.com",
    "nickname": "John Doe",
    "phone": "+1234567890",
    "avatar": "https://example.com/new-avatar.jpg",
    "bio": "Senior Software Developer at Tech Corp",
    "status": "active",
    "created_at": "2024-02-05T00:30:00Z",
    "updated_at": "2024-02-05T01:30:00Z"
  }
}
```

---

## 6. Change Password

### PUT /users/password

Change current user's password.

**Authentication**: Required

#### Request Body

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `old_password` | string | ✅ Yes | - | Current password |
| `new_password` | string | ✅ Yes | min: 6, max: 50 | New password |

#### Example Request

```json
{
  "old_password": "SecurePass123",
  "new_password": "NewSecurePass456"
}
```

#### Response (200 OK)

```json
{
  "code": 0,
  "message": "Password changed successfully",
  "data": null
}
```

#### Error Responses

- **400 Bad Request**: Old password is incorrect
- **400 Bad Request**: New password validation failed

---

## 7. Delete Account

### DELETE /users/account

Delete current user's account permanently.

**Authentication**: Required

#### Response (200 OK)

```json
{
  "code": 0,
  "message": "Account deleted successfully",
  "data": null
}
```

---

## 8. List Users

### GET /users

List all users (Admin only).

**Authentication**: Required (Admin)

#### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | integer | ❌ No | 1 | Page number |
| `per_page` | integer | ❌ No | 20 | Items per page (max 100) |
| `search` | string | ❌ No | - | Search by username or email |
| `status` | string | ❌ No | - | Filter by status (active, inactive, suspended) |

#### Response (200 OK)

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "id": 1,
        "username": "john_doe",
        "email": "john@example.com",
        "nickname": "John",
        "status": "active",
        "created_at": "2024-02-05T00:30:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "per_page": 20,
      "total": 1,
      "total_pages": 1,
      "has_next": false,
      "has_prev": false
    }
  }
}
```

---

## 9. Get User by ID

### GET /users/:id

Get user details by ID (Admin only).

**Authentication**: Required (Admin)

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | ✅ Yes | User ID |

#### Response (200 OK)

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": 1,
    "username": "john_doe",
    "email": "john@example.com",
    "nickname": "John",
    "phone": "+1234567890",
    "avatar": "https://example.com/avatar.jpg",
    "bio": "Software Developer",
    "status": "active",
    "created_at": "2024-02-05T00:30:00Z",
    "updated_at": "2024-02-05T00:30:00Z"
  }
}
```

---

## 10. Get User Info

### GET /users/:id/info

Get minimal user information (Public endpoint).

**Authentication**: Not required

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | ✅ Yes | User ID |

#### Response (200 OK)

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": 1,
    "username": "john_doe",
    "nickname": "John",
    "avatar": "https://example.com/avatar.jpg",
    "bio": "Software Developer"
  }
}
```

---

## Usage Examples

### JavaScript (Fetch API)

```javascript
// Register a new user
const registerResponse = await fetch('http://localhost:8025/register', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    username: 'john_doe',
    password: 'SecurePass123',
    email: 'john@example.com',
    nickname: 'John'
  })
});

const registerData = await registerResponse.json();
console.log('Registered:', registerData.data);

// Login
const loginResponse = await fetch('http://localhost:8025/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    username: 'john_doe',
    password: 'SecurePass123'
  })
});

const loginData = await loginResponse.json();
const token = loginData.data.access_token;

// Get profile
const profileResponse = await fetch('http://localhost:8025/users/profile', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const profileData = await profileResponse.json();
console.log('Profile:', profileData.data);
```

### cURL

```bash
# Register
curl -X POST http://localhost:8025/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "john_doe",
    "password": "SecurePass123",
    "email": "john@example.com",
    "nickname": "John"
  }'

# Login
curl -X POST http://localhost:8025/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "john_doe",
    "password": "SecurePass123"
  }'

# Get profile (replace TOKEN with actual token)
curl -X GET http://localhost:8025/users/profile \
  -H "Authorization: Bearer TOKEN"
```

---

## Security Considerations

1. **Password Security**: Passwords are hashed using bcrypt
2. **JWT Token**: Tokens expire after 24 hours by default
3. **HTTPS**: Always use HTTPS in production
4. **Rate Limiting**: Login endpoint has stricter rate limits
5. **Input Validation**: All inputs are validated and sanitized

---

## Testing

Run the authentication tests:

```bash
# Unit tests
go test ./internal/modules/user/...

# Integration tests
go test ./tests/feature/auth_test.go
```
