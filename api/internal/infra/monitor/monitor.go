package monitor

import (
	"runtime"
	"time"

	"github.com/kest-labs/kest/api/internal/infra/config"
	"github.com/kest-labs/kest/api/internal/infra/container"
	"gorm.io/gorm"
)

var StartTime = time.Now()

type Stats struct {
	App      AppStats       `json:"app"`
	System   SystemStats    `json:"system"`
	Database ComponentStats `json:"database"`
	Redis    ComponentStats `json:"redis"` // Placeholder for future
}

type AppStats struct {
	Name        string `json:"name"`
	Environment string `json:"environment"`
	Version     string `json:"version"`
	Uptime      string `json:"uptime"`
	GoVersion   string `json:"go_version"`
}

type SystemStats struct {
	Goroutines int    `json:"goroutines"`
	Memory     string `json:"memory"`
	CPU        int    `json:"cpu"`
}

type ComponentStats struct {
	Status  string `json:"status"`
	Message string `json:"message"`
	Latency string `json:"latency"`
}

func GetStats() Stats {
	// Resolve Config safely
	cfg := container.MustResolveAs[*config.Config](container.ServiceConfig)

	stats := Stats{
		App: AppStats{
			Name:        cfg.App.Name,
			Environment: cfg.App.Env,
			Version:     "1.0.0",
			Uptime:      time.Since(StartTime).Round(time.Second).String(),
			GoVersion:   runtime.Version(),
		},
		System: getSystemStats(),
	}

	// Check Database
	if container.App().Has(container.ServiceDB) {
		db := container.MustResolveAs[*gorm.DB](container.ServiceDB)
		if db != nil {
			start := time.Now()
			sqlDB, err := db.DB()
			if err == nil && sqlDB.Ping() == nil {
				stats.Database = ComponentStats{
					Status:  "operational",
					Message: "Connected",
					Latency: time.Since(start).String(),
				}
			} else {
				stats.Database = ComponentStats{
					Status:  "error",
					Message: "Connection failed",
				}
			}
		} else {
			// DB registered but nil (init failed)
			stats.Database = ComponentStats{
				Status:  "error",
				Message: "Initialization failed",
			}
		}
	} else {
		stats.Database = ComponentStats{
			Status:  "disabled",
			Message: "Not initialized",
		}
	}

	return stats
}

func getSystemStats() SystemStats {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)

	return SystemStats{
		Goroutines: runtime.NumGoroutine(),
		Memory:     formatBytes(m.Alloc),
		CPU:        runtime.NumCPU(),
	}
}

func formatBytes(b uint64) string {
	const unit = 1024
	if b < unit {
		return "0 B"
	}
	div, exp := int64(unit), 0
	for n := b / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return string([]byte(time.Duration(b).String())) // Use existing helper? No, just simpler format
}
