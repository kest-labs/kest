package permission

import (
	"github.com/kest-labs/kest/api/internal/infra/router"
)

// RegisterRoutes registers permission module routes
// It uses the injected handler instance
func (h *Handler) RegisterRoutes(r *router.Router) {
	// Role routes (admin only)
	r.Group("", func(auth *router.Router) {
		auth.WithMiddleware("auth")

		// Role management
		auth.POST("/roles", h.CreateRole).Name("roles.store")
		auth.GET("/roles", h.ListRoles).Name("roles.index")
		auth.GET("/roles/:id", h.GetRole).Name("roles.show").WhereNumber("id")
		auth.PUT("/roles/:id", h.UpdateRole).Name("roles.update").WhereNumber("id")
		auth.DELETE("/roles/:id", h.DeleteRole).Name("roles.destroy").WhereNumber("id")

		// Role assignment
		auth.POST("/roles/assign", h.AssignRole).Name("roles.assign")
		auth.POST("/roles/remove", h.RemoveRole).Name("roles.remove")

		// User roles
		auth.GET("/users/:id/roles", h.GetUserRoles).Name("users.roles").WhereNumber("id")

		// Permissions
		auth.GET("/permissions", h.ListPermissions).Name("permissions.index")
	})
}
