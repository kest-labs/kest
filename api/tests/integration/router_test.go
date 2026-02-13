package integration

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/kest-labs/kest/api/internal/infra/router"
	"github.com/gin-gonic/gin"
)

func init() {
	gin.SetMode(gin.TestMode)
}

func TestRouter_BasicRoutes(t *testing.T) {
	engine := gin.New()
	r := router.New(engine)

	r.GET("/users", func(c *gin.Context) {
		c.String(200, "users.index")
	})

	r.POST("/users", func(c *gin.Context) {
		c.String(200, "users.store")
	})

	r.PUT("/users/:id", func(c *gin.Context) {
		c.String(200, "users.update")
	})

	r.DELETE("/users/:id", func(c *gin.Context) {
		c.String(200, "users.destroy")
	})

	// Test GET
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/users", nil)
	engine.ServeHTTP(w, req)
	if w.Body.String() != "users.index" {
		t.Errorf("Expected 'users.index', got '%s'", w.Body.String())
	}

	// Test POST
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("POST", "/users", nil)
	engine.ServeHTTP(w, req)
	if w.Body.String() != "users.store" {
		t.Errorf("Expected 'users.store', got '%s'", w.Body.String())
	}
}

func TestRouter_Group(t *testing.T) {
	engine := gin.New()
	r := router.New(engine)

	r.Group("/api", func(api *router.Router) {
		api.Group("/v1", func(v1 *router.Router) {
			v1.GET("/users", func(c *gin.Context) {
				c.String(200, "api.v1.users")
			})
		})
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/v1/users", nil)
	engine.ServeHTTP(w, req)

	if w.Body.String() != "api.v1.users" {
		t.Errorf("Expected 'api.v1.users', got '%s'", w.Body.String())
	}
}

func TestRouter_Middleware(t *testing.T) {
	engine := gin.New()
	r := router.New(engine)

	called := false
	testMiddleware := func(c *gin.Context) {
		called = true
		c.Next()
	}

	r.Group("/admin", func(admin *router.Router) {
		admin.Middleware(testMiddleware)
		admin.GET("/dashboard", func(c *gin.Context) {
			c.String(200, "dashboard")
		})
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/admin/dashboard", nil)
	engine.ServeHTTP(w, req)

	if !called {
		t.Error("Middleware was not called")
	}
	if w.Body.String() != "dashboard" {
		t.Errorf("Expected 'dashboard', got '%s'", w.Body.String())
	}
}

func TestRouter_NamedRoutes(t *testing.T) {
	engine := gin.New()
	r := router.New(engine)

	r.GET("/users/:id", func(c *gin.Context) {
		c.String(200, "show")
	}).Name("users.show")

	route, ok := r.Route("users.show")
	if !ok {
		t.Error("Named route not found")
	}
	if route == nil {
		t.Error("Route is nil")
	}
}

func TestRouter_URL(t *testing.T) {
	engine := gin.New()
	r := router.New(engine)

	r.GET("/users/:id/posts/:post_id", func(c *gin.Context) {
		c.String(200, "show")
	}).Name("users.posts.show")

	url := r.URL("users.posts.show", "id", "123", "post_id", "456")
	expected := "/users/123/posts/456"
	if url != expected {
		t.Errorf("Expected '%s', got '%s'", expected, url)
	}
}

func TestRouter_Redirect(t *testing.T) {
	engine := gin.New()
	r := router.New(engine)

	r.Redirect("/old", "/new")

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/old", nil)
	engine.ServeHTTP(w, req)

	if w.Code != http.StatusFound {
		t.Errorf("Expected status 302, got %d", w.Code)
	}
	if w.Header().Get("Location") != "/new" {
		t.Errorf("Expected redirect to '/new', got '%s'", w.Header().Get("Location"))
	}
}

func TestRouter_PermanentRedirect(t *testing.T) {
	engine := gin.New()
	r := router.New(engine)

	r.PermanentRedirect("/legacy", "/modern")

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/legacy", nil)
	engine.ServeHTTP(w, req)

	if w.Code != http.StatusMovedPermanently {
		t.Errorf("Expected status 301, got %d", w.Code)
	}
}

// MockController implements ResourceController for testing
type MockController struct{}

func (m *MockController) Index(c *gin.Context)   { c.String(200, "index") }
func (m *MockController) Show(c *gin.Context)    { c.String(200, "show:"+c.Param("id")) }
func (m *MockController) Store(c *gin.Context)   { c.String(200, "store") }
func (m *MockController) Update(c *gin.Context)  { c.String(200, "update:"+c.Param("id")) }
func (m *MockController) Destroy(c *gin.Context) { c.String(200, "destroy:"+c.Param("id")) }

func TestRouter_Resource(t *testing.T) {
	engine := gin.New()
	r := router.New(engine)

	controller := &MockController{}
	r.Resource("posts", controller)

	tests := []struct {
		method   string
		path     string
		expected string
	}{
		{"GET", "/posts", "index"},
		{"POST", "/posts", "store"},
		{"GET", "/posts/123", "show:123"},
		{"PUT", "/posts/123", "update:123"},
		{"DELETE", "/posts/123", "destroy:123"},
	}

	for _, tt := range tests {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest(tt.method, tt.path, nil)
		engine.ServeHTTP(w, req)

		if w.Body.String() != tt.expected {
			t.Errorf("%s %s: expected '%s', got '%s'", tt.method, tt.path, tt.expected, w.Body.String())
		}
	}
}

func TestRouter_ResourceWithOnly(t *testing.T) {
	engine := gin.New()
	r := router.New(engine)

	controller := &MockController{}
	r.Resource("comments", controller, router.ResourceOptions{
		Only: []string{"index", "show"},
	})

	// Should work
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/comments", nil)
	engine.ServeHTTP(w, req)
	if w.Body.String() != "index" {
		t.Errorf("Expected 'index', got '%s'", w.Body.String())
	}

	// Should 404
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("POST", "/comments", nil)
	engine.ServeHTTP(w, req)
	if w.Code != http.StatusNotFound {
		t.Errorf("Expected 404 for excluded route, got %d", w.Code)
	}
}

func TestRouter_ResourceWithExcept(t *testing.T) {
	engine := gin.New()
	r := router.New(engine)

	controller := &MockController{}
	r.Resource("articles", controller, router.ResourceOptions{
		Except: []string{"destroy"},
	})

	// Should work
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/articles", nil)
	engine.ServeHTTP(w, req)
	if w.Body.String() != "index" {
		t.Errorf("Expected 'index', got '%s'", w.Body.String())
	}

	// Should 404
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("DELETE", "/articles/1", nil)
	engine.ServeHTTP(w, req)
	if w.Code != http.StatusNotFound {
		t.Errorf("Expected 404 for excluded route, got %d", w.Code)
	}
}

func TestRouter_Prefix(t *testing.T) {
	engine := gin.New()
	r := router.New(engine)

	api := r.Prefix("/api")
	v1 := api.Prefix("/v1")
	v1.GET("/health", func(c *gin.Context) {
		c.String(200, "ok")
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/v1/health", nil)
	engine.ServeHTTP(w, req)

	if w.Body.String() != "ok" {
		t.Errorf("Expected 'ok', got '%s'", w.Body.String())
	}
}

func TestRouter_Match(t *testing.T) {
	engine := gin.New()
	r := router.New(engine)

	r.Match([]string{"GET", "POST"}, "/form", func(c *gin.Context) {
		c.String(200, "form:"+c.Request.Method)
	})

	// Test GET
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/form", nil)
	engine.ServeHTTP(w, req)
	if w.Body.String() != "form:GET" {
		t.Errorf("Expected 'form:GET', got '%s'", w.Body.String())
	}

	// Test POST
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("POST", "/form", nil)
	engine.ServeHTTP(w, req)
	if w.Body.String() != "form:POST" {
		t.Errorf("Expected 'form:POST', got '%s'", w.Body.String())
	}
}

func TestRouter_Fallback(t *testing.T) {
	engine := gin.New()
	r := router.New(engine)

	r.GET("/exists", func(c *gin.Context) {
		c.String(200, "exists")
	})

	r.Fallback(func(c *gin.Context) {
		c.String(404, "custom 404")
	})

	// Test existing route
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/exists", nil)
	engine.ServeHTTP(w, req)
	if w.Body.String() != "exists" {
		t.Errorf("Expected 'exists', got '%s'", w.Body.String())
	}

	// Test fallback
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("GET", "/not-exists", nil)
	engine.ServeHTTP(w, req)
	if w.Body.String() != "custom 404" {
		t.Errorf("Expected 'custom 404', got '%s'", w.Body.String())
	}
}

func TestRouter_NestedGroupWithMiddleware(t *testing.T) {
	engine := gin.New()
	r := router.New(engine)

	var order []string

	r.Group("/api", func(api *router.Router) {
		api.Middleware(func(c *gin.Context) {
			order = append(order, "api")
			c.Next()
		})

		api.Group("/v1", func(v1 *router.Router) {
			v1.Middleware(func(c *gin.Context) {
				order = append(order, "v1")
				c.Next()
			})

			v1.GET("/test", func(c *gin.Context) {
				order = append(order, "handler")
				c.String(200, "ok")
			})
		})
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/v1/test", nil)
	engine.ServeHTTP(w, req)

	expected := []string{"api", "v1", "handler"}
	if len(order) != len(expected) {
		t.Errorf("Expected %d calls, got %d", len(expected), len(order))
	}
	for i, v := range expected {
		if i < len(order) && order[i] != v {
			t.Errorf("Expected order[%d]='%s', got '%s'", i, v, order[i])
		}
	}
}

func TestRouter_Routes(t *testing.T) {
	engine := gin.New()
	r := router.New(engine)

	r.GET("/users", func(c *gin.Context) {}).Name("users.index")
	r.POST("/users", func(c *gin.Context) {}).Name("users.store")

	routes := r.Routes()
	if len(routes) != 2 {
		t.Errorf("Expected 2 routes, got %d", len(routes))
	}
	if routes["users.index"] != "GET /users" {
		t.Errorf("Unexpected route: %s", routes["users.index"])
	}
}

// ============================================
// New Tests for Middleware Groups & Constraints
// ============================================

func TestRouter_MiddlewareGroup(t *testing.T) {
	engine := gin.New()
	r := router.New(engine)

	var called bool
	authMiddleware := func(c *gin.Context) {
		called = true
		c.Next()
	}

	// Register middleware group
	r.MiddlewareGroup("auth", authMiddleware)

	// Apply middleware group to a route group
	r.Group("/admin", func(admin *router.Router) {
		admin.WithMiddleware("auth")
		admin.GET("/dashboard", func(c *gin.Context) {
			c.String(200, "dashboard")
		})
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/admin/dashboard", nil)
	engine.ServeHTTP(w, req)

	if !called {
		t.Error("Middleware group was not applied")
	}
	if w.Body.String() != "dashboard" {
		t.Errorf("Expected 'dashboard', got '%s'", w.Body.String())
	}
}

func TestRouter_MiddlewareAlias(t *testing.T) {
	engine := gin.New()
	r := router.New(engine)

	var called bool
	r.AliasMiddleware("logger", func(c *gin.Context) {
		called = true
		c.Next()
	})

	r.Group("/api", func(api *router.Router) {
		api.WithMiddleware("logger")
		api.GET("/test", func(c *gin.Context) {
			c.String(200, "ok")
		})
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/test", nil)
	engine.ServeHTTP(w, req)

	if !called {
		t.Error("Middleware alias was not applied")
	}
}

func TestRoute_WhereNumber(t *testing.T) {
	engine := gin.New()
	r := router.New(engine)

	r.GET("/users/:id", func(c *gin.Context) {
		c.String(200, "user:"+c.Param("id"))
	}).WhereNumber("id")

	// Valid numeric ID
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/users/123", nil)
	engine.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Errorf("Expected 200 for numeric ID, got %d", w.Code)
	}

	// Invalid non-numeric ID
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("GET", "/users/abc", nil)
	engine.ServeHTTP(w, req)
	if w.Code != http.StatusNotFound {
		t.Errorf("Expected 404 for non-numeric ID, got %d", w.Code)
	}
}

func TestRoute_WhereUUID(t *testing.T) {
	engine := gin.New()
	r := router.New(engine)

	r.GET("/items/:uuid", func(c *gin.Context) {
		c.String(200, "item:"+c.Param("uuid"))
	}).WhereUUID("uuid")

	// Valid UUID
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/items/550e8400-e29b-41d4-a716-446655440000", nil)
	engine.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Errorf("Expected 200 for valid UUID, got %d", w.Code)
	}

	// Invalid UUID
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("GET", "/items/not-a-uuid", nil)
	engine.ServeHTTP(w, req)
	if w.Code != http.StatusNotFound {
		t.Errorf("Expected 404 for invalid UUID, got %d", w.Code)
	}
}

func TestRoute_WhereIn(t *testing.T) {
	engine := gin.New()
	r := router.New(engine)

	r.GET("/status/:status", func(c *gin.Context) {
		c.String(200, "status:"+c.Param("status"))
	}).WhereIn("status", "active", "pending", "completed")

	// Valid status
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/status/active", nil)
	engine.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Errorf("Expected 200 for valid status, got %d", w.Code)
	}

	// Invalid status
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("GET", "/status/invalid", nil)
	engine.ServeHTTP(w, req)
	if w.Code != http.StatusNotFound {
		t.Errorf("Expected 404 for invalid status, got %d", w.Code)
	}
}

func TestRoute_WhereAlpha(t *testing.T) {
	engine := gin.New()
	r := router.New(engine)

	r.GET("/categories/:slug", func(c *gin.Context) {
		c.String(200, "category:"+c.Param("slug"))
	}).WhereAlpha("slug")

	// Valid alpha
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/categories/technology", nil)
	engine.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Errorf("Expected 200 for alpha slug, got %d", w.Code)
	}

	// Invalid (contains numbers)
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("GET", "/categories/tech123", nil)
	engine.ServeHTTP(w, req)
	if w.Code != http.StatusNotFound {
		t.Errorf("Expected 404 for non-alpha slug, got %d", w.Code)
	}
}
