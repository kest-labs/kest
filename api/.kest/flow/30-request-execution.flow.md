# Complete Request Execution Flow Test

---

## Step 1: Register New User

```kest
POST /v1/register
Content-Type: application/json

{
  "username": "testuser{{$timestamp}}",
  "email": "test{{$timestamp}}@example.com",
  "password": "Password123!",
  "name": "Test User"
}

[Captures]
user_id: data.id
username: data.username

[Asserts]
status == 201
body.code == 0
body.data.id exists
```

---

## Step 2: Login

```kest
POST /v1/login
Content-Type: application/json

{
  "username": "{{username}}",
  "password": "Password123!"
}

[Captures]
access_token: data.access_token

[Asserts]
status == 200
body.code == 0
body.data.access_token exists
```

---

## Step 3: Create Project

```kest
POST /v1/projects
Authorization: Bearer {{access_token}}
Content-Type: application/json

{
  "name": "Test Project {{$timestamp}}",
  "description": "Project for testing request execution"
}

[Captures]
project_id: data.id
project_name: data.name

[Asserts]
status == 201
body.code == 0
body.data.id exists
```

---

## Step 4: Create Collection

```kest
POST /v1/projects/{{project_id}}/collections
Authorization: Bearer {{access_token}}
Content-Type: application/json

{
  "name": "Test Collection",
  "description": "Collection for testing"
}

[Captures]
collection_id: data.id

[Asserts]
status == 201
body.code == 0
body.data.id exists
```

---

## Step 5: Create Request

```kest
POST /v1/projects/{{project_id}}/collections/{{collection_id}}/requests
Authorization: Bearer {{access_token}}
Content-Type: application/json

{
  "name": "Get Users",
  "method": "GET",
  "url": "https://jsonplaceholder.typicode.com/users",
  "headers": [
    {"key": "Accept", "value": "application/json", "enabled": true}
  ]
}

[Captures]
request_id: data.id

[Asserts]
status == 201
body.code == 0
body.data.id exists
body.data.name == "Get Users"
```

---

## Step 6: Run Request

```kest
POST /v1/projects/{{project_id}}/collections/{{collection_id}}/requests/{{request_id}}/run
Authorization: Bearer {{access_token}}
Content-Type: application/json

{
  "variables": {}
}

[Asserts]
status == 200
body.data.status == 200
```

---

## Step 7: List Requests

```kest
GET /v1/projects/{{project_id}}/collections/{{collection_id}}/requests
Authorization: Bearer {{access_token}}

[Asserts]
status == 200
body.code == 0
body.data exists
```

---

## Step 8: Create Example

```kest
POST /v1/projects/{{project_id}}/collections/{{collection_id}}/requests/{{request_id}}/examples
Authorization: Bearer {{access_token}}
Content-Type: application/json

{
  "name": "Success Response",
  "description": "Example with successful response"
}

[Captures]
example_id: data.id

[Asserts]
status == 201
body.code == 0
body.data.id exists
```

---

## Step 9: List Examples

```kest
GET /v1/projects/{{project_id}}/collections/{{collection_id}}/requests/{{request_id}}/examples
Authorization: Bearer {{access_token}}

[Asserts]
status == 200
body.code == 0
body.data exists
```
