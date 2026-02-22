package migrations

import (
	"github.com/kest-labs/kest/api/internal/infra/migration"
	"gorm.io/gorm"
)

func init() {
	register("2026_02_22_000013_add_response_headers_to_api_examples_table", &addResponseHeadersToAPIExamplesTable{})
}

type addResponseHeadersToAPIExamplesTable struct {
	migration.BaseMigration
}

func (m *addResponseHeadersToAPIExamplesTable) Up(db *gorm.DB) error {
	return db.Exec("ALTER TABLE api_examples ADD COLUMN IF NOT EXISTS response_headers TEXT").Error
}

func (m *addResponseHeadersToAPIExamplesTable) Down(db *gorm.DB) error {
	return db.Exec("ALTER TABLE api_examples DROP COLUMN IF EXISTS response_headers").Error
}
