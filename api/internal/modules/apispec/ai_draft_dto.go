package apispec

import (
	"encoding/json"
	"time"
)

type APISpecAIDraftSpec struct {
	CategoryID  *uint                   `json:"category_id,omitempty"`
	Method      string                  `json:"method"`
	Path        string                  `json:"path"`
	Summary     string                  `json:"summary"`
	Description string                  `json:"description"`
	Tags        []string                `json:"tags,omitempty"`
	RequestBody *RequestBodySpec        `json:"request_body,omitempty"`
	Parameters  []ParameterSpec         `json:"parameters,omitempty"`
	Responses   map[string]ResponseSpec `json:"responses,omitempty"`
	Version     string                  `json:"version"`
	IsPublic    bool                    `json:"is_public"`
}

type APISpecAIDraftFieldInsight struct {
	Source     string  `json:"source"`
	Confidence float64 `json:"confidence"`
}

type APISpecAIDraftReference struct {
	ID       uint     `json:"id"`
	Method   string   `json:"method"`
	Path     string   `json:"path"`
	Summary  string   `json:"summary"`
	Version  string   `json:"version"`
	Tags     []string `json:"tags,omitempty"`
	Explicit bool     `json:"explicit"`
	Score    float64  `json:"score"`
}

type APISpecAIDraftConventions struct {
	AuthStyle             string              `json:"auth_style,omitempty"`
	DefaultVersion        string              `json:"default_version,omitempty"`
	CommonVersions        []string            `json:"common_versions,omitempty"`
	CommonTags            []string            `json:"common_tags,omitempty"`
	SuccessEnvelopeKeys   []string            `json:"success_envelope_keys,omitempty"`
	ErrorEnvelopeKeys     []string            `json:"error_envelope_keys,omitempty"`
	MethodSuccessStatuses map[string][]string `json:"method_success_statuses,omitempty"`
}

type CreateAPISpecAIDraftRequest struct {
	Intent                string `json:"intent" binding:"required"`
	Method                string `json:"method" binding:"omitempty,oneof=GET POST PUT DELETE PATCH HEAD OPTIONS"`
	Path                  string `json:"path" binding:"omitempty,max=500"`
	CategoryID            *uint  `json:"category_id"`
	UseProjectConventions *bool  `json:"use_project_conventions"`
	ReferenceSpecIDs      []uint `json:"reference_spec_ids"`
	Lang                  string `json:"lang" binding:"omitempty,oneof=en zh"`
}

type RefineAPISpecAIDraftRequest struct {
	Instruction  string              `json:"instruction" binding:"required"`
	Fields       []string            `json:"fields"`
	CurrentDraft *APISpecAIDraftSpec `json:"current_draft"`
	Lang         string              `json:"lang" binding:"omitempty,oneof=en zh"`
}

type AcceptAPISpecAIDraftRequest struct {
	Overrides    *APISpecAIDraftSpec `json:"overrides"`
	GenerateDoc  bool                `json:"generate_doc"`
	GenerateTest bool                `json:"generate_test"`
	Lang         string              `json:"lang" binding:"omitempty,oneof=en zh"`
}

type APISpecAIDraftResponse struct {
	ID             uint                                  `json:"id"`
	ProjectID      uint                                  `json:"project_id"`
	CreatedBy      uint                                  `json:"created_by"`
	AcceptedSpecID *uint                                 `json:"accepted_spec_id,omitempty"`
	Status         string                                `json:"status"`
	Intent         string                                `json:"intent"`
	SeedInput      CreateAPISpecAIDraftRequest           `json:"seed_input"`
	Draft          APISpecAIDraftSpec                    `json:"draft"`
	References     []APISpecAIDraftReference             `json:"references,omitempty"`
	Assumptions    []string                              `json:"assumptions,omitempty"`
	Questions      []string                              `json:"questions,omitempty"`
	FieldInsights  map[string]APISpecAIDraftFieldInsight `json:"field_insights,omitempty"`
	Conventions    *APISpecAIDraftConventions            `json:"conventions,omitempty"`
	CreatedAt      time.Time                             `json:"created_at"`
	UpdatedAt      time.Time                             `json:"updated_at"`
}

type AcceptAPISpecAIDraftResponse struct {
	DraftID       uint             `json:"draft_id"`
	Spec          *APISpecResponse `json:"spec"`
	GeneratedTest string           `json:"generated_test,omitempty"`
	Warnings      []string         `json:"warnings,omitempty"`
}

func marshalAIDraftJSON(value interface{}) (string, error) {
	if value == nil {
		return "", nil
	}

	payload, err := json.Marshal(value)
	if err != nil {
		return "", err
	}

	return string(payload), nil
}

func fromAIDraftPO(po *APISpecAIDraftPO) (*APISpecAIDraftResponse, error) {
	if po == nil {
		return nil, nil
	}

	resp := &APISpecAIDraftResponse{
		ID:             po.ID,
		ProjectID:      po.ProjectID,
		CreatedBy:      po.CreatedBy,
		AcceptedSpecID: po.AcceptedSpecID,
		Status:         po.Status,
		Intent:         po.Intent,
		CreatedAt:      po.CreatedAt,
		UpdatedAt:      po.UpdatedAt,
	}

	if po.SeedInput != "" {
		if err := json.Unmarshal([]byte(po.SeedInput), &resp.SeedInput); err != nil {
			return nil, err
		}
	}
	if po.Draft != "" {
		if err := json.Unmarshal([]byte(po.Draft), &resp.Draft); err != nil {
			return nil, err
		}
	}
	if po.References != "" {
		if err := json.Unmarshal([]byte(po.References), &resp.References); err != nil {
			return nil, err
		}
	}
	if po.Assumptions != "" {
		if err := json.Unmarshal([]byte(po.Assumptions), &resp.Assumptions); err != nil {
			return nil, err
		}
	}
	if po.Questions != "" {
		if err := json.Unmarshal([]byte(po.Questions), &resp.Questions); err != nil {
			return nil, err
		}
	}
	if po.FieldInsights != "" {
		if err := json.Unmarshal([]byte(po.FieldInsights), &resp.FieldInsights); err != nil {
			return nil, err
		}
	}
	if po.Conventions != "" {
		var conventions APISpecAIDraftConventions
		if err := json.Unmarshal([]byte(po.Conventions), &conventions); err != nil {
			return nil, err
		}
		resp.Conventions = &conventions
	}

	return resp, nil
}

func (draft *APISpecAIDraftSpec) toCreateSpecRequest(projectID uint) *CreateAPISpecRequest {
	if draft == nil {
		return nil
	}

	isPublic := draft.IsPublic

	return &CreateAPISpecRequest{
		ProjectID:   projectID,
		CategoryID:  draft.CategoryID,
		Method:      draft.Method,
		Path:        draft.Path,
		Summary:     draft.Summary,
		Description: draft.Description,
		Tags:        draft.Tags,
		RequestBody: draft.RequestBody,
		Parameters:  draft.Parameters,
		Responses:   draft.Responses,
		Version:     draft.Version,
		IsPublic:    &isPublic,
	}
}
