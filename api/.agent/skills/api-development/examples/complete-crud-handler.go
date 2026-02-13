package user

import (
	"github.com/gin-gonic/gin"
	"github.com/kest-labs/kest/api/internal/domain"
	"github.com/kest-labs/kest/api/pkg/handler"
	"github.com/kest-labs/kest/api/pkg/pagination"
	"github.com/kest-labs/kest/api/pkg/response"
	"gorm.io/gorm"
)

// Handler handles user HTTP requests
type Handler struct {
	service Service
	db      *gorm.DB
}

// NewHandler creates a new user handler
func NewHandler(service Service, db *gorm.DB) *Handler {
	return &Handler{
		service: service,
		db:      db,
	}
}

// List godoc
// @Summary List users with pagination
// @Tags users
// @Accept json
// @Produce json
// @Param page query int false "Page number" default(1)
// @Param page_size query int false "Page size" default(20)
// @Param status query string false "Filter by status"
// @Param search query string false "Search by username or email"
// @Success 200 {object} response.PaginatedResponse{data=[]UserResponse}
// @Failure 500 {object} response.ErrorResponse
// @Router /api/users [get]
func (h *Handler) List(c *gin.Context) {
	// Apply filters before pagination
	query := h.db.Model(&UserPO{})

	// Filter by status
	if status := c.Query("status"); status != "" {
		query = query.Where("status = ?", status)
	}

	// Filter by search
	if search := c.Query("search"); search != "" {
		query = query.Where("username LIKE ? OR email LIKE ?",
			"%"+search+"%", "%"+search+"%")
	}

	// ✅ PAGINATION - One-liner with automatic query parameter extraction
	users, paginator, err := pagination.PaginateFromContext[*domain.User](c, query)
	if err != nil {
		response.HandleError(c, "Failed to fetch users", err)
		return
	}

	// ✅ SUCCESS RESPONSE - Auto-detects pagination
	response.Success(c, paginator)
}

// Get godoc
// @Summary Get user by ID
// @Tags users
// @Accept json
// @Produce json
// @Param id path int true "User ID"
// @Success 200 {object} response.Response{data=UserResponse}
// @Failure 400 {object} response.ErrorResponse
// @Failure 404 {object} response.ErrorResponse
// @Router /api/users/{id} [get]
func (h *Handler) Get(c *gin.Context) {
	// ✅ VALIDATION - Auto-sends 400 if invalid
	id, ok := handler.ParseID(c, "id")
	if !ok {
		return // 400 already sent
	}

	// Call service
	user, err := h.service.GetByID(c.Request.Context(), id)
	if err != nil {
		// ✅ ERROR HANDLING - Auto-maps error to status code
		response.HandleError(c, "User not found", err)
		return
	}

	// ✅ SUCCESS RESPONSE - 200 OK
	response.Success(c, ToResponse(user))
}

// Create godoc
// @Summary Create a new user
// @Tags users
// @Accept json
// @Produce json
// @Param body body CreateUserRequest true "User data"
// @Success 201 {object} response.Response{data=UserResponse}
// @Failure 400 {object} response.ErrorResponse
// @Failure 422 {object} response.ValidationErrorResponse
// @Router /api/users [post]
func (h *Handler) Create(c *gin.Context) {
	// ✅ VALIDATION - Auto-validates with binding tags
	var req CreateUserRequest
	if !handler.BindJSON(c, &req) {
		return // 422 with validation errors already sent
	}

	// Call service
	user, err := h.service.Create(c.Request.Context(), &req)
	if err != nil {
		response.HandleError(c, "Failed to create user", err)
		return
	}

	// ✅ SUCCESS RESPONSE - 201 Created
	response.Created(c, ToResponse(user))
}

// Update godoc
// @Summary Update user
// @Tags users
// @Accept json
// @Produce json
// @Param id path int true "User ID"
// @Param body body UpdateUserRequest true "Update data"
// @Success 200 {object} response.Response{data=UserResponse}
// @Failure 400 {object} response.ErrorResponse
// @Failure 404 {object} response.ErrorResponse
// @Failure 422 {object} response.ValidationErrorResponse
// @Router /api/users/{id} [patch]
func (h *Handler) Update(c *gin.Context) {
	// Parse ID
	id, ok := handler.ParseID(c, "id")
	if !ok {
		return
	}

	// ✅ VALIDATION - With optional fields (pointers)
	var req UpdateUserRequest
	if !handler.BindJSON(c, &req) {
		return
	}

	// Call service
	user, err := h.service.Update(c.Request.Context(), id, &req)
	if err != nil {
		response.HandleError(c, "Failed to update user", err)
		return
	}

	// ✅ SUCCESS RESPONSE - 200 OK
	response.Success(c, ToResponse(user))
}

// Delete godoc
// @Summary Delete user
// @Tags users
// @Param id path int true "User ID"
// @Success 204 "No Content"
// @Failure 400 {object} response.ErrorResponse
// @Failure 404 {object} response.ErrorResponse
// @Router /api/users/{id} [delete]
func (h *Handler) Delete(c *gin.Context) {
	// Parse ID
	id, ok := handler.ParseID(c, "id")
	if !ok {
		return
	}

	// Call service
	if err := h.service.Delete(c.Request.Context(), id); err != nil {
		response.HandleError(c, "Failed to delete user", err)
		return
	}

	// ✅ SUCCESS RESPONSE - 204 No Content
	response.NoContent(c)
}

// GetProfile godoc
// @Summary Get current user profile
// @Tags users
// @Accept json
// @Produce json
// @Security Bearer
// @Success 200 {object} response.Response{data=UserResponse}
// @Failure 401 {object} response.ErrorResponse
// @Router /api/users/me [get]
func (h *Handler) GetProfile(c *gin.Context) {
	// ✅ AUTHENTICATION - Get user ID from context
	userID, ok := handler.GetUserID(c)
	if !ok {
		return // 401 already sent
	}

	user, err := h.service.GetByID(c.Request.Context(), userID)
	if err != nil {
		response.HandleError(c, "User not found", err)
		return
	}

	response.Success(c, ToResponse(user))
}

// UpdateProfile godoc
// @Summary Update current user profile
// @Tags users
// @Accept json
// @Produce json
// @Security Bearer
// @Param body body UpdateUserRequest true "Profile data"
// @Success 200 {object} response.Response{data=UserResponse}
// @Failure 401 {object} response.ErrorResponse
// @Failure 422 {object} response.ValidationErrorResponse
// @Router /api/users/me [patch]
func (h *Handler) UpdateProfile(c *gin.Context) {
	userID, ok := handler.GetUserID(c)
	if !ok {
		return
	}

	var req UpdateUserRequest
	if !handler.BindJSON(c, &req) {
		return
	}

	user, err := h.service.Update(c.Request.Context(), userID, &req)
	if err != nil {
		response.HandleError(c, "Failed to update profile", err)
		return
	}

	response.Success(c, ToResponse(user))
}

// ============================================================================
// DTOs with Validation
// ============================================================================

// CreateUserRequest for creating a new user
type CreateUserRequest struct {
	Username string `json:"username" binding:"required,min=3,max=50"`
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=8,max=72"`
	Bio      string `json:"bio" binding:"omitempty,max=500"`
	Age      int    `json:"age" binding:"omitempty,gte=0,lte=150"`
}

// UpdateUserRequest for updating a user (optional fields use pointers)
type UpdateUserRequest struct {
	Username *string `json:"username" binding:"omitempty,min=3,max=50"`
	Email    *string `json:"email" binding:"omitempty,email"`
	Bio      *string `json:"bio" binding:"omitempty,max=500"`
	Age      *int    `json:"age" binding:"omitempty,gte=0,lte=150"`
}

// UserResponse for API responses
type UserResponse struct {
	ID        uint   `json:"id"`
	Username  string `json:"username"`
	Email     string `json:"email"`
	Bio       string `json:"bio,omitempty"`
	Age       int    `json:"age,omitempty"`
	Status    string `json:"status"`
	CreatedAt string `json:"created_at"`
}

// ToResponse converts domain.User to UserResponse
func ToResponse(user *domain.User) *UserResponse {
	if user == nil {
		return nil
	}

	return &UserResponse{
		ID:        user.ID,
		Username:  user.Username,
		Email:     user.Email,
		Bio:       user.Bio,
		Age:       user.Age,
		Status:    user.Status,
		CreatedAt: user.CreatedAt.Format("2006-01-02T15:04:05Z"),
	}
}
