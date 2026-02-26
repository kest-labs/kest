# API Documentation

> Generated: 2026-02-23 23:32:45

## Base URLs

| Environment | URL |
|-------------|-----|
| 🏠 Local | `http://localhost:8025/api/v1` |

## Authentication

Protected endpoints require a JWT token in the `Authorization` header:

```
Authorization: Bearer <token>
```

## Overview

Total endpoints: **1**

## Table of Contents

- [Other](#other) (1 endpoints)

---

## Other

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/health` | /health | 🔓 |

### GET `/health`

**/health**

| Property | Value |
|----------|-------|
| Auth | 🔓 Not required |

#### Example

```bash
curl -X GET 'http://localhost:8025/api/v1/health'
```

---

