package bootstrap

import (
	"github.com/kest-labs/kest/api/pkg/logger"
)

// InitLogger initializes the logger.
// Called before Wire initialization since logger is used during startup.
func InitLogger() {
	logger.Boot()
}
