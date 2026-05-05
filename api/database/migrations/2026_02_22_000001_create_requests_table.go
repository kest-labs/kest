package migrations

import (
	"gorm.io/gorm"

	"github.com/kest-labs/kest/api/internal/infra/migration"
	"github.com/kest-labs/kest/api/internal/modules/request"
)

func init() {
	register("2026_02_22_000001_create_requests_table", &createRequestsTable{})
}

type createRequestsTable struct {
	migration.BaseMigration
}

func (m *createRequestsTable) Up(db *gorm.DB) error {
	return db.AutoMigrate(&request.RequestPO{})
}

func (m *createRequestsTable) Down(db *gorm.DB) error {
	return db.Migrator().DropTable("requests")
}
