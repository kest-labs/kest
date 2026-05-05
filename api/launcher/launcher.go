package launcher

import (
	"fmt"
	"os"

	"github.com/gin-gonic/gin"

	"github.com/kest-labs/kest/api/routes"
	// 假设你还需要初始化 database 或者其他 handlers
)

func Start(port string) {
	// 1. 初始化 Gin
	if os.Getenv("GIN_MODE") == "release" {
		gin.SetMode(gin.ReleaseMode)
	}
	r := gin.Default()

	// 2. 这里调用你已有的 Setup 逻辑
	// 注意：Setup 需要一个 *app.Handlers，这里暂时传 nil 或初始化它
	// 实际代码中你应该根据 api/internal/app 的逻辑来初始化
	routes.Setup(r, nil)

	// 3. 启动
	fmt.Printf("🦅 Kest Platform Backend Starting on :%s\n", port)
	if err := r.Run(":" + port); err != nil {
		fmt.Printf("❌ Failed to start server: %v\n", err)
		os.Exit(1)
	}
}
