# User Registration API Documentation

## Overview

Register a new user account in the Kest platform. This endpoint creates a new user with basic profile information.

## Endpoint

```
POST /v1/register
```

**Authentication**: Not required (Public endpoint)

---

## Request

### Headers

```
Content-Type: application/json
```

### Body Schema

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `username` | string | ✅ Yes | min: 3, max: 50 | Unique username for login |
| `password` | string | ✅ Yes | min: 6, max: 50 | User password |
| `email` | string | ✅ Yes | valid email format | User email address |
| `nickname` | string | ❌ No | max: 50 | Display name (optional) |
| `phone` | string | ❌ No | max: 20 | Phone number (optional) |

### Example Request

```json
{
  "username": "john_doe",
  "password": "SecurePass123",
  "email": "john@example.com",
  "nickname": "John",
  "phone": "+1234567890"
}
```

---

## Response

### Success Response (201 Created)

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

**Note**: The `password` field is automatically excluded from the response for security.

### Error Responses

#### 400 Bad Request - Validation Error

```json
{
  "code": 400,
  "message": "Validation failed",
  "errors": {
    "username": "username must be at least 3 characters",
    "email": "invalid email format"
  }
}
```

#### 409 Conflict - Username/Email Already Exists

```json
{
  "code": 409,
  "message": "Registration failed",
  "error": "username already exists"
}
```

---

## Validation Rules

### Username
- **Required**: Yes
- **Min length**: 3 characters
- **Max length**: 50 characters
- **Unique**: Must not already exist in the system

### Password
- **Required**: Yes
- **Min length**: 6 characters
- **Max length**: 50 characters
- **Storage**: Hashed using bcrypt before storage

### Email
- **Required**: Yes
- **Format**: Must be a valid email address
- **Unique**: Must not already exist in the system

### Nickname (Optional)
- **Required**: No
- **Max length**: 50 characters
- **Default**: Empty string if not provided

### Phone (Optional)
- **Required**: No
- **Max length**: 20 characters
- **Default**: Empty string if not provided

---

## Usage Examples

### cURL

```bash
curl -X POST http://localhost:8025/api/v1/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "john_doe",
    "password": "SecurePass123",
    "email": "john@example.com",
    "nickname": "John"
  }'
```

### Kest Flow (.flow.md)

```kest
POST /register
Content-Type: application/json

{
  "username": "test_user_{{$randomInt}}",
  "password": "TestPass123",
  "email": "test{{$randomInt}}@example.com",
  "nickname": "Test User"
}

[Captures]
user_id = data.id
username = data.username

[Asserts]
status == 201
body.data.id exists
body.data.username exists
body.data.email exists
```

### JavaScript (Fetch API)

```javascript
const response = await fetch('http://localhost:8025/api/v1/register', {
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

const data = await response.json();
console.log('Registered user:', data.data);
```

---

## Related Endpoints

After successful registration, users can:

1. **Login**: `POST /api/v1/login` - Authenticate and get access token
2. **Get Profile**: `GET /api/v1/users/profile` - View own profile (requires auth)
3. **Update Profile**: `PUT /api/v1/users/profile` - Update profile info (requires auth)

---

## Implementation Details

**Module**: `internal/modules/user`
**Handler**: `handler.go:Register()`
**Service**: `service.go:Register()`
**DTO**: `dto.go:UserRegisterRequest`

**Event Emitted**: `domain.EventUserCreated` (async)
- Triggers welcome email
- Initializes user preferences
- Creates audit log entry

---

## Security Considerations

1. **Password Hashing**: Passwords are hashed using bcrypt before storage
2. **Input Validation**: All inputs are validated using Go struct tags
3. **SQL Injection Prevention**: Uses parameterized queries via GORM
4. **Rate Limiting**: Consider implementing rate limiting for this endpoint
5. **Email Verification**: Consider adding email verification flow for production

---

## Testing

### Unit Tests

Located in: `internal/modules/user/service_test.go`

Run tests:
```bash
go test ./internal/modules/user/...
```

### Integration Tests

Located in: `tests/feature/auth_test.go`

Run integration tests:
```bash
make test-feature
```
