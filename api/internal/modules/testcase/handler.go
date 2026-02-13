package testcase

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/kest-labs/kest/api/internal/contracts"
	"github.com/kest-labs/kest/api/internal/infra/middleware"
	"github.com/kest-labs/kest/api/internal/infra/router"
	"github.com/kest-labs/kest/api/internal/modules/member"
	"github.com/kest-labs/kest/api/pkg/response"
)

// Handler handles HTTP requests for test cases
type Handler struct {
	contracts.BaseModule
	service       Service
	memberService member.Service
}

// Name returns the module name
func (h *Handler) Name() string {
	return "testcase"
}

// NewHandler creates a new test case handler
func NewHandler(service Service, memberService member.Service) *Handler {
	return &Handler{service: service, memberService: memberService}
}

// RegisterRoutes registers test case routes on the fluent router
func (h *Handler) RegisterRoutes(r *router.Router) {
	r.Group("/projects/:id/test-cases", func(tc *router.Router) {
		tc.WithMiddleware("auth")

		tc.GET("", h.List).
			Middleware(middleware.RequireProjectRole(h.memberService, member.RoleRead))
		tc.POST("", h.Create).
			Middleware(middleware.RequireProjectRole(h.memberService, member.RoleWrite))
		tc.POST("/from-spec", h.FromSpec).
			Middleware(middleware.RequireProjectRole(h.memberService, member.RoleWrite))

		tc.GET("/:tcid", h.Get).
			Middleware(middleware.RequireProjectRole(h.memberService, member.RoleRead))
		tc.PATCH("/:tcid", h.Update).
			Middleware(middleware.RequireProjectRole(h.memberService, member.RoleWrite))
		tc.DELETE("/:tcid", h.Delete).
			Middleware(middleware.RequireProjectRole(h.memberService, member.RoleWrite))
		tc.POST("/:tcid/duplicate", h.Duplicate).
			Middleware(middleware.RequireProjectRole(h.memberService, member.RoleWrite))
		tc.POST("/:tcid/run", h.RunTestCase).
			Middleware(middleware.RequireProjectRole(h.memberService, member.RoleWrite))
	})
}

// ListTestCases handles GET /api/v1/test-cases
func (h *Handler) ListTestCases(c *gin.Context) {
	// Parse filters
	filter := &ListFilter{
		Page:     1,
		PageSize: 20,
	}

	if apiSpecID := c.Query("api_spec_id"); apiSpecID != "" {
		id, err := strconv.ParseUint(apiSpecID, 10, 32)
		if err == nil {
			uid := uint(id)
			filter.APISpecID = &uid
		}
	}

	if env := c.Query("env"); env != "" {
		filter.Env = &env
	}

	if keyword := c.Query("keyword"); keyword != "" {
		filter.Keyword = &keyword
	}

	if page := c.Query("page"); page != "" {
		if p, err := strconv.Atoi(page); err == nil && p > 0 {
			filter.Page = p
		}
	}

	if pageSize := c.Query("page_size"); pageSize != "" {
		if ps, err := strconv.Atoi(pageSize); err == nil && ps > 0 {
			filter.PageSize = ps
		}
	}

	testCases, meta, err := h.service.ListTestCases(c.Request.Context(), filter)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Success(c, gin.H{
		"items": testCases,
		"meta":  meta,
	})
}

// CreateTestCase handles POST /api/v1/test-cases
func (h *Handler) CreateTestCase(c *gin.Context) {
	var req CreateTestCaseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	testCase, err := h.service.CreateTestCase(c.Request.Context(), &req)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Created(c, testCase)
}

// GetTestCase handles GET /api/v1/projects/:id/test-cases/:tcid
func (h *Handler) GetTestCase(c *gin.Context) {
	idStr := c.Param("tcid")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "Invalid test case ID")
		return
	}

	testCase, err := h.service.GetTestCase(c.Request.Context(), uint(id))
	if err != nil {
		if err.Error() == "test case not found" {
			response.Error(c, http.StatusNotFound, err.Error())
			return
		}
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Success(c, testCase)
}

// UpdateTestCase handles PATCH /api/v1/projects/:id/test-cases/:tcid
func (h *Handler) UpdateTestCase(c *gin.Context) {
	idStr := c.Param("tcid")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "Invalid test case ID")
		return
	}

	var req UpdateTestCaseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	testCase, err := h.service.UpdateTestCase(c.Request.Context(), uint(id), &req)
	if err != nil {
		if err.Error() == "test case not found" {
			response.Error(c, http.StatusNotFound, err.Error())
			return
		}
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Success(c, testCase)
}

// DeleteTestCase handles DELETE /api/v1/projects/:id/test-cases/:tcid
func (h *Handler) DeleteTestCase(c *gin.Context) {
	idStr := c.Param("tcid")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "Invalid test case ID")
		return
	}

	if err := h.service.DeleteTestCase(c.Request.Context(), uint(id)); err != nil {
		if err.Error() == "test case not found" {
			response.Error(c, http.StatusNotFound, err.Error())
			return
		}
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	c.Status(http.StatusNoContent)
}

// DuplicateTestCase handles POST /api/v1/projects/:id/test-cases/:tcid/duplicate
func (h *Handler) DuplicateTestCase(c *gin.Context) {
	idStr := c.Param("tcid")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "Invalid test case ID")
		return
	}

	var req DuplicateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	testCase, err := h.service.DuplicateTestCase(c.Request.Context(), uint(id), &req)
	if err != nil {
		if err.Error() == "source test case not found" {
			response.Error(c, http.StatusNotFound, err.Error())
			return
		}
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Created(c, testCase)
}

// RunTestCase handles POST /api/v1/projects/:id/test-cases/:tcid/run
func (h *Handler) RunTestCase(c *gin.Context) {
	idStr := c.Param("tcid")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "Invalid test case ID")
		return
	}

	var req RunTestCaseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		// Its okay if body is empty
	}

	result, err := h.service.RunTestCase(c.Request.Context(), uint(id), &req)
	if err != nil {
		if err.Error() == "test case not found" {
			response.Error(c, http.StatusNotFound, err.Error())
			return
		}
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Success(c, result)
}

// CreateFromSpec handles POST /api/v1/test-cases/from-spec
func (h *Handler) CreateFromSpec(c *gin.Context) {
	var req FromSpecRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	testCase, err := h.service.CreateTestCaseFromSpec(c.Request.Context(), &req)
	if err != nil {
		if err.Error() == "api spec not found" {
			response.Error(c, http.StatusNotFound, err.Error())
			return
		}
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Created(c, testCase)
}

// Convenience methods for router registration
func (h *Handler) List(c *gin.Context) {
	h.ListTestCases(c)
}

func (h *Handler) Create(c *gin.Context) {
	h.CreateTestCase(c)
}

func (h *Handler) Get(c *gin.Context) {
	h.GetTestCase(c)
}

func (h *Handler) Update(c *gin.Context) {
	h.UpdateTestCase(c)
}

func (h *Handler) Delete(c *gin.Context) {
	h.DeleteTestCase(c)
}

func (h *Handler) Duplicate(c *gin.Context) {
	h.DuplicateTestCase(c)
}

func (h *Handler) FromSpec(c *gin.Context) {
	h.CreateFromSpec(c)
}
