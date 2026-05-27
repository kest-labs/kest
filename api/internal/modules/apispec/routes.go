package apispec

import (
	"github.com/kest-labs/kest/api/internal/infra/router"
)

// RegisterRoutes registers API specification routes
func RegisterRoutes(r *router.Router, handler *Handler) {
	r.Group("/workspaces/:id/api-specs", func(specs *router.Router) {
		specs.WithMiddleware("auth")

		specs.GET("", handler.ListSpecs).WhereUUIDOrNumber("id")
		specs.POST("", handler.CreateSpec).WhereUUIDOrNumber("id")
		specs.POST("/import", handler.ImportSpecs).WhereUUIDOrNumber("id")
		specs.GET("/export", handler.ExportSpecs).WhereUUIDOrNumber("id")
		specs.POST("/batch-gen-doc", handler.BatchGenDoc).WhereUUIDOrNumber("id")
		specs.POST("/ai-drafts", handler.CreateAIDraft).WhereUUIDOrNumber("id")
		specs.POST("/ai-drafts/stream", handler.CreateAIDraftStream).WhereUUIDOrNumber("id")
		specs.GET("/ai-drafts/:aid", handler.GetAIDraft).WhereUUIDOrNumber("id", "aid")
		specs.POST("/ai-drafts/:aid/refine", handler.RefineAIDraft).WhereUUIDOrNumber("id", "aid")
		specs.POST("/ai-drafts/:aid/accept", handler.AcceptAIDraft).WhereUUIDOrNumber("id", "aid")

		specs.GET("/:sid", handler.GetSpec).WhereUUIDOrNumber("id", "sid")
		specs.GET("/:sid/full", handler.GetSpecWithExamples).WhereUUIDOrNumber("id", "sid")
		specs.PATCH("/:sid", handler.UpdateSpec).WhereUUIDOrNumber("id", "sid")
		specs.DELETE("/:sid", handler.DeleteSpec).WhereUUIDOrNumber("id", "sid")

		specs.POST("/:sid/gen-doc", handler.GenDoc).WhereUUIDOrNumber("id", "sid")
		specs.POST("/:sid/gen-test", handler.GenTest).WhereUUIDOrNumber("id", "sid")
		specs.GET("/:sid/examples", handler.ListExamples).WhereUUIDOrNumber("id", "sid")
		specs.POST("/:sid/examples", handler.CreateExample).WhereUUIDOrNumber("id", "sid")

		specs.GET("/:sid/share", handler.GetShare).WhereUUIDOrNumber("id", "sid")
		specs.POST("/:sid/share", handler.PublishShare).WhereUUIDOrNumber("id", "sid")
		specs.DELETE("/:sid/share", handler.DeleteShare).WhereUUIDOrNumber("id", "sid")
	})

	r.GET("/public/api-spec-shares/:slug", handler.GetPublicShare)
}
