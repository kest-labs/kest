package flow

import (
	"context"

	"gorm.io/gorm"

	"github.com/kest-labs/kest/api/pkg/dbutil"
)

// Repository defines the data access interface for flows
type Repository interface {
	// Flow CRUD
	CreateFlow(ctx context.Context, flow *FlowPO) error
	GetFlowByID(ctx context.Context, id string) (*FlowPO, error)
	ListFlowsByProject(ctx context.Context, projectID string) ([]*FlowPO, error)
	UpdateFlow(ctx context.Context, flow *FlowPO) error
	DeleteFlow(ctx context.Context, id string) error

	// Step CRUD
	CreateStep(ctx context.Context, step *FlowStepPO) error
	GetStepByID(ctx context.Context, id string) (*FlowStepPO, error)
	ListStepsByFlow(ctx context.Context, flowID string) ([]*FlowStepPO, error)
	UpdateStep(ctx context.Context, step *FlowStepPO) error
	DeleteStep(ctx context.Context, id string) error
	DeleteStepsByFlow(ctx context.Context, flowID string) error

	// Edge CRUD
	CreateEdge(ctx context.Context, edge *FlowEdgePO) error
	GetEdgeByID(ctx context.Context, id string) (*FlowEdgePO, error)
	ListEdgesByFlow(ctx context.Context, flowID string) ([]*FlowEdgePO, error)
	UpdateEdge(ctx context.Context, edge *FlowEdgePO) error
	DeleteEdge(ctx context.Context, id string) error
	DeleteEdgesByFlow(ctx context.Context, flowID string) error

	// Run
	CreateRun(ctx context.Context, run *FlowRunPO) error
	GetRunByID(ctx context.Context, id string) (*FlowRunPO, error)
	ListRunsByFlow(ctx context.Context, flowID string) ([]*FlowRunPO, error)
	UpdateRun(ctx context.Context, run *FlowRunPO) error

	// Step Results
	CreateStepResult(ctx context.Context, result *FlowStepResultPO) error
	ListStepResultsByRun(ctx context.Context, runID string) ([]*FlowStepResultPO, error)
	UpdateStepResult(ctx context.Context, result *FlowStepResultPO) error

	// Batch operations
	BatchCreateSteps(ctx context.Context, steps []*FlowStepPO) error
	BatchCreateEdges(ctx context.Context, edges []*FlowEdgePO) error
	WithTransaction(ctx context.Context, fn func(Repository) error) error
}

type repository struct {
	db *gorm.DB
}

// NewRepository creates a new flow repository
func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

// --- Flow ---

func (r *repository) CreateFlow(ctx context.Context, flow *FlowPO) error {
	return r.db.WithContext(ctx).Create(flow).Error
}

func (r *repository) GetFlowByID(ctx context.Context, id string) (*FlowPO, error) {
	var flow FlowPO
	if err := dbutil.ByID(r.db.WithContext(ctx), id).First(&flow).Error; err != nil {
		return nil, err
	}
	return &flow, nil
}

func (r *repository) ListFlowsByProject(ctx context.Context, projectID string) ([]*FlowPO, error) {
	var flows []*FlowPO
	err := r.db.WithContext(ctx).
		Where("project_id = ?", projectID).
		Order("created_at DESC").
		Find(&flows).Error
	return flows, err
}

func (r *repository) UpdateFlow(ctx context.Context, flow *FlowPO) error {
	return r.db.WithContext(ctx).Save(flow).Error
}

func (r *repository) DeleteFlow(ctx context.Context, id string) error {
	return dbutil.DeleteByID(r.db.WithContext(ctx), &FlowPO{}, id).Error
}

// --- Step ---

func (r *repository) CreateStep(ctx context.Context, step *FlowStepPO) error {
	return r.db.WithContext(ctx).Create(step).Error
}

func (r *repository) GetStepByID(ctx context.Context, id string) (*FlowStepPO, error) {
	var step FlowStepPO
	if err := dbutil.ByID(r.db.WithContext(ctx), id).First(&step).Error; err != nil {
		return nil, err
	}
	return &step, nil
}

func (r *repository) ListStepsByFlow(ctx context.Context, flowID string) ([]*FlowStepPO, error) {
	var steps []*FlowStepPO
	err := r.db.WithContext(ctx).
		Where("flow_id = ?", flowID).
		Order("sort_order ASC").
		Find(&steps).Error
	return steps, err
}

func (r *repository) UpdateStep(ctx context.Context, step *FlowStepPO) error {
	return r.db.WithContext(ctx).Save(step).Error
}

func (r *repository) DeleteStep(ctx context.Context, id string) error {
	return dbutil.DeleteByID(r.db.WithContext(ctx), &FlowStepPO{}, id).Error
}

func (r *repository) DeleteStepsByFlow(ctx context.Context, flowID string) error {
	return r.db.WithContext(ctx).Where("flow_id = ?", flowID).Delete(&FlowStepPO{}).Error
}

// --- Edge ---

func (r *repository) CreateEdge(ctx context.Context, edge *FlowEdgePO) error {
	return r.db.WithContext(ctx).Create(edge).Error
}

func (r *repository) GetEdgeByID(ctx context.Context, id string) (*FlowEdgePO, error) {
	var edge FlowEdgePO
	if err := dbutil.ByID(r.db.WithContext(ctx), id).First(&edge).Error; err != nil {
		return nil, err
	}
	return &edge, nil
}

func (r *repository) ListEdgesByFlow(ctx context.Context, flowID string) ([]*FlowEdgePO, error) {
	var edges []*FlowEdgePO
	err := r.db.WithContext(ctx).
		Where("flow_id = ?", flowID).
		Find(&edges).Error
	return edges, err
}

func (r *repository) UpdateEdge(ctx context.Context, edge *FlowEdgePO) error {
	return r.db.WithContext(ctx).Save(edge).Error
}

func (r *repository) DeleteEdge(ctx context.Context, id string) error {
	return dbutil.DeleteByID(r.db.WithContext(ctx), &FlowEdgePO{}, id).Error
}

func (r *repository) DeleteEdgesByFlow(ctx context.Context, flowID string) error {
	return r.db.WithContext(ctx).Where("flow_id = ?", flowID).Delete(&FlowEdgePO{}).Error
}

// --- Run ---

func (r *repository) CreateRun(ctx context.Context, run *FlowRunPO) error {
	return r.db.WithContext(ctx).Create(run).Error
}

func (r *repository) GetRunByID(ctx context.Context, id string) (*FlowRunPO, error) {
	var run FlowRunPO
	if err := dbutil.ByID(r.db.WithContext(ctx), id).First(&run).Error; err != nil {
		return nil, err
	}
	return &run, nil
}

func (r *repository) ListRunsByFlow(ctx context.Context, flowID string) ([]*FlowRunPO, error) {
	var runs []*FlowRunPO
	err := r.db.WithContext(ctx).
		Where("flow_id = ?", flowID).
		Order("created_at DESC").
		Find(&runs).Error
	return runs, err
}

func (r *repository) UpdateRun(ctx context.Context, run *FlowRunPO) error {
	return r.db.WithContext(ctx).Save(run).Error
}

// --- Step Results ---

func (r *repository) CreateStepResult(ctx context.Context, result *FlowStepResultPO) error {
	return r.db.WithContext(ctx).Create(result).Error
}

func (r *repository) ListStepResultsByRun(ctx context.Context, runID string) ([]*FlowStepResultPO, error) {
	var results []*FlowStepResultPO
	err := r.db.WithContext(ctx).
		Where("run_id = ?", runID).
		Order("created_at ASC").
		Find(&results).Error
	return results, err
}

func (r *repository) UpdateStepResult(ctx context.Context, result *FlowStepResultPO) error {
	return r.db.WithContext(ctx).Save(result).Error
}

// --- Batch ---

func (r *repository) BatchCreateSteps(ctx context.Context, steps []*FlowStepPO) error {
	if len(steps) == 0 {
		return nil
	}
	return r.db.WithContext(ctx).Create(&steps).Error
}

func (r *repository) BatchCreateEdges(ctx context.Context, edges []*FlowEdgePO) error {
	if len(edges) == 0 {
		return nil
	}
	return r.db.WithContext(ctx).Create(&edges).Error
}

func (r *repository) WithTransaction(ctx context.Context, fn func(Repository) error) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		return fn(&repository{db: tx})
	})
}
