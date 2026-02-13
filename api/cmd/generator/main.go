package main

import (
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"text/template"
)

var (
	modelName   = flag.String("model", "", "Model name (required)")
	tableName   = flag.String("table", "", "Database table name (optional, defaults to lowercase plural of model name)")
	packageName = flag.String("package", "", "Package name (optional, defaults to lowercase of model name)")
	outputDir   = flag.String("output", "internal", "Output directory (optional, defaults to internal)")
	force       = flag.Bool("force", false, "Whether to force overwrite existing files")
)

// TemplateData represents the data structure for templates
type TemplateData struct {
	ModelName    string
	TableName    string
	PackageName  string
	StructFields []Field
}

// Field represents field information
type Field struct {
	Name       string
	Type       string
	Tag        string
	Comment    string
	IsRequired bool
}

func main() {
	flag.Parse()

	if *modelName == "" {
		fmt.Println("Error: Model name must be specified (use -model parameter)")
		flag.Usage()
		os.Exit(1)
	}

	// Set default values
	if *tableName == "" {
		*tableName = toSnakeCase(*modelName) + "s"
	}
	if *packageName == "" {
		*packageName = strings.ToLower(*modelName)
	}

	// Create template data
	data := &TemplateData{
		ModelName:   *modelName,
		TableName:   *tableName,
		PackageName: *packageName,
		StructFields: []Field{
			{Name: "ID", Type: "uint", Tag: "gorm:\"primarykey\"", Comment: "Primary Key ID", IsRequired: true},
			{Name: "CreatedAt", Type: "time.Time", Tag: "gorm:\"autoCreateTime\"", Comment: "Creation Time", IsRequired: true},
			{Name: "UpdatedAt", Type: "time.Time", Tag: "gorm:\"autoUpdateTime\"", Comment: "Update Time", IsRequired: true},
		},
	}

	// Generate files
	files := map[string]string{
		"model":      "model.go",
		"service":    "service.go",
		"handler":    "handler.go",
		"repository": "repository.go",
	}

	for fileType, filename := range files {
		if err := generateFile(fileType, filename, data); err != nil {
			fmt.Printf("Failed to generate %s file: %v\n", filename, err)
			os.Exit(1)
		}
	}

	fmt.Println("Code generation completed!")
}

// generateFile generates a single file
func generateFile(fileType, filename string, data *TemplateData) error {
	// Create directory
	dir := filepath.Join(*outputDir, data.PackageName)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("failed to create directory: %v", err)
	}

	// Check if file exists
	filePath := filepath.Join(dir, filename)
	if _, err := os.Stat(filePath); err == nil && !*force {
		return fmt.Errorf("file %s already exists, use -force parameter to overwrite", filePath)
	}

	// Create file
	file, err := os.Create(filePath)
	if err != nil {
		return fmt.Errorf("failed to create file: %v", err)
	}
	defer file.Close()

	// Get template
	tmpl, err := getTemplate(fileType)
	if err != nil {
		return err
	}

	// Execute template
	if err := tmpl.Execute(file, data); err != nil {
		return fmt.Errorf("failed to execute template: %v", err)
	}

	fmt.Printf("Generated file: %s\n", filePath)
	return nil
}

// getTemplate returns the template by file type
func getTemplate(fileType string) (*template.Template, error) {
	var tmplStr string
	switch fileType {
	case "model":
		tmplStr = modelTemplate
	case "service":
		tmplStr = serviceTemplate
	case "handler":
		tmplStr = handlerTemplate
	case "repository":
		tmplStr = repositoryTemplate
	default:
		return nil, fmt.Errorf("unknown file type: %s", fileType)
	}

	return template.New(fileType).Parse(tmplStr)
}

// toSnakeCase converts a string to snake_case
func toSnakeCase(s string) string {
	var result strings.Builder
	for i, r := range s {
		if i > 0 && r >= 'A' && r <= 'Z' {
			result.WriteRune('_')
		}
		result.WriteRune(r)
	}
	return strings.ToLower(result.String())
}

// Template definitions
const modelTemplate = `package {{.PackageName}}

import (
	"time"
	"gorm.io/gorm"
)

// {{.ModelName}} model
type {{.ModelName}} struct {
	{{range .StructFields}}
	{{.Name}} {{.Type}} {{.Tag}} {{.Comment}}
	{{end}}
}

// TableName specifies the table name
func ({{.ModelName}}) TableName() string {
	return "{{.TableName}}"
}
`

const serviceTemplate = `package {{.PackageName}}

import (
	"context"
	"github.com/kest-labs/kest/api/pkg/logger"
)

// {{.ModelName}}Service defines the {{.ModelName}} service interface
type {{.ModelName}}Service interface {
	Create(ctx context.Context, model *{{.ModelName}}) error
	Update(ctx context.Context, model *{{.ModelName}}) error
	Delete(ctx context.Context, id uint) error
	Get(ctx context.Context, id uint) (*{{.ModelName}}, error)
	List(ctx context.Context, page, pageSize int) ([]*{{.ModelName}}, int64, error)
}

// {{.ModelName}}ServiceImpl implements the {{.ModelName}} service
type {{.ModelName}}ServiceImpl struct {
	repo {{.ModelName}}Repository
}

// New{{.ModelName}}Service creates a new {{.ModelName}} service
func New{{.ModelName}}Service(repo {{.ModelName}}Repository) {{.ModelName}}Service {
	return &{{.ModelName}}ServiceImpl{repo: repo}
}

// Create creates a new {{.ModelName}}
func (s *{{.ModelName}}ServiceImpl) Create(ctx context.Context, model *{{.ModelName}}) error {
	return s.repo.Create(ctx, model)
}

// Update updates an existing {{.ModelName}}
func (s *{{.ModelName}}ServiceImpl) Update(ctx context.Context, model *{{.ModelName}}) error {
	return s.repo.Update(ctx, model)
}

// Delete deletes a {{.ModelName}}
func (s *{{.ModelName}}ServiceImpl) Delete(ctx context.Context, id uint) error {
	return s.repo.Delete(ctx, id)
}

// Get retrieves a {{.ModelName}}
func (s *{{.ModelName}}ServiceImpl) Get(ctx context.Context, id uint) (*{{.ModelName}}, error) {
	return s.repo.Get(ctx, id)
}

// List retrieves a list of {{.ModelName}}
func (s *{{.ModelName}}ServiceImpl) List(ctx context.Context, page, pageSize int) ([]*{{.ModelName}}, int64, error) {
	return s.repo.List(ctx, page, pageSize)
}
`

const handlerTemplate = `package {{.PackageName}}

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/kest-labs/kest/api/pkg/logger"
	"github.com/kest-labs/kest/api/pkg/response"
)

// {{.ModelName}}Handler handles {{.ModelName}} requests
type {{.ModelName}}Handler struct {
	service {{.ModelName}}Service
}

// New{{.ModelName}}Handler creates a new {{.ModelName}} handler
func New{{.ModelName}}Handler(service {{.ModelName}}Service) *{{.ModelName}}Handler {
	return &{{.ModelName}}Handler{service: service}
}

// Create handles the creation of a {{.ModelName}}
func (h *{{.ModelName}}Handler) Create(c *gin.Context) {
	var model {{.ModelName}}
	if err := c.ShouldBindJSON(&model); err != nil {
		response.Error(c, http.StatusBadRequest, "Invalid request data")
		return
	}

	if err := h.service.Create(c.Request.Context(), &model); err != nil {
		logger.Error("Failed to create {{.ModelName}}", "error", err)
		response.Error(c, http.StatusInternalServerError, "Failed to create")
		return
	}

	response.Success(c, model)
}

// Update handles the update of a {{.ModelName}}
func (h *{{.ModelName}}Handler) Update(c *gin.Context) {
	var model {{.ModelName}}
	if err := c.ShouldBindJSON(&model); err != nil {
		response.Error(c, http.StatusBadRequest, "Invalid request data")
		return
	}

	if err := h.service.Update(c.Request.Context(), &model); err != nil {
		logger.Error("Failed to update {{.ModelName}}", "error", err)
		response.Error(c, http.StatusInternalServerError, "Failed to update")
		return
	}

	response.Success(c, model)
}

// Delete handles the deletion of a {{.ModelName}}
func (h *{{.ModelName}}Handler) Delete(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "Invalid ID")
		return
	}

	if err := h.service.Delete(c.Request.Context(), uint(id)); err != nil {
		logger.Error("Failed to delete {{.ModelName}}", "error", err)
		response.Error(c, http.StatusInternalServerError, "Failed to delete")
		return
	}

	response.Success(c, nil)
}

// Get handles the retrieval of a {{.ModelName}}
func (h *{{.ModelName}}Handler) Get(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "Invalid ID")
		return
	}

	model, err := h.service.Get(c.Request.Context(), uint(id))
	if err != nil {
		logger.Error("Failed to get {{.ModelName}}", "error", err)
		response.Error(c, http.StatusInternalServerError, "Failed to get")
		return
	}

	response.Success(c, model)
}

// List handles the retrieval of a list of {{.ModelName}}
func (h *{{.ModelName}}Handler) List(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "10"))

	models, total, err := h.service.List(c.Request.Context(), page, pageSize)
	if err != nil {
		logger.Error("Failed to list {{.ModelName}}", "error", err)
		response.Error(c, http.StatusInternalServerError, "Failed to list")
		return
	}

	response.Success(c, gin.H{
		"items": models,
		"total": total,
	})
}
`

const repositoryTemplate = `package {{.PackageName}}

import (
	"context"
	"gorm.io/gorm"
	"github.com/kest-labs/kest/api/internal/infra/database"
)

// {{.ModelName}}Repository defines the {{.ModelName}} repository interface
type {{.ModelName}}Repository interface {
	Create(ctx context.Context, model *{{.ModelName}}) error
	Update(ctx context.Context, model *{{.ModelName}}) error
	Delete(ctx context.Context, id uint) error
	Get(ctx context.Context, id uint) (*{{.ModelName}}, error)
	List(ctx context.Context, page, pageSize int) ([]*{{.ModelName}}, int64, error)
}

// {{.ModelName}}RepositoryImpl implements the {{.ModelName}} repository
type {{.ModelName}}RepositoryImpl struct {
	db *gorm.DB
}

// New{{.ModelName}}Repository creates a new {{.ModelName}} repository
func New{{.ModelName}}Repository() {{.ModelName}}Repository {
	return &{{.ModelName}}RepositoryImpl{
		db: database.GetDB(),
	}
}

// Create creates a new {{.ModelName}}
func (r *{{.ModelName}}RepositoryImpl) Create(ctx context.Context, model *{{.ModelName}}) error {
	return r.db.WithContext(ctx).Create(model).Error
}

// Update updates an existing {{.ModelName}}
func (r *{{.ModelName}}RepositoryImpl) Update(ctx context.Context, model *{{.ModelName}}) error {
	return r.db.WithContext(ctx).Save(model).Error
}

// Delete deletes a {{.ModelName}}
func (r *{{.ModelName}}RepositoryImpl) Delete(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).Delete(&{{.ModelName}}{}, id).Error
}

// Get retrieves a {{.ModelName}}
func (r *{{.ModelName}}RepositoryImpl) Get(ctx context.Context, id uint) (*{{.ModelName}}, error) {
	var model {{.ModelName}}
	err := r.db.WithContext(ctx).First(&model, id).Error
	if err != nil {
		return nil, err
	}
	return &model, nil
}

// List retrieves a list of {{.ModelName}}
func (r *{{.ModelName}}RepositoryImpl) List(ctx context.Context, page, pageSize int) ([]*{{.ModelName}}, int64, error) {
	var models []*{{.ModelName}}
	var total int64

	offset := (page - 1) * pageSize
	err := r.db.WithContext(ctx).Model(&{{.ModelName}}{}).Count(&total).Error
	if err != nil {
		return nil, 0, err
	}

	err = r.db.WithContext(ctx).Offset(offset).Limit(pageSize).Find(&models).Error
	if err != nil {
		return nil, 0, err
	}

	return models, total, nil
}
`
