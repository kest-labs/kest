# API Test Flow

## Step 1: Check Setup Status

```kest
GET https://api.kest.dev/v1/setup-status

[Asserts]
status == 200
```

---

## Step 2: Register User

```kest
POST https://api.kest.dev/v1/register
Content-Type: application/json

{
  "username": "testuser",
  "email": "test@example.com",
  "password": "password123"
}

[Asserts]
status == 201
body.code == 0
```

---

## Step 3: Login

```kest
POST https://api.kest.dev/v1/login
Content-Type: application/json

{
  "username": "testuser",
  "password": "password123"
}

[Captures]
access_token: body.data.access_token

[Asserts]
status == 200
body.code == 0
```

---

## Step 4: Create Project

```kest
POST https://api.kest.dev/v1/projects
Authorization: Bearer {{access_token}}
Content-Type: application/json

{
  "name": "Test Project {{$randomInt}}"
}

[Captures]
project_id: body.data.id

[Asserts]
status == 201
body.code == 0
```

---

## Step 5: Create Collection

```kest
POST https://api.kest.dev/v1/projects/{{project_id}}/collections
Authorization: Bearer {{access_token}}
Content-Type: application/json

{
  "name": "Test Collection"
}

[Captures]
collection_id: body.data.id

[Asserts]
status == 201
body.code == 0
```
