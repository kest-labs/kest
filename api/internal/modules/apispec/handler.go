package apispec

import (
	"errors"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/kest-labs/kest/api/internal/contracts"
	"github.com/kest-labs/kest/api/internal/infra/router"
	"github.com/kest-labs/kest/api/internal/modules/member"
	"github.com/kest-labs/kest/api/pkg/response"
)

// Handler handles API specification HTTP requests
type Handler struct {
	contracts.BaseModule
	service       Service
	memberService member.Service
}

// NewHandler creates a new API spec handler
func NewHandler(service Service, memberService member.Service) *Handler {
	return &Handler{
		service:       service,
		memberService: memberService,
	}
}

// Name returns the module name
func (h *Handler) Name() string {
	return "apispec"
}

// RegisterRoutes registers API specification routes
func (h *Handler) RegisterRoutes(r *router.Router) {
	RegisterRoutes(r, h, h.memberService)
}

// CreateSpec creates a new API specification
func (h *Handler) CreateSpec(c *gin.Context) {
	projectIDStr := c.Param("id")
	projectID, err := strconv.ParseUint(projectIDStr, 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid project ID")
		return
	}

	var req CreateAPISpecRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	req.ProjectID = uint(projectID)
	spec, err := h.service.CreateSpec(c.Request.Context(), &req)
	if err != nil {
		if errors.Is(err, ErrSpecAlreadyExists) {
			response.Conflict(c, err.Error(), err)
			return
		}
		response.HandleError(c, "Failed to create API spec", err)
		return
	}

	response.Created(c, spec)
}

// GetSpec gets an API specification by ID
func (h *Handler) GetSpec(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("sid"), 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid ID")
		return
	}

	spec, err := h.service.GetSpecByID(c.Request.Context(), uint(id))
	if err != nil {
		response.HandleError(c, "API spec not found", err)
		return
	}

	response.Success(c, spec)
}

// GetSpecWithExamples gets an API specification with examples
func (h *Handler) GetSpecWithExamples(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("sid"), 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid ID")
		return
	}

	spec, err := h.service.GetSpecWithExamples(c.Request.Context(), uint(id))
	if err != nil {
		response.HandleError(c, "API spec not found", err)
		return
	}

	response.Success(c, spec)
}

// UpdateSpec updates an API specification
func (h *Handler) UpdateSpec(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("sid"), 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid ID")
		return
	}

	var req UpdateAPISpecRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	spec, err := h.service.UpdateSpec(c.Request.Context(), uint(id), &req)
	if err != nil {
		response.HandleError(c, "Failed to update API spec", err)
		return
	}

	response.Success(c, spec)
}

// DeleteSpec deletes an API specification
func (h *Handler) DeleteSpec(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("sid"), 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid ID")
		return
	}

	if err := h.service.DeleteSpec(c.Request.Context(), uint(id)); err != nil {
		response.HandleError(c, "Failed to delete API spec", err)
		return
	}

	response.NoContent(c)
}

// ListSpecs lists API specifications
func (h *Handler) ListSpecs(c *gin.Context) {
	projectID, _ := strconv.ParseUint(c.Param("id"), 10, 32)
	version := c.Query("version")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	specs, total, err := h.service.ListSpecs(c.Request.Context(), uint(projectID), version, page, pageSize)
	if err != nil {
		response.HandleError(c, "Failed to list API specs", err)
		return
	}

	response.Success(c, gin.H{
		"items": specs,
		"meta": gin.H{
			"total":       total,
			"page":        page,
			"page_size":   pageSize,
			"total_pages": (total + int64(pageSize) - 1) / int64(pageSize),
		},
	})
}

// CreateExample creates an API example
func (h *Handler) CreateExample(c *gin.Context) {
	sid, err := strconv.ParseUint(c.Param("sid"), 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid specification ID")
		return
	}

	var req CreateAPIExampleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	req.APISpecID = uint(sid)
	example, err := h.service.CreateExample(c.Request.Context(), &req)
	if err != nil {
		response.HandleError(c, "Failed to create example", err)
		return
	}

	response.Created(c, example)
}

// ListExamples lists all examples for an API specification
func (h *Handler) ListExamples(c *gin.Context) {
	sid, err := strconv.ParseUint(c.Param("sid"), 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid specification ID")
		return
	}

	examples, err := h.service.GetExamplesBySpecID(c.Request.Context(), uint(sid))
	if err != nil {
		response.HandleError(c, "Failed to list examples", err)
		return
	}

	response.Success(c, gin.H{"items": examples, "total": len(examples)})
}

// ImportSpecs imports multiple API specifications
func (h *Handler) ImportSpecs(c *gin.Context) {
	projectIDStr := c.Param("id")
	projectID, err := strconv.ParseUint(projectIDStr, 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid project ID")
		return
	}

	var req struct {
		Specs []*CreateAPISpecRequest `json:"specs" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	if err := h.service.ImportSpecs(c.Request.Context(), uint(projectID), req.Specs); err != nil {
		response.HandleError(c, "Failed to import specs", err)
		return
	}

	response.Success(c, gin.H{"message": "Specs imported successfully"})
}

// ExportSpecs exports API specifications
func (h *Handler) ExportSpecs(c *gin.Context) {
	projectID, _ := strconv.ParseUint(c.Param("id"), 10, 32)
	format := c.DefaultQuery("format", "json")

	data, err := h.service.ExportSpecs(c.Request.Context(), uint(projectID), format)
	if err != nil {
		response.HandleError(c, "Failed to export specs", err)
		return
	}

	response.Success(c, data)
}

// GenTest generates an AI-powered Kest flow test file for an API specification
func (h *Handler) GenTest(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("sid"), 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid ID")
		return
	}

	flowContent, err := h.service.GenTest(c.Request.Context(), uint(id))
	if err != nil {
		if errors.Is(err, ErrSpecNotFound) {
			response.NotFound(c, err.Error(), err)
			return
		}
		response.HandleError(c, "Failed to generate test", err)
		return
	}

	response.Success(c, map[string]string{
		"flow_content": flowContent,
	})
}

// GenDoc generates AI-powered documentation for an API specification
func (h *Handler) GenDoc(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("sid"), 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid ID")
		return
	}

	spec, err := h.service.GenDoc(c.Request.Context(), uint(id))
	if err != nil {
		if errors.Is(err, ErrSpecNotFound) {
			response.NotFound(c, err.Error(), err)
			return
		}
		response.HandleError(c, "Failed to generate documentation", err)
		return
	}

	response.Success(c, spec)
}

// Convenience aliases for cleaner route definitions
func (h *Handler) List(c *gin.Context) {
	h.ListSpecs(c)
}

func (h *Handler) Create(c *gin.Context) {
	h.CreateSpec(c)
}

func (h *Handler) Get(c *gin.Context) {
	h.GetSpec(c)
}

func (h *Handler) Update(c *gin.Context) {
	h.UpdateSpec(c)
}

func (h *Handler) Delete(c *gin.Context) {
	h.DeleteSpec(c)
}

func (h *Handler) GetWithExamples(c *gin.Context) {
	h.GetSpecWithExamples(c)
}

func (h *Handler) BatchImport(c *gin.Context) {
	h.ImportSpecs(c)
}

func (h *Handler) AddExample(c *gin.Context) {
	h.CreateExample(c)
}
