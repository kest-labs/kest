package feature

import (
	"fmt"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/kest-labs/kest/api/internal/app"
	"github.com/kest-labs/kest/api/internal/bootstrap"
	"github.com/kest-labs/kest/api/internal/infra/config"
	"github.com/kest-labs/kest/api/internal/infra/database"
	"github.com/kest-labs/kest/api/internal/infra/email"
	"github.com/kest-labs/kest/api/internal/infra/events"
	"github.com/kest-labs/kest/api/internal/infra/jwt"
	"github.com/kest-labs/kest/api/internal/infra/middleware"
	test_platform "github.com/kest-labs/kest/api/internal/infra/testing"
	"github.com/kest-labs/kest/api/internal/modules/permission"
	"github.com/kest-labs/kest/api/internal/modules/user"
	"github.com/kest-labs/kest/api/routes"
)

// SetupApp initializes the application for feature testing.
// Uses manual DI instead of Wire for test flexibility.
func SetupApp() *gin.Engine {
	// 1. Create Test Config
	cfg := &config.Config{}
	cfg.Server.Mode = "test"
	cfg.Database.Enabled = true
	cfg.Database.Driver = "sqlite"
	cfg.Database.Memory = true
	cfg.Database.MaxIdleConns = 1
	cfg.Database.MaxOpenConns = 1
	cfg.JWT.Secret = "testing-secret"
	cfg.JWT.Expire = time.Hour

	// 2. Initialize Database (In-Memory SQLite)
	db, err := database.NewDB(cfg)
	if err != nil {
		fmt.Printf("NewDB Error: %v\n", err)
		panic("failed to init test db: " + err.Error())
	}

	// 3. Run Migrations
	if err := bootstrap.RunMigrations(db); err != nil {
		fmt.Printf("RunMigrations Error: %v\n", err)
		panic("failed to run migrations for test db: " + err.Error())
	}

	// 4. Create Services via DI
	jwtService := jwt.NewService(cfg)
	emailService := email.NewService(cfg)
	eventBus := events.NewEventBus()

	// Set JWT service for middleware
	middleware.SetJWTService(jwtService)

	// 5. Create Repositories
	userRepo := user.NewRepository(db)
	permRepo := permission.NewRepository(db)

	// 6. Create Services
	userService := user.NewService(userRepo, jwtService, eventBus)
	permService := permission.NewService(permRepo)

	// 7. Create Handlers
	handlers := &app.Handlers{
		User:       user.NewHandler(userService),
		Permission: permission.NewHandler(permService),
	}

	// 8. Build Application
	_ = &app.Application{
		Config:       cfg,
		DB:           db,
		JWTService:   jwtService,
		EmailService: emailService,
		Handlers:     handlers,
	}

	// 9. Setup Router
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(gin.Recovery())
	routes.Setup(r, handlers)

	return r
}

// NewTestCase is a shortcut to create a test case with the setup app
func NewTestCase(t *testing.T) *test_platform.TestCase {
	engine := SetupApp()
	return test_platform.NewTestCase(t, engine)
}
