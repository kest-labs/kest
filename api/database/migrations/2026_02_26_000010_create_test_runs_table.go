package migrations

import (
	"gorm.io/gorm"

	"github.com/kest-labs/kest/api/internal/infra/migration"
	"github.com/kest-labs/kest/api/internal/modules/apispec"
	"github.com/kest-labs/kest/api/internal/modules/testcase"
)

func init() {
	register("2026_02_26_000010_create_test_runs_table", &createTestRunsTable{})
}

type createTestRunsTable struct {
	migration.BaseMigration
}

func (m *createTestRunsTable) Up(db *gorm.DB) error {
	if err := db.AutoMigrate(&testcase.TestRunPO{}); err != nil {
		return err
	}
	// Add test_content, test_source, test_updated_at columns to api_specs
	return db.AutoMigrate(&apispec.APISpecPO{})
}

func (m *createTestRunsTable) Down(db *gorm.DB) error {
	return db.Migrator().DropTable("test_runs")
}
