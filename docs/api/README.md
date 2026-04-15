# Kest API Documentation

## Overview

Kest is a comprehensive API testing and management platform. This documentation describes all available REST API endpoints.

## Base URL

```
Production: https://api.kest.com
Development: http://localhost:8025
```

## Authentication

Most Kest API endpoints use JWT (JSON Web Token) authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

Project-scoped CLI upload endpoints use a generated CLI token instead:

```
Authorization: Bearer <kest_pat_...>
```

## Rate Limiting

API requests are rate limited per project. Default limits:
- Free tier: 100 requests per minute
- Pro tier: 1000 requests per minute
- Enterprise: Custom limits

## Common Response Format

All API responses follow a consistent format:

### Success Response

```json
{
  "code": 0,
  "message": "success",
  "data": {
    // Response data
  }
}
```

### Error Response

```json
{
  "code": 400,
  "message": "Error description",
  "error": "Detailed error message",
  "errors": {
    // Validation errors (if applicable)
  }
}
```

## HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | OK - Request successful |
| 201 | Created - Resource created successfully |
| 204 | No Content - Request successful, no content returned |
| 400 | Bad Request - Invalid request parameters |
| 401 | Unauthorized - Authentication required |
| 403 | Forbidden - Permission denied |
| 404 | Not Found - Resource not found |
| 409 | Conflict - Resource already exists |
| 422 | Unprocessable Entity - Validation failed |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error - Server error |

## Frontend Integration Note

Based on the current `web/src` service, hook, and page usage audit on 2026-04-15, the following Collection endpoints are not connected in the frontend yet:

- `GET /v1/projects/:id/collections/tree`
- `GET /v1/projects/:id/collections/:cid`
- `PATCH /v1/projects/:id/collections/:cid/move`

The following Export endpoint is also not connected in the frontend yet:

- `GET /v1/projects/:id/collections/:cid/export/postman`

## API Modules

1. [Authentication & Users](./01-authentication.md)
   - Registration, Login, Profile Management
   
2. [Projects](./02-projects.md)
   - Project CRUD operations, DSN management
   
3. [API Specifications](./03-api-specifications.md)
   - API spec management, Import/Export
   
4. [Environments](./04-environments.md)
   - Environment configuration management
   
5. [Test Cases](./05-test-cases.md)
   - Test case creation and management
   
6. [Categories](./06-categories.md)
   - Test case categorization
   
7. [Members](./07-members.md)
   - Project member management
   
8. [Permissions](./08-permissions.md)
   - Role-based access control
   
9. [Issues](./09-issues.md)
   - Issue tracking and management
   
10. [System](./10-system.md)
    - System health and utilities

11. [CLI Sync](./11-cli-sync.md)
    - Project-scoped CLI tokens and spec upload

## SDKs and Tools

- [JavaScript SDK](https://github.com/kest-labs/kest-js)
- [Go SDK](https://github.com/kest-labs/kest-go)
- [Python SDK](https://github.com/kest-labs/kest-python)
- [Kest CLI](https://github.com/kest-labs/kest-cli)

## Support

- Documentation: https://docs.kest.com
- Support Email: support@kest.com
- GitHub Issues: https://github.com/kest-labs/kest/issues
