package commands

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"text/template"
	"time"

	"github.com/kest-labs/kest/api/internal/infra/console"
	"github.com/kest-labs/kest/api/internal/infra/migration"
)

// MakeModelCommand creates a new model
type MakeModelCommand struct {
	output *console.Output
}

func NewMakeModelCommand() *MakeModelCommand {
	return &MakeModelCommand{output: console.NewOutput()}
}

func (c *MakeModelCommand) Name() string        { return "make:model" }
func (c *MakeModelCommand) Description() string { return "Create a new model" }
func (c *MakeModelCommand) Usage() string       { return "make:model <name>" }

func (c *MakeModelCommand) Run(args []string) error {
	if len(args) < 1 {
		return fmt.Errorf("model name is required")
	}

	name := args[0]
	snake := toSnakeCase(name)
	pascal := toPascalCase(name)

	// Create directory
	dir := filepath.Join("app", snake)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}

	// Generate model file
	if err := generateFile(filepath.Join(dir, "model.go"), modelTemplate, map[string]string{
		"Package":   snake,
		"ModelName": pascal,
		"TableName": snake + "s",
	}); err != nil {
		return err
	}

	c.output.Success("Model created: %s", filepath.Join(dir, "model.go"))
	return nil
}

// MakeServiceCommand creates a new service
type MakeServiceCommand struct {
	output *console.Output
}

func NewMakeServiceCommand() *MakeServiceCommand {
	return &MakeServiceCommand{output: console.NewOutput()}
}

func (c *MakeServiceCommand) Name() string        { return "make:service" }
func (c *MakeServiceCommand) Description() string { return "Create a new service" }
func (c *MakeServiceCommand) Usage() string       { return "make:service <name>" }

func (c *MakeServiceCommand) Run(args []string) error {
	if len(args) < 1 {
		return fmt.Errorf("service name is required")
	}

	name := args[0]
	snake := toSnakeCase(name)
	pascal := toPascalCase(name)

	dir := filepath.Join("app", snake)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}

	if err := generateFile(filepath.Join(dir, "service.go"), serviceTemplate, map[string]string{
		"Package":     snake,
		"ServiceName": pascal,
	}); err != nil {
		return err
	}

	c.output.Success("Service created: %s", filepath.Join(dir, "service.go"))
	return nil
}

// MakeHandlerCommand creates a new handler
type MakeHandlerCommand struct {
	output *console.Output
}

func NewMakeHandlerCommand() *MakeHandlerCommand {
	return &MakeHandlerCommand{output: console.NewOutput()}
}

func (c *MakeHandlerCommand) Name() string        { return "make:handler" }
func (c *MakeHandlerCommand) Description() string { return "Create a new HTTP handler" }
func (c *MakeHandlerCommand) Usage() string       { return "make:handler <name>" }

func (c *MakeHandlerCommand) Run(args []string) error {
	if len(args) < 1 {
		return fmt.Errorf("handler name is required")
	}

	name := args[0]
	snake := toSnakeCase(name)
	pascal := toPascalCase(name)

	dir := filepath.Join("app", snake)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}

	if err := generateFile(filepath.Join(dir, "handler.go"), handlerTemplate, map[string]string{
		"Package":     snake,
		"HandlerName": pascal,
	}); err != nil {
		return err
	}

	c.output.Success("Handler created: %s", filepath.Join(dir, "handler.go"))
	return nil
}

// MakeRepositoryCommand creates a new repository
type MakeRepositoryCommand struct {
	output *console.Output
}

func NewMakeRepositoryCommand() *MakeRepositoryCommand {
	return &MakeRepositoryCommand{output: console.NewOutput()}
}

func (c *MakeRepositoryCommand) Name() string        { return "make:repository" }
func (c *MakeRepositoryCommand) Description() string { return "Create a new repository" }
func (c *MakeRepositoryCommand) Usage() string       { return "make:repository <name>" }

func (c *MakeRepositoryCommand) Run(args []string) error {
	if len(args) < 1 {
		return fmt.Errorf("repository name is required")
	}

	name := args[0]
	snake := toSnakeCase(name)
	pascal := toPascalCase(name)

	dir := filepath.Join("app", snake)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}

	if err := generateFile(filepath.Join(dir, "repository.go"), repositoryTemplate, map[string]string{
		"Package":        snake,
		"RepositoryName": pascal,
	}); err != nil {
		return err
	}

	c.output.Success("Repository created: %s", filepath.Join(dir, "repository.go"))
	return nil
}

// MakeSeederCommand creates a new seeder
type MakeSeederCommand struct {
	output *console.Output
}

func NewMakeSeederCommand() *MakeSeederCommand {
	return &MakeSeederCommand{output: console.NewOutput()}
}

func (c *MakeSeederCommand) Name() string        { return "make:seeder" }
func (c *MakeSeederCommand) Description() string { return "Create a new database seeder" }
func (c *MakeSeederCommand) Usage() string       { return "make:seeder <name>" }

func (c *MakeSeederCommand) Run(args []string) error {
	if len(args) < 1 {
		return fmt.Errorf("seeder name is required")
	}

	name := args[0]
	pascal := toPascalCase(name)
	snake := toSnakeCase(name)

	dir := filepath.Join("database", "seeders")
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}

	filename := filepath.Join(dir, snake+"_seeder.go")
	if err := generateFile(filename, seederTemplate, map[string]string{
		"SeederName": pascal,
	}); err != nil {
		return err
	}

	c.output.Success("Seeder created: %s", filename)
	c.output.Info("Run with: ./zgo db:seed")
	return nil
}

// MakeMigrationCommand creates a new migration using the migration Creator.
type MakeMigrationCommand struct {
	output *console.Output
}

// NewMakeMigrationCommand creates a new MakeMigrationCommand instance.
func NewMakeMigrationCommand() *MakeMigrationCommand {
	return &MakeMigrationCommand{output: console.NewOutput()}
}

func (c *MakeMigrationCommand) Name() string        { return "make:migration" }
func (c *MakeMigrationCommand) Description() string { return "Create a new database migration" }
func (c *MakeMigrationCommand) Usage() string {
	return "make:migration <name> [--create=table] [--table=table]"
}

func (c *MakeMigrationCommand) Run(args []string) error {
	if len(args) < 1 {
		return fmt.Errorf("migration name is required")
	}

	// Parse migration name (first non-flag argument)
	var name string
	var createTable string
	var modifyTable string

	for i, arg := range args {
		// Parse --create=table flag
		if val, found := strings.CutPrefix(arg, "--create="); found {
			createTable = val
			continue
		}
		if arg == "--create" && i+1 < len(args) && !strings.HasPrefix(args[i+1], "--") {
			createTable = args[i+1]
			continue
		}

		// Parse --table=table flag
		if val, found := strings.CutPrefix(arg, "--table="); found {
			modifyTable = val
			continue
		}
		if arg == "--table" && i+1 < len(args) && !strings.HasPrefix(args[i+1], "--") {
			modifyTable = args[i+1]
			continue
		}

		// First non-flag argument is the migration name
		if !strings.HasPrefix(arg, "--") && name == "" {
			name = arg
		}
	}

	if name == "" {
		return fmt.Errorf("migration name is required")
	}

	// Use the migration Creator
	creator := migration.NewCreator("database/migrations")

	opts := migration.CreatorOptions{
		Create: createTable,
		Table:  modifyTable,
	}

	result, err := creator.Create(name, opts)
	if err != nil {
		return err
	}

	c.output.Success("Migration created: %s", result.Path)
	c.output.Info("Migration ID: %s", result.Name)

	// Show helpful hints based on migration type
	if createTable != "" {
		c.output.Info("Table: %s (create)", createTable)
	} else if modifyTable != "" {
		c.output.Info("Table: %s (modify)", modifyTable)
	}

	return nil
}

// legacyMakeMigrationCommand is kept for backward compatibility reference.
// It uses the old gormigrate-style template.
func legacyMakeMigrationCommand(args []string, output *console.Output) error {
	if len(args) < 1 {
		return fmt.Errorf("migration name is required")
	}

	name := args[0]

	// Generate timestamp: YYYY_MM_DD_HHMMSS
	timestamp := time.Now().Format("2006_01_02_150405")

	// Create filename with timestamp
	filename := fmt.Sprintf("%s_%s.go", timestamp, name)
	dir := filepath.Join("database", "migrations")

	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}

	filePath := filepath.Join(dir, filename)

	// Check if file already exists
	if _, err := os.Stat(filePath); err == nil {
		return fmt.Errorf("migration file already exists: %s", filePath)
	}

	// Migration ID
	migrationID := fmt.Sprintf("%s_%s", timestamp, name)

	if err := generateFile(filePath, legacyMigrationTemplate, map[string]string{
		"MigrationID": migrationID,
	}); err != nil {
		return err
	}

	output.Success("Migration created: %s", filePath)
	output.Info("Migration ID: %s", migrationID)
	return nil
}

// MakeModuleCommand creates a complete module with all components
type MakeModuleCommand struct {
	output *console.Output
}

func NewMakeModuleCommand() *MakeModuleCommand {
	return &MakeModuleCommand{output: console.NewOutput()}
}

func (c *MakeModuleCommand) Name() string { return "make:module" }
func (c *MakeModuleCommand) Description() string {
	return "Create a complete module (model, service, handler, repository)"
}
func (c *MakeModuleCommand) Usage() string { return "make:module <name>" }

func (c *MakeModuleCommand) Run(args []string) error {
	if len(args) < 1 {
		return fmt.Errorf("module name is required")
	}

	name := args[0]
	snake := toSnakeCase(name)
	pascal := toPascalCase(name)

	// Target directory: internal/modules/[name]
	dir := filepath.Join("internal", "modules", snake)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}

	files := []struct {
		name     string
		template string
	}{
		{"model.go", modelTemplate},
		{"service.go", serviceTemplate},
		{"handler.go", handlerTemplate},
		{"repository.go", repositoryTemplate},
		{"dto.go", dtoTemplate},
		{"routes.go", routesTemplate},
		{"service_test.go", serviceTestTemplate},
		{"provider.go", providerTemplate},
	}

	data := map[string]string{
		"Package":        snake,
		"ModelName":      pascal,
		"ServiceName":    pascal,
		"HandlerName":    pascal,
		"RepositoryName": pascal,
		"TableName":      snake + "s",
		"ModulePath":     "github.com/kest-labs/kest/api/internal/modules/" + snake,
		"PlatformPath":   "github.com/kest-labs/kest/api/internal/infra",
	}

	for _, f := range files {
		path := filepath.Join(dir, f.name)
		if err := generateFile(path, f.template, data); err != nil {
			return err
		}
		c.output.Success("Created: %s", path)
	}

	// Auto-inject route
	if err := injectRoute(snake); err != nil {
		c.output.Warning("Failed to inject route: %v", err)
		c.output.Info("Please manually register routes in routes/api.go")
	} else {
		c.output.Success("Route injected into routes/api.go")
	}

	// Auto-inject provider
	if err := injectProvider(snake); err != nil {
		c.output.Warning("Failed to inject provider: %v", err)
		c.output.Info("Please manually register provider in internal/modules/wire.go")
	} else {
		c.output.Success("Provider injected into internal/modules/wire.go")
	}

	c.output.Info("Module '%s' created successfully!", name)
	return nil
}

func injectProvider(moduleName string) error {
	path := "internal/modules/wire.go"
	content, err := os.ReadFile(path)
	if err != nil {
		return err
	}

	code := string(content)

	// 1. Add Import
	importPath := fmt.Sprintf("\"github.com/kest-labs/kest/api/internal/modules/%s\"", moduleName)
	if !strings.Contains(code, importPath) {
		importBlock := "import (\n"
		if idx := strings.Index(code, importBlock); idx != -1 {
			insertion := idx + len(importBlock)
			code = code[:insertion] + "\t" + importPath + "\n" + code[insertion:]
		}
	}

	// 2. Add Provider to wire.Build
	providerEntry := fmt.Sprintf("\t\t%s.ProviderSet,\n", moduleName)
	if !strings.Contains(code, providerEntry) {
		anchor := "wire.Build(\n"
		if idx := strings.Index(code, anchor); idx != -1 {
			insertion := idx + len(anchor)
			code = code[:insertion] + providerEntry + code[insertion:]
		}
	}

	// 3. Add Handler to App struct
	handlerName := toPascalCase(moduleName)
	handlerField := fmt.Sprintf("\t%s *%s.Handler\n", handlerName, moduleName)
	if !strings.Contains(code, handlerField) {
		anchor := "type App struct {\n"
		if idx := strings.Index(code, anchor); idx != -1 {
			insertion := idx + len(anchor)
			code = code[:insertion] + handlerField + code[insertion:]
		}
	}

	return os.WriteFile(path, []byte(code), 0644)
}

func injectRoute(moduleName string) error {
	path := "routes/api.go"
	content, err := os.ReadFile(path)
	if err != nil {
		return err
	}

	code := string(content)

	// 1. Add Import
	importPath := fmt.Sprintf("\"github.com/kest-labs/kest/api/internal/modules/%s\"", moduleName)
	if !strings.Contains(code, importPath) {
		importBlock := "import (\n"
		if idx := strings.Index(code, importBlock); idx != -1 {
			insertion := idx + len(importBlock)
			code = code[:insertion] + "\t" + importPath + "\n" + code[insertion:]
		}
	}

	// 2. Add Register Call
	registerCall := fmt.Sprintf("\t%s.Register(r)\n", moduleName)
	if !strings.Contains(code, registerCall) {
		funcSig := "func RegisterAPI(r *router.Router) {\n"
		if idx := strings.Index(code, funcSig); idx != -1 {
			insertion := idx + len(funcSig)
			code = code[:insertion] + registerCall + code[insertion:]
		}
	}

	return os.WriteFile(path, []byte(code), 0644)
}

// Helper functions
func generateFile(path, tmpl string, data map[string]string) error {
	if _, err := os.Stat(path); err == nil {
		return fmt.Errorf("file already exists: %s", path)
	}

	t, err := template.New("").Parse(tmpl)
	if err != nil {
		return err
	}

	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()

	return t.Execute(f, data)
}

func toSnakeCase(s string) string {
	var result strings.Builder
	for i, r := range s {
		if i > 0 && r >= 'A' && r <= 'Z' {
			result.WriteByte('_')
		}
		result.WriteRune(r)
	}
	return strings.ToLower(result.String())
}

func toPascalCase(s string) string {
	parts := strings.Split(strings.ReplaceAll(s, "-", "_"), "_")
	for i, p := range parts {
		if len(p) > 0 {
			parts[i] = strings.ToUpper(string(p[0])) + strings.ToLower(p[1:])
		}
	}
	return strings.Join(parts, "")
}

// Templates
const modelTemplate = `package {{.Package}}

import (
	"time"

	"gorm.io/gorm"
)

// {{.ModelName}} represents the {{.ModelName}} model
type {{.ModelName}} struct {
	ID        uint           ` + "`json:\"id\" gorm:\"primaryKey\"`" + `
	CreatedAt time.Time      ` + "`json:\"created_at\"`" + `
	UpdatedAt time.Time      ` + "`json:\"updated_at\"`" + `
	DeletedAt gorm.DeletedAt ` + "`json:\"deleted_at,omitempty\" gorm:\"index\"`" + `
}

// TableName returns the table name for the model
func ({{.ModelName}}) TableName() string {
	return "{{.TableName}}"
}
`

const serviceTemplate = `package {{.Package}}

import (
	"context"
)

// Service defines the service interface
type Service interface {
	Create(ctx context.Context, model *{{.ModelName}}) error
	Update(ctx context.Context, model *{{.ModelName}}) error
	Delete(ctx context.Context, id uint) error
	Get(ctx context.Context, id uint) (*{{.ModelName}}, error)
	List(ctx context.Context, page, pageSize int) ([]*{{.ModelName}}, int64, error)
}

// service implements Service
type service struct {
	repo Repository
}

// NewService creates a new service
func NewService(repo Repository) Service {
	return &service{repo: repo}
}

// Create creates a new {{.ModelName}}
func (s *service) Create(ctx context.Context, model *{{.ModelName}}) error {
	return s.repo.Create(ctx, model)
}

// Update updates an existing {{.ModelName}}
func (s *service) Update(ctx context.Context, model *{{.ModelName}}) error {
	return s.repo.Update(ctx, model)
}

// Delete deletes a {{.ModelName}} by ID
func (s *service) Delete(ctx context.Context, id uint) error {
	return s.repo.Delete(ctx, id)
}

// Get retrieves a {{.ModelName}} by ID
func (s *service) Get(ctx context.Context, id uint) (*{{.ModelName}}, error) {
	return s.repo.FindByID(ctx, id)
}

// List retrieves a paginated list of {{.ModelName}}
func (s *service) List(ctx context.Context, page, pageSize int) ([]*{{.ModelName}}, int64, error) {
	return s.repo.FindAll(ctx, page, pageSize)
}
`

const handlerTemplate = `package {{.Package}}

import (
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/kest-labs/kest/api/pkg/response"
)

// Handler handles HTTP requests for {{.ModelName}}
type Handler struct {
	service Service
}

// NewHandler creates a new handler
func NewHandler(service Service) *Handler {
	return &Handler{service: service}
}

// List handles GET requests to list all items
func (h *Handler) List(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "10"))

	items, total, err := h.service.List(c.Request.Context(), page, pageSize)
	if err != nil {
		response.InternalServerError(c, "Failed to list items", err)
		return
	}

	response.Success(c, gin.H{
		"items": items,
		"total": total,
		"page":  page,
	})
}

// Get handles GET requests to retrieve a single item
func (h *Handler) Get(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid ID", err)
		return
	}

	item, err := h.service.Get(c.Request.Context(), uint(id))
	if err != nil {
		response.NotFound(c, "Item not found", err)
		return
	}

	response.Success(c, item)
}

// Create handles POST requests to create a new item
func (h *Handler) Create(c *gin.Context) {
	var req Create{{.ModelName}}Request
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request", err)
		return
	}

	model := &{{.ModelName}}{
		// Map fields here
	}

	if err := h.service.Create(c.Request.Context(), model); err != nil {
		response.InternalServerError(c, "Failed to create item", err)
		return
	}

	response.Created(c, model)
}

// Update handles PUT requests to update an item
func (h *Handler) Update(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid ID", err)
		return
	}

	var req Update{{.ModelName}}Request
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request", err)
		return
	}

	model, err := h.service.Get(c.Request.Context(), uint(id))
	if err != nil {
		response.NotFound(c, "Item not found", err)
		return
	}

	// Map updates
	// model.Name = req.Name

	if err := h.service.Update(c.Request.Context(), model); err != nil {
		response.InternalServerError(c, "Failed to update item", err)
		return
	}

	response.Success(c, model)
}

// Delete handles DELETE requests to remove an item
func (h *Handler) Delete(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid ID", err)
		return
	}

	if err := h.service.Delete(c.Request.Context(), uint(id)); err != nil {
		response.InternalServerError(c, "Failed to delete item", err)
		return
	}

	response.NoContent(c)
}
`

const repositoryTemplate = `package {{.Package}}

import (
	"context"

	"gorm.io/gorm"
)

// Repository defines the repository interface
type Repository interface {
	Create(ctx context.Context, model *{{.ModelName}}) error
	Update(ctx context.Context, model *{{.ModelName}}) error
	Delete(ctx context.Context, id uint) error
	FindByID(ctx context.Context, id uint) (*{{.ModelName}}, error)
	FindAll(ctx context.Context, page, pageSize int) ([]*{{.ModelName}}, int64, error)
}

// repository implements Repository
type repository struct {
	db *gorm.DB
}

// NewRepository creates a new repository
func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

// Create inserts a new record
func (r *repository) Create(ctx context.Context, model *{{.ModelName}}) error {
	return r.db.WithContext(ctx).Create(model).Error
}

// Update updates an existing record
func (r *repository) Update(ctx context.Context, model *{{.ModelName}}) error {
	return r.db.WithContext(ctx).Save(model).Error
}

// Delete soft deletes a record
func (r *repository) Delete(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).Delete(&{{.ModelName}}{}, id).Error
}

// FindByID finds a record by ID
func (r *repository) FindByID(ctx context.Context, id uint) (*{{.ModelName}}, error) {
	var model {{.ModelName}}
	if err := r.db.WithContext(ctx).First(&model, id).Error; err != nil {
		return nil, err
	}
	return &model, nil
}

// FindAll retrieves all records with pagination
func (r *repository) FindAll(ctx context.Context, page, pageSize int) ([]*{{.ModelName}}, int64, error) {
	var models []*{{.ModelName}}
	var total int64

	offset := (page - 1) * pageSize

	if err := r.db.WithContext(ctx).Model(&{{.ModelName}}{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	if err := r.db.WithContext(ctx).Offset(offset).Limit(pageSize).Find(&models).Error; err != nil {
		return nil, 0, err
	}

	return models, total, nil
}
`

const dtoTemplate = `package {{.Package}}

// Create{{.ModelName}}Request represents the request to create a {{.ModelName}}
type Create{{.ModelName}}Request struct {
	// Add your fields here
}

// Update{{.ModelName}}Request represents the request to update a {{.ModelName}}
type Update{{.ModelName}}Request struct {
	// Add your fields here
}

// {{.ModelName}}Response represents the response for a {{.ModelName}}
type {{.ModelName}}Response struct {
	ID uint ` + "`json:\"id\"`" + `
	// Add your fields here
}
`

const seederTemplate = `package seeders

import (
	"gorm.io/gorm"
)

type {{.SeederName}}Seeder struct{}

func (s *{{.SeederName}}Seeder) Run(db *gorm.DB) error {
	// TODO: Implement seeder logic
	// Example:
	// items := []YourModel{
	//     {Field: "value"},
	// }
	// for _, item := range items {
	//     db.FirstOrCreate(&item, YourModel{Field: item.Field})
	// }

	return nil
}

func init() {
	register(&{{.SeederName}}Seeder{})
}
`

// legacyMigrationTemplate is the old gormigrate-style template.
// Kept for backward compatibility reference.
const legacyMigrationTemplate = `package migrations

import (
	"github.com/go-gormigrate/gormigrate/v2"
	"gorm.io/gorm"
)

func init() {
	register(&gormigrate.Migration{
		ID: "{{.MigrationID}}",
		Migrate: func(db *gorm.DB) error {
			// TODO: Implement migration logic
			// Example: return db.AutoMigrate(&YourModel{})
			return nil
		},
		Rollback: func(db *gorm.DB) error {
			// TODO: Implement rollback logic
			// Example: return db.Migrator().DropTable("your_table")
			return nil
		},
	})
}
`

const routesTemplate = `package {{.Package}}

import (
	"github.com/kest-labs/kest/api/internal/infra/router"
)

// Register registers routes for this module.
// Note: Handler should be injected via Wire DI, not created here.
// This function is for reference - actual route registration should use
// the handler from app.Handlers in routes/api.go
func Register(r *router.Router, handler *Handler) {
	r.Group("/{{.Package}}s", func(g *router.Router) {
		g.GET("", handler.List).Name("{{.Package}}.index")
		g.POST("", handler.Create).Name("{{.Package}}.store")
		g.GET("/:id", handler.Get).Name("{{.Package}}.show")
		g.PUT("/:id", handler.Update).Name("{{.Package}}.update")
		g.DELETE("/:id", handler.Delete).Name("{{.Package}}.destroy")
	})
}
`

const serviceTestTemplate = `package {{.Package}}

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// Mock{{.RepositoryName}}Repository is a mock implementation
type Mock{{.RepositoryName}}Repository struct {
	mock.Mock
}

func (m *Mock{{.RepositoryName}}Repository) Create(ctx context.Context, model *{{.ModelName}}) error {
	args := m.Called(ctx, model)
	return args.Error(0)
}

func (m *Mock{{.RepositoryName}}Repository) Update(ctx context.Context, model *{{.ModelName}}) error {
	args := m.Called(ctx, model)
	return args.Error(0)
}

func (m *Mock{{.RepositoryName}}Repository) Delete(ctx context.Context, id uint) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *Mock{{.RepositoryName}}Repository) FindByID(ctx context.Context, id uint) (*{{.ModelName}}, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*{{.ModelName}}), args.Error(1)
}

func (m *Mock{{.RepositoryName}}Repository) FindAll(ctx context.Context, page, pageSize int) ([]*{{.ModelName}}, int64, error) {
	args := m.Called(ctx, page, pageSize)
	return args.Get(0).([]*{{.ModelName}}), args.Get(1).(int64), args.Error(2)
}

func Test{{.ServiceName}}Service_Get(t *testing.T) {
	mockRepo := new(MockRepository)
	service := NewService(mockRepo)
	ctx := context.Background()

	expected := &{{.ModelName}}{ID: 1}
	mockRepo.On("FindByID", ctx, uint(1)).Return(expected, nil)

	result, err := service.Get(ctx, 1)

	assert.NoError(t, err)
	assert.Equal(t, expected.ID, result.ID)
	mockRepo.AssertExpectations(t)
}
`

const providerTemplate = `package {{.Package}}

import (
	"github.com/google/wire"
)

// ProviderSet is the provider set for this module
var ProviderSet = wire.NewSet(
	NewRepository,
	NewService,
	wire.Bind(new(Service), new(*service)),
	NewHandler,
)
`
