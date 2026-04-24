#!/bin/bash
# =============================================================================
# Kest Demo Data Seed Script
# =============================================================================
# Seeds the database with Kest's own API documentation as demo data.
# Usage: ./scripts/seed-demo.sh [API_BASE_URL]
# Default: http://localhost:7111
# =============================================================================

set -e

API_BASE="${1:-http://localhost:7111}"
ADMIN_USER="testadmin"
ADMIN_PASS="SecurePass123!"

echo "🌱 Kest Demo Seed Script"
echo "   API: $API_BASE"
echo ""

# --- Helper ---
api() {
  local method="$1" path="$2" data="$3"
  if [ -n "$data" ]; then
    curl -s -X "$method" "$API_BASE/v1$path" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "$data"
  else
    curl -s -X "$method" "$API_BASE/v1$path" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json"
  fi
}

jq_val() {
  echo "$1" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d$2)" 2>/dev/null
}

create_spec() {
  local result
  result=$(api POST "/projects/$PROJECT_ID/api-specs" "$1")
  local id
  id=$(jq_val "$result" "['data']['id']")
  if [ -z "$id" ] || [ "$id" = "None" ]; then
    echo "   ⚠️  Failed: $(echo "$result" | head -c 120)"
  else
    echo "   ✅ $2"
  fi
}

# =============================================================================
# 1. Login
# =============================================================================
echo "🔑 Logging in as $ADMIN_USER..."
LOGIN_RESP=$(curl -s -X POST "$API_BASE/v1/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$ADMIN_USER\",\"password\":\"$ADMIN_PASS\"}")

TOKEN=$(jq_val "$LOGIN_RESP" "['data']['access_token']")
if [ -z "$TOKEN" ] || [ "$TOKEN" = "None" ]; then
  echo "❌ Login failed. Response: $LOGIN_RESP"
  exit 1
fi
echo "   ✅ Login successful"

# =============================================================================
# 2. Create Demo Project — Kest Platform API
# =============================================================================
echo ""
echo "📦 Creating demo project..."
PROJ_RESP=$(api POST "/projects" '{
  "name": "Kest Platform API",
  "slug": "kest-platform",
  "platform": "go"
}')
PROJECT_ID=$(jq_val "$PROJ_RESP" "['data']['id']")
if [ -z "$PROJECT_ID" ] || [ "$PROJECT_ID" = "None" ]; then
  echo "   ⚠️  Project may already exist, trying to find it..."
  LIST_RESP=$(api GET "/projects")
  PROJECT_ID=$(echo "$LIST_RESP" | python3 -c "
import sys,json
d=json.load(sys.stdin)
for p in d['data']['items']:
    if p['slug']=='kest-platform':
        print(p['id']); break
" 2>/dev/null)
  if [ -z "$PROJECT_ID" ]; then
    echo "❌ Failed to create or find project"
    exit 1
  fi
fi
echo "   ✅ Project ID: $PROJECT_ID"

# =============================================================================
# 3. Create Categories
# =============================================================================
echo ""
echo "📂 Creating categories..."

CAT_AUTH_RESP=$(api POST "/projects/$PROJECT_ID/categories" '{
  "name": "Authentication",
  "description": "User registration, login, password management",
  "sort_order": 1
}')
CAT_AUTH_ID=$(jq_val "$CAT_AUTH_RESP" "['data']['id']")
echo "   ✅ Authentication (ID: $CAT_AUTH_ID)"

CAT_USER_RESP=$(api POST "/projects/$PROJECT_ID/categories" '{
  "name": "Users",
  "description": "User profile and account management",
  "sort_order": 2
}')
CAT_USER_ID=$(jq_val "$CAT_USER_RESP" "['data']['id']")
echo "   ✅ Users (ID: $CAT_USER_ID)"

CAT_PROJ_RESP=$(api POST "/projects/$PROJECT_ID/categories" '{
  "name": "Projects",
  "description": "Project CRUD and configuration",
  "sort_order": 3
}')
CAT_PROJ_ID=$(jq_val "$CAT_PROJ_RESP" "['data']['id']")
echo "   ✅ Projects (ID: $CAT_PROJ_ID)"

CAT_CAT_RESP=$(api POST "/projects/$PROJECT_ID/categories" '{
  "name": "Categories",
  "description": "API category management within projects",
  "sort_order": 4
}')
CAT_CAT_ID=$(jq_val "$CAT_CAT_RESP" "['data']['id']")
echo "   ✅ Categories (ID: $CAT_CAT_ID)"

CAT_SPEC_RESP=$(api POST "/projects/$PROJECT_ID/categories" '{
  "name": "API Specs",
  "description": "API specification documentation management",
  "sort_order": 5
}')
CAT_SPEC_ID=$(jq_val "$CAT_SPEC_RESP" "['data']['id']")
echo "   ✅ API Specs (ID: $CAT_SPEC_ID)"

CAT_FLOW_RESP=$(api POST "/projects/$PROJECT_ID/categories" '{
  "name": "Flows",
  "description": "Flow test scenario management and execution",
  "sort_order": 6
}')
CAT_FLOW_ID=$(jq_val "$CAT_FLOW_RESP" "['data']['id']")
echo "   ✅ Flows (ID: $CAT_FLOW_ID)"

# =============================================================================
# 4. Create API Specifications (Kest's own real APIs)
# =============================================================================
echo ""
echo "📝 Creating API specifications..."

# ---- Authentication ----

create_spec "{
  \"method\": \"POST\",
  \"path\": \"/v1/register\",
  \"summary\": \"User Registration\",
  \"description\": \"Register a new user account. Username and email must be unique.\",
  \"category_id\": $CAT_AUTH_ID,
  \"version\": \"1.0.0\",
  \"tags\": [\"auth\", \"public\"],
  \"parameters\": [],
  \"request_body\": {
    \"content_type\": \"application/json\",
    \"required\": true,
    \"schema\": {
      \"type\": \"object\",
      \"properties\": {
        \"username\": {\"type\": \"string\", \"minLength\": 3, \"maxLength\": 50},
        \"password\": {\"type\": \"string\", \"minLength\": 6, \"maxLength\": 50},
        \"email\":    {\"type\": \"string\", \"format\": \"email\"},
        \"nickname\": {\"type\": \"string\", \"maxLength\": 50},
        \"phone\":    {\"type\": \"string\", \"maxLength\": 20}
      },
      \"required\": [\"username\", \"password\", \"email\"]
    }
  },
  \"responses\": {
    \"201\": {
      \"description\": \"User created successfully\",
      \"content_type\": \"application/json\",
      \"schema\": {
        \"type\": \"object\",
        \"properties\": {
          \"code\": {\"type\": \"integer\", \"example\": 0},
          \"data\": {
            \"type\": \"object\",
            \"properties\": {
              \"id\": {\"type\": \"integer\"},
              \"username\": {\"type\": \"string\"},
              \"email\": {\"type\": \"string\"},
              \"nickname\": {\"type\": \"string\"},
              \"status\": {\"type\": \"integer\"},
              \"created_at\": {\"type\": \"string\", \"format\": \"date-time\"}
            }
          }
        }
      }
    },
    \"409\": {\"description\": \"Email already exists\", \"content_type\": \"application/json\"}
  }
}" "POST /v1/register"

create_spec "{
  \"method\": \"POST\",
  \"path\": \"/v1/login\",
  \"summary\": \"User Login\",
  \"description\": \"Authenticate with username (or email) and password. Returns a JWT access token.\",
  \"category_id\": $CAT_AUTH_ID,
  \"version\": \"1.0.0\",
  \"tags\": [\"auth\", \"public\"],
  \"parameters\": [],
  \"request_body\": {
    \"content_type\": \"application/json\",
    \"required\": true,
    \"schema\": {
      \"type\": \"object\",
      \"properties\": {
        \"username\": {\"type\": \"string\"},
        \"password\": {\"type\": \"string\"}
      },
      \"required\": [\"username\", \"password\"]
    }
  },
  \"responses\": {
    \"200\": {
      \"description\": \"Login successful\",
      \"content_type\": \"application/json\",
      \"schema\": {
        \"type\": \"object\",
        \"properties\": {
          \"code\": {\"type\": \"integer\"},
          \"data\": {
            \"type\": \"object\",
            \"properties\": {
              \"access_token\": {\"type\": \"string\"},
              \"user\": {
                \"type\": \"object\",
                \"properties\": {
                  \"id\": {\"type\": \"integer\"},
                  \"username\": {\"type\": \"string\"},
                  \"email\": {\"type\": \"string\"},
                  \"nickname\": {\"type\": \"string\"}
                }
              }
            }
          }
        }
      }
    },
    \"401\": {\"description\": \"Invalid credentials\", \"content_type\": \"application/json\"},
    \"403\": {\"description\": \"Account disabled\", \"content_type\": \"application/json\"}
  }
}" "POST /v1/login"

create_spec "{
  \"method\": \"POST\",
  \"path\": \"/v1/password/reset\",
  \"summary\": \"Reset Password\",
  \"description\": \"Request a password reset email. The email must be associated with an existing account.\",
  \"category_id\": $CAT_AUTH_ID,
  \"version\": \"1.0.0\",
  \"tags\": [\"auth\", \"public\"],
  \"parameters\": [],
  \"request_body\": {
    \"content_type\": \"application/json\",
    \"required\": true,
    \"schema\": {
      \"type\": \"object\",
      \"properties\": {
        \"email\": {\"type\": \"string\", \"format\": \"email\"}
      },
      \"required\": [\"email\"]
    }
  },
  \"responses\": {
    \"200\": {\"description\": \"Reset email sent (always returns 200 for security)\", \"content_type\": \"application/json\"}
  }
}" "POST /v1/password/reset"

# ---- Users ----

create_spec "{
  \"method\": \"GET\",
  \"path\": \"/v1/users/profile\",
  \"summary\": \"Get My Profile\",
  \"description\": \"Returns the authenticated user's full profile including nickname, avatar, bio, phone, and last login time.\",
  \"category_id\": $CAT_USER_ID,
  \"version\": \"1.0.0\",
  \"tags\": [\"users\"],
  \"parameters\": [
    {\"name\": \"Authorization\", \"in\": \"header\", \"required\": true, \"description\": \"Bearer JWT token\", \"schema\": {\"type\": \"string\"}}
  ],
  \"responses\": {
    \"200\": {
      \"description\": \"User profile\",
      \"content_type\": \"application/json\",
      \"schema\": {
        \"type\": \"object\",
        \"properties\": {
          \"code\": {\"type\": \"integer\"},
          \"data\": {
            \"type\": \"object\",
            \"properties\": {
              \"id\": {\"type\": \"integer\"},
              \"username\": {\"type\": \"string\"},
              \"email\": {\"type\": \"string\"},
              \"nickname\": {\"type\": \"string\"},
              \"avatar\": {\"type\": \"string\"},
              \"phone\": {\"type\": \"string\"},
              \"bio\": {\"type\": \"string\"},
              \"status\": {\"type\": \"integer\", \"enum\": [0, 1]},
              \"last_login\": {\"type\": \"string\", \"format\": \"date-time\"},
              \"created_at\": {\"type\": \"string\", \"format\": \"date-time\"},
              \"updated_at\": {\"type\": \"string\", \"format\": \"date-time\"}
            }
          }
        }
      }
    },
    \"401\": {\"description\": \"Unauthorized\", \"content_type\": \"application/json\"}
  }
}" "GET  /v1/users/profile"

create_spec "{
  \"method\": \"PUT\",
  \"path\": \"/v1/users/profile\",
  \"summary\": \"Update My Profile\",
  \"description\": \"Update the authenticated user's profile. Only provided fields will be updated.\",
  \"category_id\": $CAT_USER_ID,
  \"version\": \"1.0.0\",
  \"tags\": [\"users\"],
  \"parameters\": [
    {\"name\": \"Authorization\", \"in\": \"header\", \"required\": true, \"description\": \"Bearer JWT token\", \"schema\": {\"type\": \"string\"}}
  ],
  \"request_body\": {
    \"content_type\": \"application/json\",
    \"required\": true,
    \"schema\": {
      \"type\": \"object\",
      \"properties\": {
        \"nickname\": {\"type\": \"string\", \"maxLength\": 50},
        \"avatar\":   {\"type\": \"string\", \"maxLength\": 255, \"format\": \"uri\"},
        \"phone\":    {\"type\": \"string\", \"maxLength\": 20},
        \"bio\":      {\"type\": \"string\", \"maxLength\": 500}
      }
    }
  },
  \"responses\": {
    \"200\": {\"description\": \"Profile updated, returns full user object\", \"content_type\": \"application/json\"},
    \"401\": {\"description\": \"Unauthorized\", \"content_type\": \"application/json\"}
  }
}" "PUT  /v1/users/profile"

create_spec "{
  \"method\": \"PUT\",
  \"path\": \"/v1/users/password\",
  \"summary\": \"Change Password\",
  \"description\": \"Change the authenticated user's password. Requires the current password for verification.\",
  \"category_id\": $CAT_USER_ID,
  \"version\": \"1.0.0\",
  \"tags\": [\"users\"],
  \"parameters\": [
    {\"name\": \"Authorization\", \"in\": \"header\", \"required\": true, \"description\": \"Bearer JWT token\", \"schema\": {\"type\": \"string\"}}
  ],
  \"request_body\": {
    \"content_type\": \"application/json\",
    \"required\": true,
    \"schema\": {
      \"type\": \"object\",
      \"properties\": {
        \"old_password\": {\"type\": \"string\"},
        \"new_password\": {\"type\": \"string\", \"minLength\": 6, \"maxLength\": 50}
      },
      \"required\": [\"old_password\", \"new_password\"]
    }
  },
  \"responses\": {
    \"200\": {\"description\": \"Password changed successfully\", \"content_type\": \"application/json\"},
    \"400\": {\"description\": \"Old password incorrect\", \"content_type\": \"application/json\"}
  }
}" "PUT  /v1/users/password"

create_spec "{
  \"method\": \"GET\",
  \"path\": \"/v1/users\",
  \"summary\": \"List Users\",
  \"description\": \"List all users with pagination. Requires authentication.\",
  \"category_id\": $CAT_USER_ID,
  \"version\": \"1.0.0\",
  \"tags\": [\"users\", \"admin\"],
  \"parameters\": [
    {\"name\": \"Authorization\", \"in\": \"header\", \"required\": true, \"description\": \"Bearer JWT token\", \"schema\": {\"type\": \"string\"}},
    {\"name\": \"page\", \"in\": \"query\", \"required\": false, \"description\": \"Page number (default: 1)\", \"schema\": {\"type\": \"integer\", \"default\": 1}},
    {\"name\": \"per_page\", \"in\": \"query\", \"required\": false, \"description\": \"Items per page (default: 20, max: 100)\", \"schema\": {\"type\": \"integer\", \"default\": 20}}
  ],
  \"responses\": {
    \"200\": {
      \"description\": \"Paginated user list\",
      \"content_type\": \"application/json\",
      \"schema\": {
        \"type\": \"object\",
        \"properties\": {
          \"code\": {\"type\": \"integer\"},
          \"data\": {
            \"type\": \"object\",
            \"properties\": {
              \"items\": {\"type\": \"array\", \"items\": {\"type\": \"object\"}},
              \"total\": {\"type\": \"integer\"},
              \"page\": {\"type\": \"integer\"},
              \"per_page\": {\"type\": \"integer\"}
            }
          }
        }
      }
    }
  }
}" "GET  /v1/users"

# ---- Projects ----

create_spec "{
  \"method\": \"POST\",
  \"path\": \"/v1/projects\",
  \"summary\": \"Create Project\",
  \"description\": \"Create a new project. Auto-generates slug from name if not provided. Creator is assigned as Owner.\",
  \"category_id\": $CAT_PROJ_ID,
  \"version\": \"1.0.0\",
  \"tags\": [\"projects\"],
  \"parameters\": [
    {\"name\": \"Authorization\", \"in\": \"header\", \"required\": true, \"description\": \"Bearer JWT token\", \"schema\": {\"type\": \"string\"}}
  ],
  \"request_body\": {
    \"content_type\": \"application/json\",
    \"required\": true,
    \"schema\": {
      \"type\": \"object\",
      \"properties\": {
        \"name\":     {\"type\": \"string\", \"minLength\": 1, \"maxLength\": 100},
        \"slug\":     {\"type\": \"string\", \"minLength\": 1, \"maxLength\": 50},
        \"platform\": {\"type\": \"string\", \"enum\": [\"go\", \"javascript\", \"python\", \"java\", \"ruby\", \"php\", \"csharp\"]}
      },
      \"required\": [\"name\"]
    }
  },
  \"responses\": {
    \"201\": {
      \"description\": \"Project created\",
      \"content_type\": \"application/json\",
      \"schema\": {
        \"type\": \"object\",
        \"properties\": {
          \"code\": {\"type\": \"integer\"},
          \"data\": {
            \"type\": \"object\",
            \"properties\": {
              \"id\": {\"type\": \"integer\"},
              \"name\": {\"type\": \"string\"},
              \"slug\": {\"type\": \"string\"},
              \"public_key\": {\"type\": \"string\"},
              \"dsn\": {\"type\": \"string\"},
              \"platform\": {\"type\": \"string\"},
              \"status\": {\"type\": \"integer\"},
              \"rate_limit_per_minute\": {\"type\": \"integer\"},
              \"created_at\": {\"type\": \"string\", \"format\": \"date-time\"}
            }
          }
        }
      }
    },
    \"409\": {\"description\": \"Slug already exists\", \"content_type\": \"application/json\"}
  }
}" "POST /v1/projects"

create_spec "{
  \"method\": \"GET\",
  \"path\": \"/v1/projects\",
  \"summary\": \"List Projects\",
  \"description\": \"List all projects the authenticated user has access to, with pagination.\",
  \"category_id\": $CAT_PROJ_ID,
  \"version\": \"1.0.0\",
  \"tags\": [\"projects\"],
  \"parameters\": [
    {\"name\": \"Authorization\", \"in\": \"header\", \"required\": true, \"description\": \"Bearer JWT token\", \"schema\": {\"type\": \"string\"}},
    {\"name\": \"page\", \"in\": \"query\", \"required\": false, \"description\": \"Page number\", \"schema\": {\"type\": \"integer\", \"default\": 1}},
    {\"name\": \"per_page\", \"in\": \"query\", \"required\": false, \"description\": \"Items per page\", \"schema\": {\"type\": \"integer\", \"default\": 20}}
  ],
  \"responses\": {
    \"200\": {
      \"description\": \"Paginated project list\",
      \"content_type\": \"application/json\",
      \"schema\": {
        \"type\": \"object\",
        \"properties\": {
          \"code\": {\"type\": \"integer\"},
          \"data\": {
            \"type\": \"object\",
            \"properties\": {
              \"items\": {\"type\": \"array\", \"items\": {\"type\": \"object\"}},
              \"total\": {\"type\": \"integer\"}
            }
          }
        }
      }
    }
  }
}" "GET  /v1/projects"

create_spec "{
  \"method\": \"GET\",
  \"path\": \"/v1/projects/:id\",
  \"summary\": \"Get Project\",
  \"description\": \"Get project details by ID, including public key, DSN, platform, and rate limit configuration.\",
  \"category_id\": $CAT_PROJ_ID,
  \"version\": \"1.0.0\",
  \"tags\": [\"projects\"],
  \"parameters\": [
    {\"name\": \"Authorization\", \"in\": \"header\", \"required\": true, \"description\": \"Bearer JWT token\", \"schema\": {\"type\": \"string\"}},
    {\"name\": \"id\", \"in\": \"path\", \"required\": true, \"description\": \"Project ID\", \"schema\": {\"type\": \"integer\"}}
  ],
  \"responses\": {
    \"200\": {\"description\": \"Project details with DSN\", \"content_type\": \"application/json\"},
    \"404\": {\"description\": \"Project not found\", \"content_type\": \"application/json\"}
  }
}" "GET  /v1/projects/:id"

create_spec "{
  \"method\": \"PUT\",
  \"path\": \"/v1/projects/:id\",
  \"summary\": \"Update Project\",
  \"description\": \"Update project settings. Only provided fields will be changed.\",
  \"category_id\": $CAT_PROJ_ID,
  \"version\": \"1.0.0\",
  \"tags\": [\"projects\"],
  \"parameters\": [
    {\"name\": \"Authorization\", \"in\": \"header\", \"required\": true, \"description\": \"Bearer JWT token\", \"schema\": {\"type\": \"string\"}},
    {\"name\": \"id\", \"in\": \"path\", \"required\": true, \"description\": \"Project ID\", \"schema\": {\"type\": \"integer\"}}
  ],
  \"request_body\": {
    \"content_type\": \"application/json\",
    \"required\": true,
    \"schema\": {
      \"type\": \"object\",
      \"properties\": {
        \"name\":     {\"type\": \"string\", \"minLength\": 1, \"maxLength\": 100},
        \"platform\": {\"type\": \"string\", \"enum\": [\"go\", \"javascript\", \"python\", \"java\", \"ruby\", \"php\", \"csharp\"]},
        \"status\":   {\"type\": \"integer\", \"enum\": [0, 1]},
        \"rate_limit_per_minute\": {\"type\": \"integer\", \"minimum\": 0, \"maximum\": 100000}
      }
    }
  },
  \"responses\": {
    \"200\": {\"description\": \"Project updated\", \"content_type\": \"application/json\"},
    \"404\": {\"description\": \"Project not found\", \"content_type\": \"application/json\"}
  }
}" "PUT  /v1/projects/:id"

create_spec "{
  \"method\": \"DELETE\",
  \"path\": \"/v1/projects/:id\",
  \"summary\": \"Delete Project\",
  \"description\": \"Soft-delete a project. All associated data (categories, API specs, flows) will be preserved but inaccessible.\",
  \"category_id\": $CAT_PROJ_ID,
  \"version\": \"1.0.0\",
  \"tags\": [\"projects\"],
  \"parameters\": [
    {\"name\": \"Authorization\", \"in\": \"header\", \"required\": true, \"description\": \"Bearer JWT token\", \"schema\": {\"type\": \"string\"}},
    {\"name\": \"id\", \"in\": \"path\", \"required\": true, \"description\": \"Project ID\", \"schema\": {\"type\": \"integer\"}}
  ],
  \"responses\": {
    \"200\": {\"description\": \"Project deleted\", \"content_type\": \"application/json\"},
    \"404\": {\"description\": \"Project not found\", \"content_type\": \"application/json\"}
  }
}" "DEL  /v1/projects/:id"

# ---- Categories ----

create_spec "{
  \"method\": \"GET\",
  \"path\": \"/v1/projects/:id/categories\",
  \"summary\": \"List Categories\",
  \"description\": \"List all categories for a project. Returns a flat list ordered by sort_order. Supports tree structure via parent_id.\",
  \"category_id\": $CAT_CAT_ID,
  \"version\": \"1.0.0\",
  \"tags\": [\"categories\"],
  \"parameters\": [
    {\"name\": \"Authorization\", \"in\": \"header\", \"required\": true, \"description\": \"Bearer JWT token\", \"schema\": {\"type\": \"string\"}},
    {\"name\": \"id\", \"in\": \"path\", \"required\": true, \"description\": \"Project ID\", \"schema\": {\"type\": \"integer\"}}
  ],
  \"responses\": {
    \"200\": {
      \"description\": \"Category list\",
      \"content_type\": \"application/json\",
      \"schema\": {
        \"type\": \"object\",
        \"properties\": {
          \"code\": {\"type\": \"integer\"},
          \"data\": {
            \"type\": \"object\",
            \"properties\": {
              \"items\": {
                \"type\": \"array\",
                \"items\": {
                  \"type\": \"object\",
                  \"properties\": {
                    \"id\": {\"type\": \"integer\"},
                    \"project_id\": {\"type\": \"integer\"},
                    \"name\": {\"type\": \"string\"},
                    \"parent_id\": {\"type\": \"integer\"},
                    \"description\": {\"type\": \"string\"},
                    \"sort_order\": {\"type\": \"integer\"},
                    \"children\": {\"type\": \"array\"}
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}" "GET  /v1/projects/:id/categories"

create_spec "{
  \"method\": \"POST\",
  \"path\": \"/v1/projects/:id/categories\",
  \"summary\": \"Create Category\",
  \"description\": \"Create a new category within a project. Supports nested categories via parent_id.\",
  \"category_id\": $CAT_CAT_ID,
  \"version\": \"1.0.0\",
  \"tags\": [\"categories\"],
  \"parameters\": [
    {\"name\": \"Authorization\", \"in\": \"header\", \"required\": true, \"description\": \"Bearer JWT token\", \"schema\": {\"type\": \"string\"}},
    {\"name\": \"id\", \"in\": \"path\", \"required\": true, \"description\": \"Project ID\", \"schema\": {\"type\": \"integer\"}}
  ],
  \"request_body\": {
    \"content_type\": \"application/json\",
    \"required\": true,
    \"schema\": {
      \"type\": \"object\",
      \"properties\": {
        \"name\":        {\"type\": \"string\", \"maxLength\": 255},
        \"parent_id\":   {\"type\": \"integer\"},
        \"description\": {\"type\": \"string\"},
        \"sort_order\":  {\"type\": \"integer\"}
      },
      \"required\": [\"name\"]
    }
  },
  \"responses\": {
    \"201\": {\"description\": \"Category created\", \"content_type\": \"application/json\"},
    \"400\": {\"description\": \"Invalid input\", \"content_type\": \"application/json\"}
  }
}" "POST /v1/projects/:id/categories"

# ---- API Specs ----

create_spec "{
  \"method\": \"GET\",
  \"path\": \"/v1/projects/:id/api-specs\",
  \"summary\": \"List API Specs\",
  \"description\": \"List all API specifications for a project with pagination. Supports filtering by version.\",
  \"category_id\": $CAT_SPEC_ID,
  \"version\": \"1.0.0\",
  \"tags\": [\"api-specs\"],
  \"parameters\": [
    {\"name\": \"Authorization\", \"in\": \"header\", \"required\": true, \"description\": \"Bearer JWT token\", \"schema\": {\"type\": \"string\"}},
    {\"name\": \"id\", \"in\": \"path\", \"required\": true, \"description\": \"Project ID\", \"schema\": {\"type\": \"integer\"}},
    {\"name\": \"page\", \"in\": \"query\", \"required\": false, \"description\": \"Page number\", \"schema\": {\"type\": \"integer\", \"default\": 1}},
    {\"name\": \"per_page\", \"in\": \"query\", \"required\": false, \"description\": \"Items per page\", \"schema\": {\"type\": \"integer\", \"default\": 20}},
    {\"name\": \"version\", \"in\": \"query\", \"required\": false, \"description\": \"Filter by API version\", \"schema\": {\"type\": \"string\"}}
  ],
  \"responses\": {
    \"200\": {\"description\": \"Paginated API spec list\", \"content_type\": \"application/json\"}
  }
}" "GET  /v1/projects/:id/api-specs"

create_spec "{
  \"method\": \"POST\",
  \"path\": \"/v1/projects/:id/api-specs\",
  \"summary\": \"Create API Spec\",
  \"description\": \"Create a new API specification with method, path, parameters, request body schema, and response definitions.\",
  \"category_id\": $CAT_SPEC_ID,
  \"version\": \"1.0.0\",
  \"tags\": [\"api-specs\"],
  \"parameters\": [
    {\"name\": \"Authorization\", \"in\": \"header\", \"required\": true, \"description\": \"Bearer JWT token\", \"schema\": {\"type\": \"string\"}},
    {\"name\": \"id\", \"in\": \"path\", \"required\": true, \"description\": \"Project ID\", \"schema\": {\"type\": \"integer\"}}
  ],
  \"request_body\": {
    \"content_type\": \"application/json\",
    \"required\": true,
    \"schema\": {
      \"type\": \"object\",
      \"properties\": {
        \"method\":       {\"type\": \"string\", \"enum\": [\"GET\", \"POST\", \"PUT\", \"DELETE\", \"PATCH\", \"HEAD\", \"OPTIONS\"]},
        \"path\":         {\"type\": \"string\", \"maxLength\": 500},
        \"summary\":      {\"type\": \"string\", \"maxLength\": 500},
        \"description\":  {\"type\": \"string\"},
        \"category_id\":  {\"type\": \"integer\"},
        \"tags\":         {\"type\": \"array\", \"items\": {\"type\": \"string\"}},
        \"version\":      {\"type\": \"string\", \"maxLength\": 50},
        \"parameters\":   {\"type\": \"array\", \"items\": {\"type\": \"object\"}},
        \"request_body\": {\"type\": \"object\"},
        \"responses\":    {\"type\": \"object\"}
      },
      \"required\": [\"method\", \"path\", \"version\"]
    }
  },
  \"responses\": {
    \"201\": {\"description\": \"API spec created\", \"content_type\": \"application/json\"},
    \"400\": {\"description\": \"Invalid input\", \"content_type\": \"application/json\"}
  }
}" "POST /v1/projects/:id/api-specs"

# ---- Flows ----

create_spec "{
  \"method\": \"GET\",
  \"path\": \"/v1/projects/:id/flows\",
  \"summary\": \"List Flows\",
  \"description\": \"List all test flows for a project. Each flow contains steps (HTTP requests) and edges (connections).\",
  \"category_id\": $CAT_FLOW_ID,
  \"version\": \"1.0.0\",
  \"tags\": [\"flows\"],
  \"parameters\": [
    {\"name\": \"Authorization\", \"in\": \"header\", \"required\": true, \"description\": \"Bearer JWT token\", \"schema\": {\"type\": \"string\"}},
    {\"name\": \"id\", \"in\": \"path\", \"required\": true, \"description\": \"Project ID\", \"schema\": {\"type\": \"integer\"}}
  ],
  \"responses\": {
    \"200\": {\"description\": \"Flow list with step counts\", \"content_type\": \"application/json\"}
  }
}" "GET  /v1/projects/:id/flows"

create_spec "{
  \"method\": \"POST\",
  \"path\": \"/v1/projects/:id/flows\",
  \"summary\": \"Create Flow\",
  \"description\": \"Create a new test flow. After creation, add steps and edges to define the test scenario.\",
  \"category_id\": $CAT_FLOW_ID,
  \"version\": \"1.0.0\",
  \"tags\": [\"flows\"],
  \"parameters\": [
    {\"name\": \"Authorization\", \"in\": \"header\", \"required\": true, \"description\": \"Bearer JWT token\", \"schema\": {\"type\": \"string\"}},
    {\"name\": \"id\", \"in\": \"path\", \"required\": true, \"description\": \"Project ID\", \"schema\": {\"type\": \"integer\"}}
  ],
  \"request_body\": {
    \"content_type\": \"application/json\",
    \"required\": true,
    \"schema\": {
      \"type\": \"object\",
      \"properties\": {
        \"name\":        {\"type\": \"string\"},
        \"description\": {\"type\": \"string\"}
      },
      \"required\": [\"name\"]
    }
  },
  \"responses\": {
    \"201\": {\"description\": \"Flow created\", \"content_type\": \"application/json\"}
  }
}" "POST /v1/projects/:id/flows"

create_spec "{
  \"method\": \"POST\",
  \"path\": \"/v1/projects/:id/flows/:fid/run\",
  \"summary\": \"Run Flow\",
  \"description\": \"Trigger a flow execution. Creates a new run record. Use the SSE endpoint to stream real-time step results.\",
  \"category_id\": $CAT_FLOW_ID,
  \"version\": \"1.0.0\",
  \"tags\": [\"flows\", \"execution\"],
  \"parameters\": [
    {\"name\": \"Authorization\", \"in\": \"header\", \"required\": true, \"description\": \"Bearer JWT token\", \"schema\": {\"type\": \"string\"}},
    {\"name\": \"id\", \"in\": \"path\", \"required\": true, \"description\": \"Project ID\", \"schema\": {\"type\": \"integer\"}},
    {\"name\": \"fid\", \"in\": \"path\", \"required\": true, \"description\": \"Flow ID\", \"schema\": {\"type\": \"integer\"}}
  ],
  \"responses\": {
    \"201\": {
      \"description\": \"Run created, returns run ID for SSE streaming\",
      \"content_type\": \"application/json\",
      \"schema\": {
        \"type\": \"object\",
        \"properties\": {
          \"code\": {\"type\": \"integer\"},
          \"data\": {
            \"type\": \"object\",
            \"properties\": {
              \"id\": {\"type\": \"integer\"},
              \"flow_id\": {\"type\": \"integer\"},
              \"status\": {\"type\": \"string\", \"enum\": [\"pending\", \"running\", \"passed\", \"failed\"]},
              \"triggered_by\": {\"type\": \"integer\"}
            }
          }
        }
      }
    }
  }
}" "POST /v1/projects/:id/flows/:fid/run"

create_spec "{
  \"method\": \"GET\",
  \"path\": \"/v1/projects/:id/flows/:fid/runs/:rid/events\",
  \"summary\": \"Flow Execution SSE\",
  \"description\": \"Server-Sent Events endpoint for real-time flow execution. Streams step events (status, duration, assert results) as they execute. Event types: 'step' for each step result, 'done' when complete.\",
  \"category_id\": $CAT_FLOW_ID,
  \"version\": \"1.0.0\",
  \"tags\": [\"flows\", \"sse\", \"realtime\"],
  \"parameters\": [
    {\"name\": \"Authorization\", \"in\": \"header\", \"required\": true, \"description\": \"Bearer JWT token\", \"schema\": {\"type\": \"string\"}},
    {\"name\": \"id\", \"in\": \"path\", \"required\": true, \"description\": \"Project ID\", \"schema\": {\"type\": \"integer\"}},
    {\"name\": \"fid\", \"in\": \"path\", \"required\": true, \"description\": \"Flow ID\", \"schema\": {\"type\": \"integer\"}},
    {\"name\": \"rid\", \"in\": \"path\", \"required\": true, \"description\": \"Run ID\", \"schema\": {\"type\": \"integer\"}}
  ],
  \"responses\": {
    \"200\": {
      \"description\": \"SSE stream of step execution events\",
      \"content_type\": \"text/event-stream\",
      \"schema\": {
        \"type\": \"object\",
        \"properties\": {
          \"run_id\": {\"type\": \"integer\"},
          \"step_id\": {\"type\": \"integer\"},
          \"step_name\": {\"type\": \"string\"},
          \"status\": {\"type\": \"string\", \"enum\": [\"running\", \"passed\", \"failed\"]},
          \"data\": {\"type\": \"object\"}
        }
      }
    }
  }
}" "GET  /v1/projects/:id/flows/:fid/runs/:rid/events"

# =============================================================================
# 5. Create Flow Test Scenarios
# =============================================================================
echo ""
echo "🔄 Creating Flow test scenarios..."

# --- Flow 1: User Login & Profile ---
FLOW1_RESP=$(api POST "/projects/$PROJECT_ID/flows" '{
  "name": "User Login & Profile",
  "description": "Test the complete login flow: authenticate → get profile → update profile"
}')
FLOW1_ID=$(jq_val "$FLOW1_RESP" "['data']['id']")
echo "   ✅ Flow: User Login & Profile (ID: $FLOW1_ID)"

api PUT "/projects/$PROJECT_ID/flows/$FLOW1_ID" '{
  "steps": [
    {
      "client_key": "login",
      "name": "Login",
      "sort_order": 0,
      "method": "POST",
      "url": "/v1/login",
      "headers": "{\"Content-Type\": \"application/json\"}",
      "body": "{\"username\": \"testadmin\", \"password\": \"SecurePass123!\"}",
      "captures": "token=body.data.access_token",
      "asserts": "status == 200\nbody.code == 0",
      "position_x": 250,
      "position_y": 50
    },
    {
      "client_key": "get-profile",
      "name": "Get Profile",
      "sort_order": 1,
      "method": "GET",
      "url": "/v1/users/profile",
      "headers": "{\"Authorization\": \"Bearer {{token}}\"}",
      "body": "",
      "captures": "user_id=body.data.id\nusername=body.data.username",
      "asserts": "status == 200\nbody.data.username == testadmin",
      "position_x": 250,
      "position_y": 250
    },
    {
      "client_key": "update-profile",
      "name": "Update Profile",
      "sort_order": 2,
      "method": "PUT",
      "url": "/v1/users/profile",
      "headers": "{\"Authorization\": \"Bearer {{token}}\", \"Content-Type\": \"application/json\"}",
      "body": "{\"nickname\": \"Demo Admin\"}",
      "captures": "",
      "asserts": "status == 200",
      "position_x": 250,
      "position_y": 450
    }
  ],
  "edges": [
    {"source_client_key": "login", "target_client_key": "get-profile"},
    {"source_client_key": "get-profile", "target_client_key": "update-profile"}
  ]
}' > /dev/null
echo "   ✅ Saved 3 steps + 2 edges"

# --- Flow 2: Project CRUD ---
FLOW2_RESP=$(api POST "/projects/$PROJECT_ID/flows" '{
  "name": "Project CRUD",
  "description": "Test project lifecycle: login → create → read → update → delete"
}')
FLOW2_ID=$(jq_val "$FLOW2_RESP" "['data']['id']")
echo ""
echo "   ✅ Flow: Project CRUD (ID: $FLOW2_ID)"

api PUT "/projects/$PROJECT_ID/flows/$FLOW2_ID" '{
  "steps": [
    {
      "client_key": "login",
      "name": "Login",
      "sort_order": 0,
      "method": "POST",
      "url": "/v1/login",
      "headers": "{\"Content-Type\": \"application/json\"}",
      "body": "{\"username\": \"testadmin\", \"password\": \"SecurePass123!\"}",
      "captures": "token=body.data.access_token",
      "asserts": "status == 200",
      "position_x": 250,
      "position_y": 50
    },
    {
      "client_key": "create-project",
      "name": "Create Project",
      "sort_order": 1,
      "method": "POST",
      "url": "/v1/projects",
      "headers": "{\"Authorization\": \"Bearer {{token}}\", \"Content-Type\": \"application/json\"}",
      "body": "{\"name\": \"E2E Test Project\", \"slug\": \"e2e-test-{{$timestamp}}\", \"platform\": \"go\"}",
      "captures": "project_id=body.data.id",
      "asserts": "status == 201\nbody.data.name == E2E Test Project",
      "position_x": 250,
      "position_y": 250
    },
    {
      "client_key": "get-project",
      "name": "Get Project",
      "sort_order": 2,
      "method": "GET",
      "url": "/v1/projects/{{project_id}}",
      "headers": "{\"Authorization\": \"Bearer {{token}}\"}",
      "body": "",
      "captures": "",
      "asserts": "status == 200\nbody.data.id == {{project_id}}",
      "position_x": 250,
      "position_y": 450
    },
    {
      "client_key": "update-project",
      "name": "Update Project",
      "sort_order": 3,
      "method": "PUT",
      "url": "/v1/projects/{{project_id}}",
      "headers": "{\"Authorization\": \"Bearer {{token}}\", \"Content-Type\": \"application/json\"}",
      "body": "{\"name\": \"E2E Updated Project\"}",
      "captures": "",
      "asserts": "status == 200",
      "position_x": 250,
      "position_y": 650
    },
    {
      "client_key": "delete-project",
      "name": "Delete Project",
      "sort_order": 4,
      "method": "DELETE",
      "url": "/v1/projects/{{project_id}}",
      "headers": "{\"Authorization\": \"Bearer {{token}}\"}",
      "body": "",
      "captures": "",
      "asserts": "status == 200",
      "position_x": 250,
      "position_y": 850
    }
  ],
  "edges": [
    {"source_client_key": "login", "target_client_key": "create-project"},
    {"source_client_key": "create-project", "target_client_key": "get-project"},
    {"source_client_key": "get-project", "target_client_key": "update-project"},
    {"source_client_key": "update-project", "target_client_key": "delete-project"}
  ]
}' > /dev/null
echo "   ✅ Saved 5 steps + 4 edges"

# =============================================================================
# Done
# =============================================================================
echo ""
echo "============================================="
echo "🎉 Demo data seeded successfully!"
echo "============================================="
echo ""
echo "📦 Project: Kest Platform API (ID: $PROJECT_ID)"
echo "📂 Categories: 6 (Auth, Users, Projects, Categories, API Specs, Flows)"
echo "📝 API Specs: 20 endpoints (Kest's own real APIs)"
echo "🔄 Flows: 2 test scenarios"
echo "   - User Login & Profile (3 steps)"
echo "   - Project CRUD (5 steps)"
echo ""
echo "🌐 View at: http://localhost:3000/projects/$PROJECT_ID"
