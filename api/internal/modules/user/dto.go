package user

import (
	"github.com/kest-labs/kest/api/internal/domain"
)

// ============================================================================
// Request DTOs (Input)
// ============================================================================

// UserRegisterRequest represents the registration request
type UserRegisterRequest struct {
	Username string `json:"username" binding:"required,min=3,max=50"`
	Password string `json:"password" binding:"required,min=6,max=50"`
	Email    string `json:"email" binding:"required,email"`
	Nickname string `json:"nickname" binding:"max=50"`
	Phone    string `json:"phone" binding:"max=20"`
}

// UserLoginRequest represents the login request
type UserLoginRequest struct {
	Username string `json:"username"`
	Email    string `json:"email"`
	Password string `json:"password" binding:"required"`
}

// UserUpdateRequest represents the profile update request
type UserUpdateRequest struct {
	Nickname string `json:"nickname" binding:"max=50"`
	Avatar   string `json:"avatar" binding:"max=255"`
	Phone    string `json:"phone" binding:"max=20"`
	Bio      string `json:"bio" binding:"max=500"`
}

// UserChangePasswordRequest represents the password change request
type UserChangePasswordRequest struct {
	OldPassword string `json:"old_password" binding:"required"`
	NewPassword string `json:"new_password" binding:"required,min=6,max=50"`
}

// UserPasswordResetRequest represents the password reset request
type UserPasswordResetRequest struct {
	Email string `json:"email" binding:"required,email"`
}

// ============================================================================
// Response DTOs (Output)
// ============================================================================

// UserLoginResponse represents the login response
type UserLoginResponse struct {
	AccessToken string       `json:"access_token"`
	User        *domain.User `json:"user"` // Domain直接输出，Password自动隐藏
}

// ============================================================================
// Model Mappers (Moved to model.go)
// ============================================================================
