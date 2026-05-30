package migrations

import (
	"fmt"

	"gorm.io/gorm"
)

func addColumnIfMissing(db *gorm.DB, table, column, definition string) error {
	if !db.Migrator().HasTable(table) || db.Migrator().HasColumn(table, column) {
		return nil
	}

	return db.Exec(
		fmt.Sprintf("ALTER TABLE %s ADD COLUMN %s %s", table, column, definition),
	).Error
}

func dropColumnIfExists(db *gorm.DB, table, column string) error {
	if !db.Migrator().HasTable(table) || !db.Migrator().HasColumn(table, column) {
		return nil
	}

	return db.Exec(
		fmt.Sprintf("ALTER TABLE %s DROP COLUMN %s", table, column),
	).Error
}

func createIndexIfMissing(db *gorm.DB, table, index, definition string) error {
	if !db.Migrator().HasTable(table) || db.Migrator().HasIndex(table, index) {
		return nil
	}

	return db.Exec(
		fmt.Sprintf("CREATE INDEX IF NOT EXISTS %s ON %s (%s)", index, table, definition),
	).Error
}
