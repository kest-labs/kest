package environment

import (
	"encoding/json"
	"time"
)

// CreateEnvironmentRequest represents the request to create an environment
type CreateEnvironmentRequest struct {
	ProjectID   uint                   `json:"project_id"`
	Name        string                 `json:"name" binding:"required,max=50"`
	DisplayName string                 `json:"display_name,omitempty" binding:"max=100"`
	BaseURL     string                 `json:"base_url,omitempty" binding:"max=500"`
	Variables   map[string]interface{} `json:"variables,omitempty"`
	Headers     map[string]string      `json:"headers,omitempty"`
}

// UpdateEnvironmentRequest represents the request to update an environment
type UpdateEnvironmentRequest struct {
	Name        *string                 `json:"name,omitempty" binding:"omitempty,max=50"`
	DisplayName *string                 `json:"display_name,omitempty" binding:"omitempty,max=100"`
	BaseURL     *string                 `json:"base_url,omitempty" binding:"omitempty,max=500"`
	Variables   *map[string]interface{} `json:"variables,omitempty"`
	Headers     *map[string]string      `json:"headers,omitempty"`
}

// EnvironmentResponse represents the response for an environment
type EnvironmentResponse struct {
	ID          uint                   `json:"id"`
	ProjectID   uint                   `json:"project_id"`
	Name        string                 `json:"name"`
	DisplayName string                 `json:"display_name,omitempty"`
	BaseURL     string                 `json:"base_url,omitempty"`
	Variables   map[string]interface{} `json:"variables,omitempty"`
	Headers     map[string]string      `json:"headers,omitempty"`
	CreatedAt   time.Time              `json:"created_at"`
	UpdatedAt   time.Time              `json:"updated_at"`
}

// DuplicateEnvironmentRequest represents the request to duplicate an environment
type DuplicateEnvironmentRequest struct {
	Name         string                  `json:"name" binding:"required,max=50"`
	OverrideVars *map[string]interface{} `json:"override_vars,omitempty"`
}

// ToEnvironmentPO converts CreateEnvironmentRequest to EnvironmentPO
func (r *CreateEnvironmentRequest) ToEnvironmentPO() (*EnvironmentPO, error) {
	env := &EnvironmentPO{
		ProjectID:   r.ProjectID,
		Name:        r.Name,
		DisplayName: r.DisplayName,
		BaseURL:     r.BaseURL,
	}

	// Marshal variables to JSON
	if r.Variables != nil {
		varsJSON, err := json.Marshal(r.Variables)
		if err != nil {
			return nil, err
		}
		env.Variables = string(varsJSON)
	}

	// Marshal headers to JSON
	if r.Headers != nil {
		headersJSON, err := json.Marshal(r.Headers)
		if err != nil {
			return nil, err
		}
		env.Headers = string(headersJSON)
	}

	return env, nil
}

// ToResponse converts EnvironmentPO to EnvironmentResponse
func (po *EnvironmentPO) ToResponse() (*EnvironmentResponse, error) {
	resp := &EnvironmentResponse{
		ID:          po.ID,
		ProjectID:   po.ProjectID,
		Name:        po.Name,
		DisplayName: po.DisplayName,
		BaseURL:     po.BaseURL,
		CreatedAt:   po.CreatedAt,
		UpdatedAt:   po.UpdatedAt,
	}

	// Unmarshal variables
	if po.Variables != "" {
		var vars map[string]interface{}
		if err := json.Unmarshal([]byte(po.Variables), &vars); err != nil {
			return nil, err
		}
		resp.Variables = vars
	}

	// Unmarshal headers
	if po.Headers != "" {
		var headers map[string]string
		if err := json.Unmarshal([]byte(po.Headers), &headers); err != nil {
			return nil, err
		}
		resp.Headers = headers
	}

	return resp, nil
}

// ToResponseList converts a list of EnvironmentPO to EnvironmentResponse
func ToResponseList(pos []*EnvironmentPO) ([]*EnvironmentResponse, error) {
	responses := make([]*EnvironmentResponse, 0, len(pos))
	for _, po := range pos {
		resp, err := po.ToResponse()
		if err != nil {
			return nil, err
		}
		responses = append(responses, resp)
	}
	return responses, nil
}
