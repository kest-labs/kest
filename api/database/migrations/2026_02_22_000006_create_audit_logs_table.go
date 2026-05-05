package migrations

import (
	"gorm.io/gorm"

	"github.com/kest-labs/kest/api/internal/infra/migration"
	"github.com/kest-labs/kest/api/internal/modules/audit"
)

func init() {
	register("2026_02_22_000006_create_audit_logs_table", &createAuditLogsTable{})
}

type createAuditLogsTable struct {
	migration.BaseMigration
}

func (m *createAuditLogsTable) Up(db *gorm.DB) error {
	return db.AutoMigrate(&audit.AuditLogPO{})
}

func (m *createAuditLogsTable) Down(db *gorm.DB) error {
	return db.Migrator().DropTable("audit_logs")
}
