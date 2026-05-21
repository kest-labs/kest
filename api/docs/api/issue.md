# Issue Module API

> 💡 This documentation is automatically synchronized with the source code.

## 📌 Overview

The `issue` module provides the following API endpoints:

### {
  "description": "This endpoint retrieves a list of issues for a specific workspace. It allows filtering and sorting the issues based on various parameters such as status, level, and last seen. The results can be paginated using the `page` and `per_page` query parameters.",
  "request_example": {
    "method": "GET",
    "url": "/workspaces/123/issues/?page=1&per_page=20&status=open&level=high&sort_by=last_seen&order=desc"
  },
  "response_example": {
    "issues": [
      {
        "id": 1,
        "title": "Critical Error in Login Module",
        "status": "open",
        "level": "high",
        "last_seen": "2023-10-01T14:25:36Z",
        "created_at": "2023-09-28T10:15:22Z",
        "updated_at": "2023-10-01T14:25:36Z"
      },
      {
        "id": 2,
        "title": "Performance Degradation in Search Function",
        "status": "in_progress",
        "level": "medium",
        "last_seen": "2023-10-02T09:30:00Z",
        "created_at": "2023-09-30T12:00:00Z",
        "updated_at": "2023-10-02T09:30:00Z"
      }
    ],
    "pagination": {
      "current_page": 1,
      "total_pages": 3,
      "total_items": 50
    }
  }
}

**Endpoint:**
<kbd>GET</kbd> `/workspaces/:id/issues/`

**Handler Implementation:**
`issue.List`

---

### ```json
{
  "description": "This endpoint retrieves a specific issue within a workspace by its fingerprint. The fingerprint is a unique identifier for the issue and must be URL-encoded if it contains special characters. The response will include details of the issue if found, or an error message if the issue does not exist or if there are issues with the request parameters.",
  "request": {
    "method": "GET",
    "url": "/workspaces/:id/issues/:fingerprint",
    "params": {
      "id": "The ID of the workspace where the issue is located.",
      "fingerprint": "The fingerprint of the issue to retrieve. This should be URL-encoded if it contains special characters."
    }
  },
  "response": {
    "200": {
      "description": "Successful response with the issue details.",
      "example": {
        "id": 1,
        "workspace_id": 123,
        "fingerprint": "unique-fingerprint-123",
        "title": "Example Issue Title",
        "description": "This is a detailed description of the issue.",
        "status": "open",
        "created_at": "2023-10-01T12:00:00Z",
        "updated_at": "2023-10-02T15:30:00Z"
      }
    },
    "400": {
      "description": "Bad request due to missing or invalid fingerprint.",
      "example": {
        "error": "fingerprint is required"
      }
    },
    "404": {
      "description": "Issue not found.",
      "example": {
        "error": "issue not found"
      }
    },
    "500": {
      "description": "Internal server error.",
      "example": {
        "error": "failed to get issue"
      }
    }
  }
}
```

**Endpoint:**
<kbd>GET</kbd> `/workspaces/:id/issues/:fingerprint`

**Handler Implementation:**
`issue.Get`

---

### {
  "description": "This endpoint is used to resolve a specific issue in a workspace. It requires the workspace ID and the fingerprint of the issue to be resolved. The fingerprint must be URL-encoded. Upon successful resolution, it returns a success message along with the decoded fingerprint.",
  "request_example": {
    "method": "POST",
    "url": "/workspaces/123/issues/%2Fexample%2Ffingerprint%2Fresolve",
    "body": {},
    "headers": {
      "Content-Type": "application/json"
    }
  },
  "response_example": {
    "status_code": 200,
    "body": {
      "message": "issue resolved",
      "fingerprint": "/example/fingerprint/resolve"
    }
  }
}

**Endpoint:**
<kbd>POST</kbd> `/workspaces/:id/issues/:fingerprint/resolve`

**Handler Implementation:**
`issue.Resolve`

---

### {
  "description": "This endpoint allows a user to mark a specific issue within a workspace as ignored. The issue is identified by its fingerprint, which must be URL-encoded. Once the issue is marked as ignored, it will no longer be actively tracked or reported.",
  "request": {
    "method": "POST",
    "url": "/workspaces/:id/issues/:fingerprint/ignore",
    "parameters": {
      "path": {
        "id": "The ID of the workspace containing the issue.",
        "fingerprint": "The URL-encoded fingerprint of the issue to be ignored."
      }
    },
    "example": {
      "url": "/workspaces/12345/issues/%2F%2F%3A0x1234abcd%2F%2F/ignore"
    }
  },
  "response": {
    "success": {
      "status_code": 200,
      "body": {
        "message": "issue ignored",
        "fingerprint": "//:0x1234abcd//"
      }
    },
    "error": {
      "bad_request": {
        "status_code": 400,
        "body": {
          "message": "fingerprint is required"
        }
      },
      "internal_server_error": {
        "status_code": 500,
        "body": {
          "message": "failed to ignore issue"
        }
      }
    }
  }
}

**Endpoint:**
<kbd>POST</kbd> `/workspaces/:id/issues/:fingerprint/ignore`

**Handler Implementation:**
`issue.Ignore`

---

### {
  "description": "This endpoint reopens a previously closed issue in a specific workspace. It requires the workspace ID and the fingerprint of the issue to be provided. The fingerprint is URL-encoded, so it needs to be decoded before processing. If the operation is successful, it returns a success message along with the decoded fingerprint.",
  "request": {
    "method": "POST",
    "url": "/workspaces/123/issues/encodedFingerprint/reopen",
    "body": {},
    "headers": {
      "Content-Type": "application/json"
    }
  },
  "response": {
    "status": 200,
    "body": {
      "message": "issue reopened",
      "fingerprint": "decodedFingerprint"
    }
  }
}

**Endpoint:**
<kbd>POST</kbd> `/workspaces/:id/issues/:fingerprint/reopen`

**Handler Implementation:**
`issue.Reopen`

---

### {
  "description": "This endpoint retrieves a paginated list of events for a specific issue identified by its fingerprint within a given workspace. The events can be sorted and ordered based on the provided query parameters. The fingerprint is URL-encoded and must be decoded before use.",
  "request": {
    "method": "GET",
    "url": "/workspaces/123/issues/encodedFingerprint/events?page=1&per_page=10&sort_by=timestamp&order=desc",
    "query_parameters": {
      "page": "The page number to fetch (default: 1).",
      "per_page": "The number of items per page (default: 10).",
      "sort_by": "The field to sort the results by (default: 'timestamp').",
      "order": "The order in which to sort the results ('asc' or 'desc', default: 'desc')."
    }
  },
  "response": {
    "status_code": 200,
    "body": {
      "events": [
        {
          "id": "event-1",
          "timestamp": "2023-10-01T12:00:00Z",
          "type": "error",
          "details": "An error occurred while processing the request."
        },
        {
          "id": "event-2",
          "timestamp": "2023-10-01T11:59:00Z",
          "type": "warning",
          "details": "A warning was triggered due to high memory usage."
        }
      ],
      "pagination": {
        "current_page": 1,
        "total_pages": 2,
        "total_items": 15
      }
    }
  }
}

**Endpoint:**
<kbd>GET</kbd> `/workspaces/:id/issues/:fingerprint/events`

**Handler Implementation:**
`issue.GetEvents`

---

