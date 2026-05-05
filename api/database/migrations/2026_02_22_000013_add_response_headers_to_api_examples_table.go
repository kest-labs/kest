package migrations

import (
	"gorm.io/gorm"

	"github.com/kest-labs/kest/api/internal/infra/migration"
)

func init() {
	register("2026_02_22_000013_add_response_headers_to_api_examples_table", &addResponseHeadersToAPIExamplesTable{})
}

type addResponseHeadersToAPIExamplesTable struct {
	migration.BaseMigration
}

func (m *addResponseHeadersToAPIExamplesTable) Up(db *gorm.DB) error {
	return addColumnIfMissing(db, "api_examples", "response_headers", "TEXT")
}

func (m *addResponseHeadersToAPIExamplesTable) Down(db *gorm.DB) error {
	return dropColumnIfExists(db, "api_examples", "response_headers")
}
