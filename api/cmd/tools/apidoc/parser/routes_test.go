package parser

import (
	"os"
	"path/filepath"
	"testing"
)

func TestParseModuleRoutesFileInheritsGroupAuthMiddleware(t *testing.T) {
	tempDir := t.TempDir()
	moduleDir := filepath.Join(tempDir, "category")
	if err := os.MkdirAll(moduleDir, 0755); err != nil {
		t.Fatalf("failed to create module dir: %v", err)
	}

	routesFile := filepath.Join(moduleDir, "routes.go")
	content := `package category

import "github.com/kest-labs/kest/api/internal/infra/router"

func RegisterRoutes(r *router.Router, handler *Handler) {
	r.Group("/projects/:id/categories", func(projects *router.Router) {
		projects.WithMiddleware("auth")
		projects.GET("", handler.List)
	})
}`

	if err := os.WriteFile(routesFile, []byte(content), 0644); err != nil {
		t.Fatalf("failed to write routes file: %v", err)
	}

	routes, err := parseModuleRoutesFile(routesFile, "/v1")
	if err != nil {
		t.Fatalf("parseModuleRoutesFile returned error: %v", err)
	}
	if len(routes) != 1 {
		t.Fatalf("expected 1 route, got %d", len(routes))
	}

	route := routes[0]
	if route.IsPublic {
		t.Fatal("expected route to inherit auth middleware from group")
	}
	if route.Path != "/v1/projects/:id/categories" {
		t.Fatalf("expected normalized path to be preserved, got %q", route.Path)
	}
	if len(route.Middlewares) != 1 || route.Middlewares[0] != "auth" {
		t.Fatalf("expected auth middleware, got %#v", route.Middlewares)
	}
}

func TestParseModuleRoutesFileTreatsRequireProjectRoleAsProtected(t *testing.T) {
	tempDir := t.TempDir()
	moduleDir := filepath.Join(tempDir, "member")
	if err := os.MkdirAll(moduleDir, 0755); err != nil {
		t.Fatalf("failed to create module dir: %v", err)
	}

	routesFile := filepath.Join(moduleDir, "routes.go")
	content := `package member

import "github.com/gin-gonic/gin"

func RegisterRoutes(rg *gin.RouterGroup, handler *Handler, memberService Service) {
	projects := rg.Group("/projects/:id/members")
	projects.Use(middleware.RequireProjectRole(memberService, RoleAdmin))
	projects.GET("", middleware.RequireProjectRole(memberService, RoleRead), handler.List)
	projects.POST("", handler.Create)
}`

	if err := os.WriteFile(routesFile, []byte(content), 0644); err != nil {
		t.Fatalf("failed to write routes file: %v", err)
	}

	routes, err := parseModuleRoutesFile(routesFile, "/v1")
	if err != nil {
		t.Fatalf("parseModuleRoutesFile returned error: %v", err)
	}
	if len(routes) != 2 {
		t.Fatalf("expected 2 routes, got %d", len(routes))
	}

	for _, route := range routes {
		if route.IsPublic {
			t.Fatalf("expected legacy project-role routes to be protected, got %+v", route)
		}
		if !hasMiddleware(route.Middlewares, "auth") {
			t.Fatalf("expected auth middleware marker, got %+v", route)
		}
	}
}

func TestParseModuleRoutesFileTreatsRequireWorkspaceCLITokenAsProtected(t *testing.T) {
	tempDir := t.TempDir()
	moduleDir := filepath.Join(tempDir, "project")
	if err := os.MkdirAll(moduleDir, 0755); err != nil {
		t.Fatalf("failed to create module dir: %v", err)
	}

	routesFile := filepath.Join(moduleDir, "routes.go")
	content := `package project

import "github.com/kest-labs/kest/api/internal/infra/router"

func (h *Handler) RegisterRoutes(r *router.Router) {
	r.Group("", func(cli *router.Router) {
		cli.POST("/projects/:id/cli/spec-sync", h.SyncSpecsFromCLI).
			Name("projects.cli.spec_sync").
			Middleware(middleware.RequireWorkspaceCLIToken(h.workspaceTokenValidator, workspace.CLITokenScopeCollectionRead))
	})
}`

	if err := os.WriteFile(routesFile, []byte(content), 0644); err != nil {
		t.Fatalf("failed to write routes file: %v", err)
	}

	routes, err := parseModuleRoutesFile(routesFile, "/v1")
	if err != nil {
		t.Fatalf("parseModuleRoutesFile returned error: %v", err)
	}
	if len(routes) != 1 {
		t.Fatalf("expected 1 route, got %d", len(routes))
	}

	if routes[0].IsPublic {
		t.Fatalf("expected workspace CLI token route to be protected, got %+v", routes[0])
	}
	if !hasMiddleware(routes[0].Middlewares, "auth") {
		t.Fatalf("expected auth middleware marker, got %+v", routes[0])
	}
}
