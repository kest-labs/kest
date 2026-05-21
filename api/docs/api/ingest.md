# Ingest Module API

> 💡 This documentation is automatically synchronized with the source code.

## 📌 Overview

The `ingest` module provides the following API endpoints:

### {
  "description": "This endpoint is used to store and process an event envelope for a specific workspace. The envelope can contain various items such as events, transactions, and sessions. The endpoint first validates the workspace and public key, reads and parses the envelope, and then processes each item within the envelope. If the processing is successful, it returns the last processed event ID.",
  "request_example": {
    "headers": {
      "X-Sentry-Auth": "Sentry sentry_key=your_public_key, sentry_version=7, sentry_client=raven-js/3.15.0"
    },
    "method": "POST",
    "url": "/api/:workspace_id/envelope/",
    "body": {
      "event_id": "f9b8e4d6-6a4c-4e2f-9b2b-8a9b6c7d8e9f",
      "timestamp": "2023-10-01T12:00:00Z",
      "items": [
        {
          "type": "event",
          "payload": {
            "event_id": "f9b8e4d6-6a4c-4e2f-9b2b-8a9b6c7d8e9f",
            "level": "error",
            "message": "An error occurred",
            "platform": "javascript",
            "exception": {
              "values": [
                {
                  "type": "Error",
                  "value": "Something went wrong",
                  "stacktrace": {
                    "frames": [
                      {
                        "filename": "app.js",
                        "lineno": 10,
                        "colno": 5,
                        "function": "myFunction"
                      }
                    ]
                  }
                }
              ]
            }
          }
        }
      ]
    }
  },
  "response_example": {
    "status_code": 200,
    "body": {
      "id": "f9b8e4d6-6a4c-4e2f-9b2b-8a9b6c7d8e9f"
    }
  }
}

**Endpoint:**
<kbd>POST</kbd> `/api/:workspace_id/envelope/`

**Handler Implementation:**
`ingest.StoreEnvelope`

---

### {
  "description": "This endpoint is used to store a single JSON event for a specified workspace. The event is converted into an envelope and then processed.",
  "request_example": {
    "method": "POST",
    "url": "/api/:workspace_id/store/",
    "headers": {
      "Content-Type": "application/json"
    },
    "body": {
      "event_type": "user_login",
      "timestamp": "2023-10-04T14:48:00Z",
      "user_id": "12345",
      "metadata": {
        "ip_address": "192.168.1.1",
        "device": "mobile"
      }
    }
  },
  "response_example": {
    "status": 200,
    "body": {
      "message": "Event stored successfully"
    }
  }
}

**Endpoint:**
<kbd>POST</kbd> `/api/:workspace_id/store/`

**Handler Implementation:**
`ingest.StoreEvent`

---

