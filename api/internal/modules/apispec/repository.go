package apispec

import (
	"context"
	"strings"

	"github.com/kest-labs/kest/api/pkg/dbutil"
	"gorm.io/gorm"
)

// SpecListFilter holds filter parameters for listing API specs
type SpecListFilter struct {
	ProjectID string
	Version   string
	Method    string // GET, POST, PUT, etc.
	Tag       string // filter by tag (partial match)
	Keyword   string // search in path, summary, description
	Page      int
	PageSize  int
}

// Repository defines API specification data access interface
type Repository interface {
	// API Spec operations
	CreateSpec(ctx context.Context, spec *APISpecPO) error
	GetSpecByID(ctx context.Context, id string) (*APISpecPO, error)
	GetSpecByIDAndProject(ctx context.Context, id, projectID string) (*APISpecPO, error)
	GetSpecByMethodAndPath(ctx context.Context, projectID string, method, path string) (*APISpecPO, error)
	UpdateSpec(ctx context.Context, spec *APISpecPO) error
	DeleteSpec(ctx context.Context, id string) error
	ListSpecs(ctx context.Context, filter *SpecListFilter) ([]*APISpecPO, int64, error)
	ListAllSpecs(ctx context.Context, projectID string) ([]*APISpecPO, error)
	ListSpecsForBatchGen(ctx context.Context, projectID string, categoryID *string, forceRegen bool) ([]*APISpecPO, error)

	// API Example operations
	CreateExample(ctx context.Context, example *APIExamplePO) error
	GetExamplesBySpecID(ctx context.Context, specID string) ([]*APIExamplePO, error)
	GetExampleByID(ctx context.Context, id string) (*APIExamplePO, error)
	DeleteExample(ctx context.Context, id string) error

	// AI draft operations
	CreateAIDraft(ctx context.Context, draft *APISpecAIDraftPO) error
	GetAIDraftByIDAndProject(ctx context.Context, id, projectID string) (*APISpecAIDraftPO, error)
	UpdateAIDraft(ctx context.Context, draft *APISpecAIDraftPO) error

	// Share operations
	CreateShare(ctx context.Context, share *APISpecSharePO) error
	UpdateShare(ctx context.Context, share *APISpecSharePO) error
	GetShareBySpecID(ctx context.Context, projectID, specID string) (*APISpecSharePO, error)
	GetShareBySlug(ctx context.Context, slug string) (*APISpecSharePO, error)
	DeleteShareBySpecID(ctx context.Context, projectID, specID string) error
}

// repository is the private implementation
type repository struct {
	db *gorm.DB
}

// NewRepository creates a new API spec repository
func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

// ========== API Spec Operations ==========

func (r *repository) CreateSpec(ctx context.Context, spec *APISpecPO) error {
	return r.db.WithContext(ctx).Create(spec).Error
}

func (r *repository) GetSpecByID(ctx context.Context, id string) (*APISpecPO, error) {
	var spec APISpecPO
	if err := dbutil.ByID(r.db.WithContext(ctx), id).First(&spec).Error; err != nil {
		return nil, err
	}
	return &spec, nil
}

func (r *repository) GetSpecByIDAndProject(ctx context.Context, id, projectID string) (*APISpecPO, error) {
	var spec APISpecPO
	if err := r.db.WithContext(ctx).
		Where("id = ? AND project_id = ?", id, projectID).
		First(&spec).Error; err != nil {
		return nil, err
	}
	return &spec, nil
}

func (r *repository) GetSpecByMethodAndPath(ctx context.Context, projectID string, method, path string) (*APISpecPO, error) {
	var spec APISpecPO
	if err := r.db.WithContext(ctx).
		Where("project_id = ? AND method = ? AND path = ?", projectID, method, path).
		First(&spec).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}
	return &spec, nil
}

func (r *repository) UpdateSpec(ctx context.Context, spec *APISpecPO) error {
	return r.db.WithContext(ctx).Save(spec).Error
}

func (r *repository) DeleteSpec(ctx context.Context, id string) error {
	return dbutil.DeleteByID(r.db.WithContext(ctx), &APISpecPO{}, id).Error
}

func (r *repository) ListSpecs(ctx context.Context, filter *SpecListFilter) ([]*APISpecPO, int64, error) {
	var specs []*APISpecPO
	var total int64

	query := r.db.WithContext(ctx).Model(&APISpecPO{}).Where("project_id = ?", filter.ProjectID)

	if filter.Version != "" {
		query = query.Where("version = ?", filter.Version)
	}
	if filter.Method != "" {
		query = query.Where("method = ?", strings.ToUpper(filter.Method))
	}
	if filter.Tag != "" {
		query = query.Where("tags LIKE ?", "%"+filter.Tag+"%")
	}
	if filter.Keyword != "" {
		kw := "%" + filter.Keyword + "%"
		query = query.Where("path LIKE ? OR summary LIKE ? OR description LIKE ?", kw, kw, kw)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	page, pageSize := filter.Page, filter.PageSize
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize
	if err := query.Offset(offset).Limit(pageSize).Order("id DESC").Find(&specs).Error; err != nil {
		return nil, 0, err
	}

	return specs, total, nil
}

func (r *repository) ListAllSpecs(ctx context.Context, projectID string) ([]*APISpecPO, error) {
	var specs []*APISpecPO
	if err := r.db.WithContext(ctx).
		Where("project_id = ?", projectID).
		Order("method ASC, path ASC").
		Find(&specs).Error; err != nil {
		return nil, err
	}
	return specs, nil
}

// ListSpecsForBatchGen returns specs eligible for batch generation.
// If forceRegen is false, only specs with no existing doc are returned.
func (r *repository) ListSpecsForBatchGen(ctx context.Context, projectID string, categoryID *string, forceRegen bool) ([]*APISpecPO, error) {
	var specs []*APISpecPO
	query := r.db.WithContext(ctx).Where("project_id = ?", projectID)
	if categoryID != nil {
		query = query.Where("category_id = ?", *categoryID)
	}
	if !forceRegen {
		query = query.Where("doc_source IS NULL OR doc_source = ''")
	}
	if err := query.Order("id ASC").Find(&specs).Error; err != nil {
		return nil, err
	}
	return specs, nil
}

// ========== API Example Operations ==========

func (r *repository) CreateExample(ctx context.Context, example *APIExamplePO) error {
	return r.db.WithContext(ctx).Create(example).Error
}

func (r *repository) GetExamplesBySpecID(ctx context.Context, specID string) ([]*APIExamplePO, error) {
	var examples []*APIExamplePO
	if err := r.db.WithContext(ctx).
		Where("api_spec_id = ?", specID).
		Order("id DESC").
		Find(&examples).Error; err != nil {
		return nil, err
	}
	return examples, nil
}

func (r *repository) GetExampleByID(ctx context.Context, id string) (*APIExamplePO, error) {
	var example APIExamplePO
	if err := dbutil.ByID(r.db.WithContext(ctx), id).First(&example).Error; err != nil {
		return nil, err
	}
	return &example, nil
}

func (r *repository) DeleteExample(ctx context.Context, id string) error {
	return dbutil.DeleteByID(r.db.WithContext(ctx), &APIExamplePO{}, id).Error
}

// ========== AI Draft Operations ==========

func (r *repository) CreateAIDraft(ctx context.Context, draft *APISpecAIDraftPO) error {
	return r.db.WithContext(ctx).Create(draft).Error
}

func (r *repository) GetAIDraftByIDAndProject(ctx context.Context, id, projectID string) (*APISpecAIDraftPO, error) {
	var draft APISpecAIDraftPO
	if err := r.db.WithContext(ctx).
		Where("id = ? AND project_id = ?", id, projectID).
		First(&draft).Error; err != nil {
		return nil, err
	}
	return &draft, nil
}

func (r *repository) UpdateAIDraft(ctx context.Context, draft *APISpecAIDraftPO) error {
	return r.db.WithContext(ctx).Save(draft).Error
}

// ========== Share Operations ==========

func (r *repository) CreateShare(ctx context.Context, share *APISpecSharePO) error {
	return r.db.WithContext(ctx).Create(share).Error
}

func (r *repository) UpdateShare(ctx context.Context, share *APISpecSharePO) error {
	return r.db.WithContext(ctx).Save(share).Error
}

func (r *repository) GetShareBySpecID(ctx context.Context, projectID, specID string) (*APISpecSharePO, error) {
	var share APISpecSharePO
	if err := r.db.WithContext(ctx).
		Where("project_id = ? AND api_spec_id = ?", projectID, specID).
		First(&share).Error; err != nil {
		return nil, err
	}
	return &share, nil
}

func (r *repository) GetShareBySlug(ctx context.Context, slug string) (*APISpecSharePO, error) {
	var share APISpecSharePO
	if err := r.db.WithContext(ctx).
		Where("slug = ?", slug).
		First(&share).Error; err != nil {
		return nil, err
	}
	return &share, nil
}

func (r *repository) DeleteShareBySpecID(ctx context.Context, projectID, specID string) error {
	return r.db.WithContext(ctx).
		Where("project_id = ? AND api_spec_id = ?", projectID, specID).
		Delete(&APISpecSharePO{}).Error
}
