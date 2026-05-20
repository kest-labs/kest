package flow

import (
	"time"

	"gorm.io/gorm"
)

// FlowPO represents a test flow (scenario) in the database
type FlowPO struct {
	ID          string         `gorm:"primaryKey" json:"id"`
	WorkspaceID string         `gorm:"column:workspace_id;not null;index:idx_flows_workspace" json:"workspace_id"`
	Name        string         `gorm:"size:255;not null" json:"name"`
	Description string         `gorm:"type:text" json:"description"`
	CreatedBy   string         `gorm:"not null" json:"created_by"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName returns the table name for FlowPO
func (FlowPO) TableName() string {
	return "api_flows"
}

// FlowStepPO represents a single step (node) in a flow
type FlowStepPO struct {
	ID        string         `gorm:"primaryKey" json:"id"`
	FlowID    string         `gorm:"not null;index:idx_flow_steps_flow" json:"flow_id"`
	ClientKey string         `gorm:"size:128;not null;default:'';index:idx_flow_steps_client_key" json:"client_key"`
	Name      string         `gorm:"size:255;not null" json:"name"`
	SortOrder int            `gorm:"default:0" json:"sort_order"`
	Method    string         `gorm:"size:10;not null" json:"method"`
	URL       string         `gorm:"size:500;not null" json:"url"`
	Headers   string         `gorm:"type:text" json:"headers"`
	Body      string         `gorm:"type:text" json:"body"`
	Captures  string         `gorm:"type:text" json:"captures"`
	Asserts   string         `gorm:"type:text" json:"asserts"`
	PositionX float64        `gorm:"default:0" json:"position_x"`
	PositionY float64        `gorm:"default:0" json:"position_y"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName returns the table name for FlowStepPO
func (FlowStepPO) TableName() string {
	return "api_flow_steps"
}

// FlowEdgePO represents a connection between two steps
type FlowEdgePO struct {
	ID              string         `gorm:"primaryKey" json:"id"`
	FlowID          string         `gorm:"not null;index:idx_flow_edges_flow" json:"flow_id"`
	SourceStepID    string         `gorm:"not null" json:"source_step_id"`
	TargetStepID    string         `gorm:"not null" json:"target_step_id"`
	VariableMapping string         `gorm:"type:text" json:"variable_mapping"`
	CreatedAt       time.Time      `json:"created_at"`
	UpdatedAt       time.Time      `json:"updated_at"`
	DeletedAt       gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName returns the table name for FlowEdgePO
func (FlowEdgePO) TableName() string {
	return "api_flow_edges"
}

// FlowRunPO represents a single execution of a flow
type FlowRunPO struct {
	ID          string         `gorm:"primaryKey" json:"id"`
	FlowID      string         `gorm:"not null;index:idx_flow_runs_flow" json:"flow_id"`
	Status      string         `gorm:"size:20;not null;default:'pending'" json:"status"`
	TriggeredBy string         `gorm:"not null" json:"triggered_by"`
	StartedAt   *time.Time     `json:"started_at"`
	FinishedAt  *time.Time     `json:"finished_at"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName returns the table name for FlowRunPO
func (FlowRunPO) TableName() string {
	return "api_flow_runs"
}

// FlowStepResultPO represents the result of a single step execution
type FlowStepResultPO struct {
	ID                string         `gorm:"primaryKey" json:"id"`
	RunID             string         `gorm:"not null;index:idx_flow_step_results_run" json:"run_id"`
	StepID            string         `gorm:"not null" json:"step_id"`
	Status            string         `gorm:"size:20;not null;default:'pending'" json:"status"`
	Request           string         `gorm:"type:text" json:"request"`
	Response          string         `gorm:"type:text" json:"response"`
	AssertResults     string         `gorm:"type:text" json:"assert_results"`
	DurationMs        int64          `gorm:"default:0" json:"duration_ms"`
	VariablesCaptured string         `gorm:"type:text" json:"variables_captured"`
	ErrorMessage      string         `gorm:"type:text" json:"error_message"`
	CreatedAt         time.Time      `json:"created_at"`
	UpdatedAt         time.Time      `json:"updated_at"`
	DeletedAt         gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName returns the table name for FlowStepResultPO
func (FlowStepResultPO) TableName() string {
	return "api_flow_step_results"
}

// Run status constants
const (
	RunStatusPending  = "pending"
	RunStatusRunning  = "running"
	RunStatusPassed   = "passed"
	RunStatusFailed   = "failed"
	RunStatusCanceled = "canceled"
)
