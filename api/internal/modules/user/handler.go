package user

import (
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/kest-labs/kest/api/internal/contracts"
	"github.com/kest-labs/kest/api/internal/domain"
	"github.com/kest-labs/kest/api/internal/infra/events"
	"github.com/kest-labs/kest/api/pkg/handler"
	"github.com/kest-labs/kest/api/pkg/pagination"
	"github.com/kest-labs/kest/api/pkg/response"
)

// Handler handles user-related HTTP requests and implements contracts.Module
type Handler struct {
	contracts.BaseModule
	service Service
}

// NewHandler creates a new Handler instance
func NewHandler(service Service) *Handler {
	return &Handler{service: service}
}

// Name returns the module name
func (h *Handler) Name() string {
	return "user"
}

// RegisterEvents registers user module event listeners
func (h *Handler) RegisterEvents(bus *events.EventBus) {
	bus.Subscribe(domain.EventUserCreated, HandleUserCreated, events.WithAsync())
}

// ============================================================================
// Authentication
// ============================================================================

// Register handles user registration
func (h *Handler) Register(c *gin.Context) {
	var req UserRegisterRequest
	if !handler.BindJSON(c, &req) {
		return
	}

	user, err := h.service.Register(c.Request.Context(), &req)
	if err != nil {
		response.HandleError(c, "Registration failed", err)
		return
	}

	response.Created(c, user)
}

// Login handles user login
func (h *Handler) Login(c *gin.Context) {
	var req UserLoginRequest
	if !handler.BindJSON(c, &req) {
		return
	}

	resp, err := h.service.Login(c.Request.Context(), &req)
	if err != nil {
		response.HandleError(c, "Login failed", err)
		return
	}

	response.Success(c, resp)
}

// ============================================================================
// Profile (Authenticated User)
// ============================================================================

// GetProfile gets current user's profile
func (h *Handler) GetProfile(c *gin.Context) {
	userID, ok := handler.GetUserID(c)
	if !ok {
		return
	}

	user, err := h.service.GetProfile(c.Request.Context(), userID)
	if err != nil {
		response.HandleError(c, "Failed to get profile", err)
		return
	}

	response.Success(c, user)
}

// UpdateProfile updates current user's profile
func (h *Handler) UpdateProfile(c *gin.Context) {
	userID, ok := handler.GetUserID(c)
	if !ok {
		return
	}

	var req UserUpdateRequest
	if !handler.BindJSON(c, &req) {
		return
	}

	user, err := h.service.UpdateProfile(c.Request.Context(), userID, &req)
	if err != nil {
		response.HandleError(c, "Failed to update profile", err)
		return
	}

	response.Success(c, user)
}

// ChangePassword changes current user's password
func (h *Handler) ChangePassword(c *gin.Context) {
	userID, ok := handler.GetUserID(c)
	if !ok {
		return
	}

	var req UserChangePasswordRequest
	if !handler.BindJSON(c, &req) {
		return
	}

	if err := h.service.ChangePassword(c.Request.Context(), userID, &req); err != nil {
		response.HandleError(c, "Failed to change password", err)
		return
	}

	response.Success(c, gin.H{"message": "Password changed successfully"})
}

// DeleteAccount deletes current user's account
func (h *Handler) DeleteAccount(c *gin.Context) {
	userID, ok := handler.GetUserID(c)
	if !ok {
		return
	}

	if err := h.service.DeleteAccount(c.Request.Context(), userID); err != nil {
		response.HandleError(c, "Failed to delete account", err)
		return
	}

	response.NoContent(c)
}

// ============================================================================
// Public
// ============================================================================

// ResetPassword initiates password reset
func (h *Handler) ResetPassword(c *gin.Context) {
	var req UserPasswordResetRequest
	if !handler.BindJSON(c, &req) {
		return
	}

	if err := h.service.ResetPassword(c.Request.Context(), &req); err != nil {
		response.HandleError(c, "Failed to reset password", err)
		return
	}

	response.Success(c, gin.H{"message": "Password reset email sent"})
}

// ============================================================================
// Admin/Query
// ============================================================================

// Get gets user by ID
func (h *Handler) Get(c *gin.Context) {
	id, ok := handler.ParseID(c, "id")
	if !ok {
		return
	}

	user, err := h.service.GetByID(c.Request.Context(), id)
	if err != nil {
		response.HandleError(c, "User not found", err)
		return
	}

	response.Success(c, user)
}

// List gets paginated user list
func (h *Handler) List(c *gin.Context) {
	req := pagination.FromContext(c)

	users, total, err := h.service.List(c.Request.Context(), req.GetPage(), req.GetPerPage())
	if err != nil {
		response.HandleError(c, "Failed to get user list", err)
		return
	}

	paginator := pagination.NewPaginator(users, total, req.GetPage(), req.GetPerPage())
	paginator.SetPath(c.Request.URL.Path)

	response.Success(c, paginator)
}

// GetUserInfo gets detailed user info by ID (alias for Get)
func (h *Handler) GetUserInfo(c *gin.Context) {
	h.Get(c)
}

// SearchUsers searches users by query string
func (h *Handler) SearchUsers(c *gin.Context) {
	q := c.Query("q")
	if q == "" {
		response.Error(c, 400, "query parameter 'q' is required")
		return
	}

	limit := 20
	if l := c.Query("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 {
			limit = parsed
		}
	}

	users, err := h.service.Search(c.Request.Context(), q, limit)
	if err != nil {
		response.HandleError(c, "Search failed", err)
		return
	}

	response.Success(c, users)
}
