package workspace

import (
	"github.com/kest-labs/kest/api/internal/infra/router"
)

// RegisterRoutes registers the workspace module routes
func (h *Handler) RegisterRoutes(r *router.Router) {
	// All workspace routes require authentication
	r.Group("", func(auth *router.Router) {
		auth.WithMiddleware("auth")

		// Workspace CRUD
		auth.POST("/workspaces", h.CreateWorkspace).Name("workspaces.create")
		auth.GET("/workspaces", h.ListWorkspaces).Name("workspaces.index")
		auth.GET("/workspaces/:id", h.GetWorkspace).Name("workspaces.show").WhereNumber("id")
		auth.PATCH("/workspaces/:id", h.UpdateWorkspace).Name("workspaces.update").WhereNumber("id")
		auth.DELETE("/workspaces/:id", h.DeleteWorkspace).Name("workspaces.delete").WhereNumber("id")

		// Member management
		auth.POST("/workspaces/:id/members", h.AddMember).Name("workspaces.members.add").WhereNumber("id")
		auth.GET("/workspaces/:id/members", h.ListMembers).Name("workspaces.members.list").WhereNumber("id")
		auth.PATCH("/workspaces/:id/members/:uid", h.UpdateMemberRole).Name("workspaces.members.update").WhereNumber("id", "uid")
		auth.DELETE("/workspaces/:id/members/:uid", h.RemoveMember).Name("workspaces.members.remove").WhereNumber("id", "uid")
	})
}
