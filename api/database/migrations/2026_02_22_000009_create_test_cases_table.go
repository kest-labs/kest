package migrations

import (
	"gorm.io/gorm"

	"github.com/kest-labs/kest/api/internal/infra/migration"
	"github.com/kest-labs/kest/api/internal/modules/testcase"
)

func init() {
	register("2026_02_22_000009_create_test_cases_table", &createTestCasesTable{})
}

type createTestCasesTable struct {
	migration.BaseMigration
}

func (m *createTestCasesTable) Up(db *gorm.DB) error {
	return db.AutoMigrate(&testcase.TestCasePO{})
}

func (m *createTestCasesTable) Down(db *gorm.DB) error {
	return db.Migrator().DropTable("test_cases")
}
