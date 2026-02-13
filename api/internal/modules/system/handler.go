package system

import (
	"github.com/gin-gonic/gin"
	"github.com/kest-labs/kest/api/internal/contracts"
	"github.com/kest-labs/kest/api/internal/infra/router"
	"github.com/kest-labs/kest/api/pkg/response"
)

// Handler handles system configuration requests
type Handler struct {
	contracts.BaseModule
}

// NewHandler creates a new system handler
func NewHandler() *Handler {
	return &Handler{}
}

// Name returns the module name
func (h *Handler) Name() string {
	return "system"
}

// RegisterRoutes registers system routes
func (h *Handler) RegisterRoutes(r *router.Router) {
	RegisterRoutes(r, h)
}

// GetSystemFeatures returns system feature flags
func (h *Handler) GetSystemFeatures(c *gin.Context) {
	features := SystemFeatures{
		EnableEmailPasswordLogin: true,
		EnableSocialOAuthLogin:   false,
		IsAllowRegister:          true,
		EnableAPIDocumentation:   true,
		EnableTestRunner:         true,
		EnableCLISync:            true,
	}
	response.Success(c, features)
}

// GetSetupStatus returns system setup status
func (h *Handler) GetSetupStatus(c *gin.Context) {
	status := SetupStatus{
		Step:     "finished",
		SetupAt:  "2024-01-01T00:00:00Z",
		IsSetup:  true,
		HasAdmin: true,
		Version:  "1.0.0",
	}
	response.Success(c, status)
}

// SystemFeatures represents system feature flags
type SystemFeatures struct {
	EnableEmailPasswordLogin bool `json:"enable_email_password_login"`
	EnableSocialOAuthLogin   bool `json:"enable_social_oauth_login"`
	IsAllowRegister          bool `json:"is_allow_register"`
	EnableAPIDocumentation   bool `json:"enable_api_documentation"`
	EnableTestRunner         bool `json:"enable_test_runner"`
	EnableCLISync            bool `json:"enable_cli_sync"`
}

// SetupStatus represents system setup status
type SetupStatus struct {
	Step     string `json:"step"` // "not_started" or "finished"
	SetupAt  string `json:"setup_at,omitempty"`
	IsSetup  bool   `json:"is_setup"`
	HasAdmin bool   `json:"has_admin"`
	Version  string `json:"version"`
}
