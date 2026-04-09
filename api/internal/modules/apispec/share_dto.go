package apispec

import (
	"encoding/json"
	"time"
)

// APISpecShareResponse is the internal management view for a published share.
type APISpecShareResponse struct {
	ID        uint      `json:"id"`
	ProjectID uint      `json:"project_id"`
	APISpecID uint      `json:"api_spec_id"`
	Slug      string    `json:"slug"`
	CreatedBy uint      `json:"created_by"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// PublicAPISpecShareResponse is the anonymous payload used by the public share page.
type PublicAPISpecShareResponse struct {
	Slug      string    `json:"slug"`
	SharedAt  time.Time `json:"shared_at"`
	UpdatedAt time.Time `json:"updated_at"`
	PublicAPISpecShareSnapshot
}

func fromAPISpecSharePO(po *APISpecSharePO) *APISpecShareResponse {
	if po == nil {
		return nil
	}

	return &APISpecShareResponse{
		ID:        po.ID,
		ProjectID: po.ProjectID,
		APISpecID: po.APISpecID,
		Slug:      po.Slug,
		CreatedBy: po.CreatedBy,
		CreatedAt: po.CreatedAt,
		UpdatedAt: po.UpdatedAt,
	}
}

func buildPublicShareSnapshot(spec *APISpecPO) *PublicAPISpecShareSnapshot {
	if spec == nil {
		return nil
	}

	resp := FromAPISpecPO(spec)
	return &PublicAPISpecShareSnapshot{
		Method:         resp.Method,
		Path:           resp.Path,
		Summary:        resp.Summary,
		Description:    resp.Description,
		DocMarkdown:    resp.DocMarkdown,
		DocMarkdownZh:  resp.DocMarkdownZh,
		DocMarkdownEn:  resp.DocMarkdownEn,
		DocSource:      resp.DocSource,
		DocUpdatedAt:   resp.DocUpdatedAt,
		DocUpdatedAtZh: resp.DocUpdatedAtZh,
		DocUpdatedAtEn: resp.DocUpdatedAtEn,
		Tags:           resp.Tags,
		RequestBody:    resp.RequestBody,
		Parameters:     resp.Parameters,
		Responses:      resp.Responses,
		Version:        resp.Version,
	}
}

func marshalPublicShareSnapshot(spec *APISpecPO) (string, error) {
	snapshot := buildPublicShareSnapshot(spec)
	if snapshot == nil {
		return "", nil
	}

	encoded, err := json.Marshal(snapshot)
	if err != nil {
		return "", err
	}

	return string(encoded), nil
}

func toPublicAPISpecShareResponse(po *APISpecSharePO) (*PublicAPISpecShareResponse, error) {
	if po == nil {
		return nil, nil
	}

	var snapshot PublicAPISpecShareSnapshot
	if err := json.Unmarshal([]byte(po.Snapshot), &snapshot); err != nil {
		return nil, err
	}

	return &PublicAPISpecShareResponse{
		Slug:                       po.Slug,
		SharedAt:                   po.CreatedAt,
		UpdatedAt:                  po.UpdatedAt,
		PublicAPISpecShareSnapshot: snapshot,
	}, nil
}
