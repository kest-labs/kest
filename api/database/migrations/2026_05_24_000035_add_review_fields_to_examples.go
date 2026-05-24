package migrations

import (
	"gorm.io/gorm"

	"github.com/kest-labs/kest/api/internal/infra/migration"
)

func init() {
	register("2026_05_24_000035_add_review_fields_to_examples", &addReviewFieldsToExamples{})
}

type addReviewFieldsToExamples struct {
	migration.BaseMigration
}

func (m *addReviewFieldsToExamples) Up(db *gorm.DB) error {
	if err := addColumnIfMissing(db, "examples", "category", "VARCHAR(32) DEFAULT 'general'"); err != nil {
		return err
	}
	if err := addColumnIfMissing(db, "examples", "source", "VARCHAR(20) DEFAULT 'manual'"); err != nil {
		return err
	}
	if err := addColumnIfMissing(db, "examples", "assertions", "TEXT"); err != nil {
		return err
	}
	return nil
}

func (m *addReviewFieldsToExamples) Down(db *gorm.DB) error {
	if err := dropColumnIfExists(db, "examples", "assertions"); err != nil {
		return err
	}
	if err := dropColumnIfExists(db, "examples", "source"); err != nil {
		return err
	}
	if err := dropColumnIfExists(db, "examples", "category"); err != nil {
		return err
	}
	return nil
}
