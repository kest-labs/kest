package project

import (
	"time"

	"gorm.io/gorm"
)

// ProjectPO is the persistent object for database operations
type ProjectPO struct {
	ID        uint `gorm:"primaryKey"`
	CreatedAt time.Time
	UpdatedAt time.Time
	DeletedAt gorm.DeletedAt `gorm:"index"`
	Name      string         `gorm:"size:100;not null"`
	Slug      string         `gorm:"size:50;uniqueIndex"`
	Platform  string         `gorm:"size:50"`   // go, javascript, python, etc.
	Status    int            `gorm:"default:1"` // 1: active, 0: disabled
}

// TableName specifies the database table name
func (ProjectPO) TableName() string {
	return "projects"
}

// Project is the domain entity used in service layer
type Project struct {
	ID        uint      `json:"id"`
	Name      string    `json:"name"`
	Slug      string    `json:"slug"`
	Platform  string    `json:"platform"`
	Status    int       `json:"status"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// toDomain converts ProjectPO to Project domain entity
func (po *ProjectPO) toDomain() *Project {
	if po == nil {
		return nil
	}
	return &Project{
		ID:        po.ID,
		Name:      po.Name,
		Slug:      po.Slug,
		Platform:  po.Platform,
		Status:    po.Status,
		CreatedAt: po.CreatedAt,
		UpdatedAt: po.UpdatedAt,
	}
}

// newProjectPO converts Project domain to ProjectPO for database operations
func newProjectPO(p *Project) *ProjectPO {
	if p == nil {
		return nil
	}
	return &ProjectPO{
		ID:       p.ID,
		Name:     p.Name,
		Slug:     p.Slug,
		Platform: p.Platform,
		Status:   p.Status,
	}
}

// toDomainList converts a slice of ProjectPO to Project slice
func toDomainList(poList []*ProjectPO) []*Project {
	result := make([]*Project, len(poList))
	for i, po := range poList {
		result[i] = po.toDomain()
	}
	return result
}
