package user

import (
	"github.com/kest-labs/kest/api/internal/infra/router"
)

// RegisterRoutes registers the user module routes
// It uses the injected handler instance instead of creating a new one
func (h *Handler) RegisterRoutes(r *router.Router) {
	// Public routes
	r.POST("/register", h.Register).Name("auth.register")
	r.POST("/login", h.Login).Name("auth.login")
	r.POST("/password/reset", h.ResetPassword).Name("auth.password.reset")

	// Protected routes
	r.Group("", func(auth *router.Router) {
		auth.WithMiddleware("auth")

		// Profile
		auth.GET("/users/profile", h.GetProfile).Name("users.profile")
		auth.PUT("/users/profile", h.UpdateProfile).Name("users.profile.update")
		auth.PUT("/users/password", h.ChangePassword).Name("users.password.update")
		auth.DELETE("/users/account", h.DeleteAccount).Name("users.account.delete")

		// User management
		auth.GET("/users", h.List).Name("users.index")
		auth.GET("/users/search", h.SearchUsers).Name("users.search")
		auth.GET("/users/:id", h.Get).Name("users.show").WhereNumber("id")
		auth.GET("/users/:id/info", h.GetUserInfo).Name("users.info").WhereNumber("id")
	})
}
