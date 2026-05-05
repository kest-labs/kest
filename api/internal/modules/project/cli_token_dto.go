package project

import "time"

type GenerateProjectCLITokenRequest struct {
	Name      string     `json:"name" binding:"omitempty,max=100"`
	Scopes    []string   `json:"scopes"`
	ExpiresAt *time.Time `json:"expires_at"`
}

type ProjectCLITokenResponse struct {
	ID          string     `json:"id"`
	ProjectID   string     `json:"project_id"`
	Name        string     `json:"name"`
	TokenPrefix string     `json:"token_prefix"`
	Scopes      []string   `json:"scopes"`
	LastUsedAt  *time.Time `json:"last_used_at,omitempty"`
	ExpiresAt   *time.Time `json:"expires_at,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
}

type GenerateProjectCLITokenResponse struct {
	Token     string                   `json:"token"`
	TokenType string                   `json:"token_type"`
	ProjectID string                   `json:"project_id"`
	TokenInfo *ProjectCLITokenResponse `json:"token_info"`
}

func toProjectCLITokenResponse(token *ProjectCLIToken) *ProjectCLITokenResponse {
	if token == nil {
		return nil
	}

	return &ProjectCLITokenResponse{
		ID:          token.ID,
		ProjectID:   token.ProjectID,
		Name:        token.Name,
		TokenPrefix: token.TokenPrefix,
		Scopes:      token.Scopes,
		LastUsedAt:  token.LastUsedAt,
		ExpiresAt:   token.ExpiresAt,
		CreatedAt:   token.CreatedAt,
	}
}
