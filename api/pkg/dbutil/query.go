package dbutil

import "gorm.io/gorm"

// ByID applies a parameterized primary-key filter that is safe for UUID strings.
func ByID(db *gorm.DB, id any) *gorm.DB {
	return db.Where("id = ?", id)
}

// DeleteByID deletes a model by primary key using a parameterized condition.
func DeleteByID(db *gorm.DB, model any, id any) *gorm.DB {
	return ByID(db, id).Delete(model)
}
