package flow

import (
	"github.com/kest-labs/kest/api/internal/infra/router"
)

// RegisterRoutes registers flow routes
func RegisterRoutes(r *router.Router, handler *Handler) {
	r.Group("/workspaces/:id/flows", func(flows *router.Router) {
		flows.WithMiddleware("auth")

		flows.GET("", handler.ListFlows).WhereUUIDOrNumber("id")
		flows.POST("", handler.CreateFlow).WhereUUIDOrNumber("id")

		flows.GET("/:fid", handler.GetFlow).WhereUUIDOrNumber("id", "fid")
		flows.PATCH("/:fid", handler.UpdateFlow).WhereUUIDOrNumber("id", "fid")
		flows.PUT("/:fid", handler.SaveFlow).WhereUUIDOrNumber("id", "fid")
		flows.DELETE("/:fid", handler.DeleteFlow).WhereUUIDOrNumber("id", "fid")

		flows.POST("/:fid/steps", handler.CreateStep).WhereUUIDOrNumber("id", "fid")
		flows.PATCH("/:fid/steps/:sid", handler.UpdateStep).WhereUUIDOrNumber("id", "fid", "sid")
		flows.DELETE("/:fid/steps/:sid", handler.DeleteStep).WhereUUIDOrNumber("id", "fid", "sid")

		flows.POST("/:fid/edges", handler.CreateEdge).WhereUUIDOrNumber("id", "fid")
		flows.DELETE("/:fid/edges/:eid", handler.DeleteEdge).WhereUUIDOrNumber("id", "fid", "eid")

		flows.POST("/:fid/run", handler.RunFlow).WhereUUIDOrNumber("id", "fid")
		flows.GET("/:fid/runs", handler.ListRuns).WhereUUIDOrNumber("id", "fid")
		flows.GET("/:fid/runs/:rid", handler.GetRun).WhereUUIDOrNumber("id", "fid", "rid")
		flows.GET("/:fid/runs/:rid/events", handler.ExecuteFlowSSE).WhereUUIDOrNumber("id", "fid", "rid")
	})
}
