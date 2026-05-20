package testcase

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/kest-labs/kest/api/internal/contracts"
	"github.com/kest-labs/kest/api/internal/infra/router"
	"github.com/kest-labs/kest/api/internal/modules/workspace"
	"github.com/kest-labs/kest/api/pkg/handler"
	"github.com/kest-labs/kest/api/pkg/response"
)

// Handler handles HTTP requests for test cases
type Handler struct {
	contracts.BaseModule
	service       Service
	workspaceService workspace.Service
}

// Name returns the module name
func (h *Handler) Name() string {
	return "testcase"
}

// NewHandler creates a new test case handler
func NewHandler(service Service, workspaceService workspace.Service) *Handler {
	return &Handler{service: service, workspaceService: workspaceService}
}

// RegisterRoutes registers test case routes on the fluent router
func (h *Handler) RegisterRoutes(r *router.Router) {
	r.Group("/workspaces/:id/test-cases", func(tc *router.Router) {
		tc.WithMiddleware("auth")

		tc.GET("", h.List).WhereUUIDOrNumber("id")
		tc.POST("", h.Create).WhereUUIDOrNumber("id")
		tc.POST("/from-spec", h.FromSpec).WhereUUIDOrNumber("id")

		tc.GET("/:tcid", h.Get).WhereUUIDOrNumber("id", "tcid")
		tc.PATCH("/:tcid", h.Update).WhereUUIDOrNumber("id", "tcid")
		tc.DELETE("/:tcid", h.Delete).WhereUUIDOrNumber("id", "tcid")
		tc.POST("/:tcid/duplicate", h.Duplicate).WhereUUIDOrNumber("id", "tcid")
		tc.POST("/:tcid/run", h.RunTestCase).WhereUUIDOrNumber("id", "tcid")
		tc.GET("/:tcid/runs", h.ListRuns).WhereUUIDOrNumber("id", "tcid")
		tc.GET("/:tcid/runs/:rid", h.GetRun).WhereUUIDOrNumber("id", "tcid", "rid")
	})
}

// ListTestCases handles GET /api/v1/test-cases
func (h *Handler) ListTestCases(c *gin.Context) {
	workspaceID, ok := h.authorizeWorkspace(c, workspace.RoleRead)
	if !ok {
		return
	}

	// Parse filters
	filter := &ListFilter{
		WorkspaceID: workspaceID,
		Page:        1,
		PageSize:    20,
	}

	if apiSpecID := c.Query("api_spec_id"); apiSpecID != "" {
		id := apiSpecID
		filter.APISpecID = &id
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
	workspaceID, ok := h.authorizeWorkspace(c, workspace.RoleWrite)
	if !ok {
		return
	}

	var req CreateTestCaseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	req.WorkspaceID = workspaceID

	testCase, err := h.service.CreateTestCase(c.Request.Context(), &req)
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

// GetTestCase handles GET /api/v1/workspaces/:id/test-cases/:tcid
func (h *Handler) GetTestCase(c *gin.Context) {
	workspaceID, ok := h.authorizeWorkspace(c, workspace.RoleRead)
	if !ok {
		return
	}

	id := c.Param("tcid")
	if id == "" {
		response.Error(c, http.StatusBadRequest, "Invalid test case ID")
		return
	}

	testCase, err := h.service.GetTestCase(c.Request.Context(), workspaceID, id)
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

// UpdateTestCase handles PATCH /api/v1/workspaces/:id/test-cases/:tcid
func (h *Handler) UpdateTestCase(c *gin.Context) {
	workspaceID, ok := h.authorizeWorkspace(c, workspace.RoleWrite)
	if !ok {
		return
	}

	id := c.Param("tcid")
	if id == "" {
		response.Error(c, http.StatusBadRequest, "Invalid test case ID")
		return
	}

	var req UpdateTestCaseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	testCase, err := h.service.UpdateTestCase(c.Request.Context(), workspaceID, id, &req)
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

// DeleteTestCase handles DELETE /api/v1/workspaces/:id/test-cases/:tcid
func (h *Handler) DeleteTestCase(c *gin.Context) {
	workspaceID, ok := h.authorizeWorkspace(c, workspace.RoleWrite)
	if !ok {
		return
	}

	id := c.Param("tcid")
	if id == "" {
		response.Error(c, http.StatusBadRequest, "Invalid test case ID")
		return
	}

	if err := h.service.DeleteTestCase(c.Request.Context(), workspaceID, id); err != nil {
		if err.Error() == "test case not found" {
			response.Error(c, http.StatusNotFound, err.Error())
			return
		}
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	c.Status(http.StatusNoContent)
}

// DuplicateTestCase handles POST /api/v1/workspaces/:id/test-cases/:tcid/duplicate
func (h *Handler) DuplicateTestCase(c *gin.Context) {
	workspaceID, ok := h.authorizeWorkspace(c, workspace.RoleWrite)
	if !ok {
		return
	}

	id := c.Param("tcid")
	if id == "" {
		response.Error(c, http.StatusBadRequest, "Invalid test case ID")
		return
	}

	var req DuplicateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	testCase, err := h.service.DuplicateTestCase(c.Request.Context(), workspaceID, id, &req)
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

// RunTestCase handles POST /api/v1/workspaces/:id/test-cases/:tcid/run
func (h *Handler) RunTestCase(c *gin.Context) {
	workspaceID, ok := h.authorizeWorkspace(c, workspace.RoleWrite)
	if !ok {
		return
	}

	id := c.Param("tcid")
	if id == "" {
		response.Error(c, http.StatusBadRequest, "Invalid test case ID")
		return
	}

	var req RunTestCaseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		// Its okay if body is empty
	}

	result, err := h.service.RunTestCase(c.Request.Context(), workspaceID, id, &req)
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

// CreateFromSpec handles POST /api/v1/workspaces/:id/test-cases/from-spec
func (h *Handler) CreateFromSpec(c *gin.Context) {
	workspaceID, ok := h.authorizeWorkspace(c, workspace.RoleWrite)
	if !ok {
		return
	}

	var req FromSpecRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	req.WorkspaceID = workspaceID

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

// ListRuns handles GET /workspaces/:id/test-cases/:tcid/runs
func (h *Handler) ListRuns(c *gin.Context) {
	workspaceID, ok := h.authorizeWorkspace(c, workspace.RoleRead)
	if !ok {
		return
	}

	tcid := c.Param("tcid")
	if tcid == "" {
		response.BadRequest(c, "Invalid test case ID")
		return
	}

	filter := &ListRunsFilter{
		WorkspaceID: workspaceID,
		TestCaseID: tcid,
		Page:       1,
		PageSize:   20,
	}

	if status := c.Query("status"); status != "" {
		filter.Status = &status
	}
	if page, err := strconv.Atoi(c.Query("page")); err == nil && page > 0 {
		filter.Page = page
	}
	if pageSize, err := strconv.Atoi(c.Query("page_size")); err == nil && pageSize > 0 {
		filter.PageSize = pageSize
	}

	runs, meta, err := h.service.ListRuns(c.Request.Context(), filter)
	if err != nil {
		response.HandleError(c, "Failed to list runs", err)
		return
	}

	response.Success(c, gin.H{"items": runs, "meta": meta})
}

// GetRun handles GET /workspaces/:id/test-cases/:tcid/runs/:rid
func (h *Handler) GetRun(c *gin.Context) {
	workspaceID, ok := h.authorizeWorkspace(c, workspace.RoleRead)
	if !ok {
		return
	}

	tcid := c.Param("tcid")
	if tcid == "" {
		response.BadRequest(c, "Invalid test case ID")
		return
	}

	rid := c.Param("rid")
	if rid == "" {
		response.BadRequest(c, "Invalid run ID")
		return
	}

	run, err := h.service.GetRun(c.Request.Context(), workspaceID, tcid, rid)
	if err != nil {
		if err.Error() == "run not found" {
			response.NotFound(c, err.Error(), err)
			return
		}
		response.HandleError(c, "Failed to get run", err)
		return
	}

	response.Success(c, run)
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

func (h *Handler) authorizeWorkspace(c *gin.Context, requiredRole string) (string, bool) {
	workspaceID, ok := handler.ParseID(c, "id")
	if !ok {
		return "", false
	}

	userID, ok := handler.GetUserID(c)
	if !ok {
		return "", false
	}

	allowed, err := h.workspaceService.HasPermission(workspaceID, userID, requiredRole, false)
	if err != nil || !allowed {
		response.Error(c, http.StatusForbidden, "workspace not found or access denied")
		return "", false
	}

	return workspaceID, true
}
