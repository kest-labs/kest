package apispec

import (
	"github.com/kest-labs/kest/api/internal/infra/router"
	"github.com/kest-labs/kest/api/internal/modules/member"
)

// RegisterRoutes registers API specification routes
func RegisterRoutes(r *router.Router, handler *Handler, memberService member.Service) {
	// All API spec operations are now project-scoped
	r.Group("/projects/:id/api-specs", func(projects *router.Router) {
		projects.WithMiddleware("auth")

		projects.GET("", handler.ListSpecs)
		projects.POST("", handler.CreateSpec)
		projects.POST("/import", handler.ImportSpecs)
		projects.GET("/export", handler.ExportSpecs)

		projects.GET("/:sid", handler.GetSpec)
		projects.GET("/:sid/full", handler.GetSpecWithExamples)
		projects.PATCH("/:sid", handler.UpdateSpec)
		projects.DELETE("/:sid", handler.DeleteSpec)

		// API Examples (Nested under spec)
		projects.POST("/:sid/gen-doc", handler.GenDoc)
		projects.POST("/:sid/gen-test", handler.GenTest)
		projects.GET("/:sid/examples", handler.ListExamples)
		projects.POST("/:sid/examples", handler.CreateExample)
	})
}
