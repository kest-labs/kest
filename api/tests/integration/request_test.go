package integration

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/kest-labs/kest/api/pkg/request"
	"github.com/gin-gonic/gin"
)

func init() {
	gin.SetMode(gin.TestMode)
}

func TestValidate_Success(t *testing.T) {
	type CreateUserRequest struct {
		Name  string `json:"name" binding:"required,min=2"`
		Email string `json:"email" binding:"required,email"`
	}

	router := gin.New()
	router.POST("/users", func(c *gin.Context) {
		var req CreateUserRequest
		if err := request.Validate(c, &req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"name": req.Name, "email": req.Email})
	})

	body := `{"name": "John", "email": "john@example.com"}`
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/users", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}
}

func TestValidate_RequiredField(t *testing.T) {
	type CreateUserRequest struct {
		Name  string `json:"name" binding:"required"`
		Email string `json:"email" binding:"required"`
	}

	router := gin.New()
	router.POST("/users", func(c *gin.Context) {
		var req CreateUserRequest
		if err := request.Validate(c, &req); err != nil {
			if verrs, ok := err.(request.ValidationErrors); ok {
				c.JSON(http.StatusBadRequest, gin.H{"errors": verrs.ToMap()})
				return
			}
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true})
	})

	// Missing required fields
	body := `{}`
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/users", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status 400, got %d", w.Code)
	}

	var response map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &response)

	if _, ok := response["errors"]; !ok {
		t.Error("Expected 'errors' in response")
	}
}

func TestValidate_EmailFormat(t *testing.T) {
	type CreateUserRequest struct {
		Email string `json:"email" binding:"required,email"`
	}

	router := gin.New()
	router.POST("/users", func(c *gin.Context) {
		var req CreateUserRequest
		if err := request.Validate(c, &req); err != nil {
			if verrs, ok := err.(request.ValidationErrors); ok {
				c.JSON(http.StatusBadRequest, gin.H{"errors": verrs})
				return
			}
		}
		c.JSON(http.StatusOK, gin.H{"success": true})
	})

	// Invalid email
	body := `{"email": "not-an-email"}`
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/users", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status 400, got %d", w.Code)
	}
}

func TestValidationErrors_Methods(t *testing.T) {
	errs := request.ValidationErrors{
		{Field: "name", Message: "name is required", Tag: "required"},
		{Field: "email", Message: "email must be valid", Tag: "email"},
		{Field: "name", Message: "name must be at least 2 chars", Tag: "min"},
	}

	// Test Error()
	errStr := errs.Error()
	if errStr == "" {
		t.Error("Error() should return non-empty string")
	}

	// Test First()
	first := errs.First()
	if first != "name is required" {
		t.Errorf("Expected 'name is required', got '%s'", first)
	}

	// Test Has()
	if !errs.Has("name") {
		t.Error("Expected Has('name') to return true")
	}
	if errs.Has("password") {
		t.Error("Expected Has('password') to return false")
	}

	// Test Get()
	nameErrs := errs.Get("name")
	if len(nameErrs) != 2 {
		t.Errorf("Expected 2 errors for 'name', got %d", len(nameErrs))
	}

	// Test ToMap()
	errMap := errs.ToMap()
	if len(errMap["name"]) != 2 {
		t.Errorf("Expected 2 messages for 'name', got %d", len(errMap["name"]))
	}
	if len(errMap["email"]) != 1 {
		t.Errorf("Expected 1 message for 'email', got %d", len(errMap["email"]))
	}
}

func TestRequest_Input(t *testing.T) {
	router := gin.New()
	router.GET("/test", func(c *gin.Context) {
		req := request.New(c)

		name := req.Input("name", "default")
		c.JSON(http.StatusOK, gin.H{"name": name})
	})

	// With query parameter
	w := httptest.NewRecorder()
	httpReq, _ := http.NewRequest("GET", "/test?name=John", nil)
	router.ServeHTTP(w, httpReq)

	var response map[string]string
	json.Unmarshal(w.Body.Bytes(), &response)

	if response["name"] != "John" {
		t.Errorf("Expected 'John', got '%s'", response["name"])
	}

	// Without query parameter (use default)
	w = httptest.NewRecorder()
	httpReq, _ = http.NewRequest("GET", "/test", nil)
	router.ServeHTTP(w, httpReq)

	json.Unmarshal(w.Body.Bytes(), &response)
	if response["name"] != "default" {
		t.Errorf("Expected 'default', got '%s'", response["name"])
	}
}

func TestRequest_InputInt(t *testing.T) {
	router := gin.New()
	router.GET("/test", func(c *gin.Context) {
		req := request.New(c)

		page := req.InputInt("page", 1)
		c.JSON(http.StatusOK, gin.H{"page": page})
	})

	w := httptest.NewRecorder()
	httpReq, _ := http.NewRequest("GET", "/test?page=5", nil)
	router.ServeHTTP(w, httpReq)

	var response map[string]int
	json.Unmarshal(w.Body.Bytes(), &response)

	if response["page"] != 5 {
		t.Errorf("Expected 5, got %d", response["page"])
	}
}

func TestRequest_Boolean(t *testing.T) {
	router := gin.New()
	router.GET("/test", func(c *gin.Context) {
		req := request.New(c)

		active := req.Boolean("active")
		c.JSON(http.StatusOK, gin.H{"active": active})
	})

	testCases := []struct {
		query    string
		expected bool
	}{
		{"active=1", true},
		{"active=true", true},
		{"active=on", true},
		{"active=yes", true},
		{"active=0", false},
		{"active=false", false},
		{"active=no", false},
		{"", false},
	}

	for _, tc := range testCases {
		w := httptest.NewRecorder()
		url := "/test"
		if tc.query != "" {
			url += "?" + tc.query
		}
		httpReq, _ := http.NewRequest("GET", url, nil)
		router.ServeHTTP(w, httpReq)

		var response map[string]bool
		json.Unmarshal(w.Body.Bytes(), &response)

		if response["active"] != tc.expected {
			t.Errorf("Query '%s': expected %v, got %v", tc.query, tc.expected, response["active"])
		}
	}
}

func TestRequest_Has(t *testing.T) {
	router := gin.New()
	router.GET("/test", func(c *gin.Context) {
		req := request.New(c)

		has := req.Has("name", "email")
		c.JSON(http.StatusOK, gin.H{"has": has})
	})

	// Has all keys
	w := httptest.NewRecorder()
	httpReq, _ := http.NewRequest("GET", "/test?name=John&email=john@example.com", nil)
	router.ServeHTTP(w, httpReq)

	var response map[string]bool
	json.Unmarshal(w.Body.Bytes(), &response)

	if !response["has"] {
		t.Error("Expected Has to return true when all keys present")
	}

	// Missing one key
	w = httptest.NewRecorder()
	httpReq, _ = http.NewRequest("GET", "/test?name=John", nil)
	router.ServeHTTP(w, httpReq)

	json.Unmarshal(w.Body.Bytes(), &response)
	if response["has"] {
		t.Error("Expected Has to return false when key missing")
	}
}

func TestRequest_Only(t *testing.T) {
	router := gin.New()
	router.GET("/test", func(c *gin.Context) {
		req := request.New(c)

		data := req.Only("name", "email")
		c.JSON(http.StatusOK, data)
	})

	w := httptest.NewRecorder()
	httpReq, _ := http.NewRequest("GET", "/test?name=John&email=john@example.com&password=secret", nil)
	router.ServeHTTP(w, httpReq)

	var response map[string]string
	json.Unmarshal(w.Body.Bytes(), &response)

	if response["name"] != "John" {
		t.Errorf("Expected name='John', got '%s'", response["name"])
	}
	if response["email"] != "john@example.com" {
		t.Errorf("Expected email='john@example.com', got '%s'", response["email"])
	}
	if _, ok := response["password"]; ok {
		t.Error("Expected password to be excluded")
	}
}

func TestRequest_IsMethod(t *testing.T) {
	router := gin.New()
	router.Any("/test", func(c *gin.Context) {
		req := request.New(c)
		c.JSON(http.StatusOK, gin.H{
			"isGet":    req.IsGet(),
			"isPost":   req.IsPost(),
			"isPut":    req.IsPut(),
			"isDelete": req.IsDelete(),
		})
	})

	methods := []struct {
		method   string
		expected string
	}{
		{"GET", "isGet"},
		{"POST", "isPost"},
		{"PUT", "isPut"},
		{"DELETE", "isDelete"},
	}

	for _, m := range methods {
		w := httptest.NewRecorder()
		httpReq, _ := http.NewRequest(m.method, "/test", nil)
		router.ServeHTTP(w, httpReq)

		var response map[string]bool
		json.Unmarshal(w.Body.Bytes(), &response)

		if !response[m.expected] {
			t.Errorf("Expected %s to be true for %s request", m.expected, m.method)
		}
	}
}

func TestRequest_BearerToken(t *testing.T) {
	router := gin.New()
	router.GET("/test", func(c *gin.Context) {
		req := request.New(c)
		token := req.BearerToken()
		c.JSON(http.StatusOK, gin.H{"token": token})
	})

	w := httptest.NewRecorder()
	httpReq, _ := http.NewRequest("GET", "/test", nil)
	httpReq.Header.Set("Authorization", "Bearer abc123token")
	router.ServeHTTP(w, httpReq)

	var response map[string]string
	json.Unmarshal(w.Body.Bytes(), &response)

	if response["token"] != "abc123token" {
		t.Errorf("Expected 'abc123token', got '%s'", response["token"])
	}
}

func TestRequest_IsJSON(t *testing.T) {
	router := gin.New()
	router.GET("/test", func(c *gin.Context) {
		req := request.New(c)
		c.JSON(http.StatusOK, gin.H{
			"isJson":    req.IsJSON(),
			"wantsJson": req.WantsJSON(),
		})
	})

	// With JSON Accept header
	w := httptest.NewRecorder()
	httpReq, _ := http.NewRequest("GET", "/test", nil)
	httpReq.Header.Set("Accept", "application/json")
	router.ServeHTTP(w, httpReq)

	var response map[string]bool
	json.Unmarshal(w.Body.Bytes(), &response)

	if !response["isJson"] {
		t.Error("Expected IsJSON to return true")
	}
	if !response["wantsJson"] {
		t.Error("Expected WantsJSON to return true")
	}
}

func TestStruct2Map(t *testing.T) {
	type User struct {
		ID    int    `json:"id"`
		Name  string `json:"name"`
		Email string `json:"email,omitempty"`
	}

	user := User{ID: 1, Name: "John", Email: "john@example.com"}
	result := request.Struct2Map(user)

	if result["id"] != 1 {
		t.Errorf("Expected id=1, got %v", result["id"])
	}
	if result["name"] != "John" {
		t.Errorf("Expected name='John', got %v", result["name"])
	}
	if result["email"] != "john@example.com" {
		t.Errorf("Expected email='john@example.com', got %v", result["email"])
	}
}

func TestValidateQuery(t *testing.T) {
	type ListRequest struct {
		Page     int    `form:"page" binding:"required,min=1"`
		PageSize int    `form:"page_size" binding:"required,min=1,max=100"`
		Sort     string `form:"sort" binding:"oneof=asc desc"`
	}

	router := gin.New()
	router.GET("/users", func(c *gin.Context) {
		var req ListRequest
		if err := request.ValidateQuery(c, &req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"page":      req.Page,
			"page_size": req.PageSize,
			"sort":      req.Sort,
		})
	})

	w := httptest.NewRecorder()
	httpReq, _ := http.NewRequest("GET", "/users?page=1&page_size=10&sort=desc", nil)
	router.ServeHTTP(w, httpReq)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d: %s", w.Code, w.Body.String())
	}
}
