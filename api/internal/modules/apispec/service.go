package apispec

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"gorm.io/gorm"

	"github.com/kest-labs/kest/api/internal/infra/config"
)

var (
	ErrSpecNotFound      = errors.New("API specification not found")
	ErrSpecAlreadyExists = errors.New("API specification already exists for this method and path")
	ErrInvalidSpecData   = errors.New("invalid API specification data")
	ErrExampleNotFound   = errors.New("API example not found")
	ErrShareNotFound     = errors.New("API specification share not found")
)

// Service defines API specification business logic interface
type Service interface {
	// API Spec operations
	CreateSpec(ctx context.Context, req *CreateAPISpecRequest) (*APISpecResponse, error)
	GetSpecByID(ctx context.Context, projectID, id string) (*APISpecResponse, error)
	UpdateSpec(ctx context.Context, projectID, id string, req *UpdateAPISpecRequest) (*APISpecResponse, error)
	DeleteSpec(ctx context.Context, projectID, id string) error
	ListSpecs(ctx context.Context, filter *SpecListFilter) ([]*APISpecResponse, int64, error)
	GetSpecWithExamples(ctx context.Context, projectID, id string) (*APISpecResponse, error)
	GenDoc(ctx context.Context, projectID, id string, lang string) (*APISpecResponse, error)
	GenTest(ctx context.Context, projectID, id string, lang string) (string, error)

	// API Example operations
	CreateExample(ctx context.Context, projectID string, req *CreateAPIExampleRequest) (*APIExampleResponse, error)
	GetExamplesBySpecID(ctx context.Context, projectID, specID string) ([]*APIExampleResponse, error)
	DeleteExample(ctx context.Context, id string) error

	// AI draft operations
	CreateAIDraft(ctx context.Context, projectID string, userID string, req *CreateAPISpecAIDraftRequest) (*APISpecAIDraftResponse, error)
	CreateAIDraftStream(
		ctx context.Context,
		projectID string,
		userID string,
		req *CreateAPISpecAIDraftRequest,
		callbacks AIDraftStreamCallbacks,
	) (*APISpecAIDraftResponse, error)
	GetAIDraft(ctx context.Context, projectID, draftID string) (*APISpecAIDraftResponse, error)
	RefineAIDraft(ctx context.Context, projectID, draftID string, req *RefineAPISpecAIDraftRequest) (*APISpecAIDraftResponse, error)
	AcceptAIDraft(ctx context.Context, projectID, draftID string, req *AcceptAPISpecAIDraftRequest) (*AcceptAPISpecAIDraftResponse, error)

	// Share operations
	GetShareBySpecID(ctx context.Context, projectID, specID string) (*APISpecShareResponse, error)
	PublishShare(ctx context.Context, projectID, specID string, createdBy string) (*APISpecShareResponse, error)
	DeleteShareBySpecID(ctx context.Context, projectID, specID string) error
	GetPublicShareBySlug(ctx context.Context, slug string) (*PublicAPISpecShareResponse, error)

	// Batch operations
	ImportSpecs(ctx context.Context, projectID string, specs []*CreateAPISpecRequest) error
	SyncSpecsFromCLI(ctx context.Context, projectID string, req *CLISpecSyncInput) (*CLISpecSyncResult, error)
	ExportSpecs(ctx context.Context, projectID string, format string) (interface{}, error)
	BatchGenDoc(ctx context.Context, projectID string, req *BatchGenDocRequest) (*BatchGenDocResponse, error)
}

// service is the private implementation
type service struct {
	repo Repository
}

// NewService creates a new API spec service
func NewService(repo Repository) Service {
	return &service{repo: repo}
}

func (s *service) GenDoc(ctx context.Context, projectID, id string, lang string) (*APISpecResponse, error) {
	po, err := s.getProjectSpec(ctx, projectID, id)
	if err != nil {
		return nil, err
	}

	cfg := config.GlobalConfig
	if cfg == nil || cfg.OpenAI.APIKey == "" {
		return nil, fmt.Errorf("AI documentation generation is not configured (OPENAI_API_KEY missing)")
	}

	client := &llmClient{
		apiKey:  cfg.OpenAI.APIKey,
		baseURL: cfg.OpenAI.BaseURL,
		model:   cfg.OpenAI.Model,
	}

	llmCtx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()

	systemPrompt := getDocSystemPrompt(lang)
	userPrompt := buildDocPrompt(po)
	markdown, err := client.complete(llmCtx, systemPrompt, userPrompt)
	if err != nil {
		return nil, fmt.Errorf("failed to generate documentation: %w", err)
	}

	po.DocMarkdown = markdown
	if lang == "zh" {
		po.DocMarkdownZh = markdown
	} else {
		po.DocMarkdownEn = markdown
	}
	po.DocSource = "ai"
	now := time.Now()
	po.DocUpdatedAt = &now
	if lang == "zh" {
		po.DocUpdatedAtZh = &now
	} else {
		po.DocUpdatedAtEn = &now
	}

	if err := s.repo.UpdateSpec(ctx, po); err != nil {
		return nil, err
	}
	if err := s.syncShareSnapshot(ctx, po); err != nil {
		return nil, err
	}

	return FromAPISpecPO(po), nil
}

func (s *service) GenTest(ctx context.Context, projectID, id string, lang string) (string, error) {
	po, err := s.getProjectSpec(ctx, projectID, id)
	if err != nil {
		return "", err
	}

	cfg := config.GlobalConfig
	if cfg == nil || cfg.OpenAI.APIKey == "" {
		return "", fmt.Errorf("AI test generation is not configured (OPENAI_API_KEY missing)")
	}

	client := &llmClient{
		apiKey:  cfg.OpenAI.APIKey,
		baseURL: cfg.OpenAI.BaseURL,
		model:   cfg.OpenAI.Model,
	}

	llmCtx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()

	systemPrompt := getTestSystemPrompt(lang)
	userPrompt := buildTestPrompt(po)
	flowContent, err := client.complete(llmCtx, systemPrompt, userPrompt)
	if err != nil {
		return "", fmt.Errorf("failed to generate test: %w", err)
	}

	po.TestContent = flowContent
	po.TestSource = "ai"
	now := time.Now()
	po.TestUpdatedAt = &now

	if err := s.repo.UpdateSpec(ctx, po); err != nil {
		return "", err
	}

	return flowContent, nil
}

// ========== API Spec Operations ==========

func (s *service) CreateSpec(ctx context.Context, req *CreateAPISpecRequest) (*APISpecResponse, error) {
	existing, err := s.repo.GetSpecByMethodAndPath(ctx, req.ProjectID, req.Method, req.Path)
	if err == nil && existing != nil {
		return nil, ErrSpecAlreadyExists
	}

	po := ToAPISpecPO(req)
	if err := s.repo.CreateSpec(ctx, po); err != nil {
		return nil, err
	}

	return FromAPISpecPO(po), nil
}

func (s *service) GetSpecByID(ctx context.Context, projectID, id string) (*APISpecResponse, error) {
	po, err := s.getProjectSpec(ctx, projectID, id)
	if err != nil {
		return nil, err
	}
	return FromAPISpecPO(po), nil
}

func (s *service) UpdateSpec(ctx context.Context, projectID, id string, req *UpdateAPISpecRequest) (*APISpecResponse, error) {
	po, err := s.getProjectSpec(ctx, projectID, id)
	if err != nil {
		return nil, err
	}

	if req.Summary != nil {
		po.Summary = *req.Summary
	}
	if req.Description != nil {
		po.Description = *req.Description
	}
	if req.DocMarkdown != nil {
		po.DocMarkdown = *req.DocMarkdown
		now := time.Now()
		po.DocUpdatedAt = &now
		if req.DocSource == nil {
			po.DocSource = "manual"
		}
	}
	if req.DocMarkdownZh != nil {
		po.DocMarkdownZh = *req.DocMarkdownZh
		now := time.Now()
		po.DocUpdatedAtZh = &now
		if req.DocSource == nil {
			po.DocSource = "manual"
		}
	}
	if req.DocMarkdownEn != nil {
		po.DocMarkdownEn = *req.DocMarkdownEn
		now := time.Now()
		po.DocUpdatedAtEn = &now
		if req.DocSource == nil {
			po.DocSource = "manual"
		}
	}
	if req.DocSource != nil {
		po.DocSource = *req.DocSource
	}
	if req.Tags != nil {
		tagsJSON, _ := json.Marshal(req.Tags)
		po.Tags = string(tagsJSON)
	}
	if req.RequestBody != nil {
		reqBodyJSON, _ := json.Marshal(req.RequestBody)
		po.RequestBody = string(reqBodyJSON)
	}
	if req.Parameters != nil {
		paramsJSON, _ := json.Marshal(req.Parameters)
		po.Parameters = string(paramsJSON)
	}
	if req.Responses != nil {
		responsesJSON, _ := json.Marshal(req.Responses)
		po.Responses = string(responsesJSON)
	}
	if req.IsPublic != nil {
		po.IsPublic = *req.IsPublic
	}
	if req.CategoryID != nil {
		po.CategoryID = req.CategoryID
	}

	if err := s.repo.UpdateSpec(ctx, po); err != nil {
		return nil, err
	}
	if err := s.syncShareSnapshot(ctx, po); err != nil {
		return nil, err
	}

	return FromAPISpecPO(po), nil
}

func (s *service) DeleteSpec(ctx context.Context, projectID, id string) error {
	po, err := s.getProjectSpec(ctx, projectID, id)
	if err != nil {
		return err
	}

	if err := s.repo.DeleteShareBySpecID(ctx, projectID, id); err != nil {
		return err
	}

	return s.repo.DeleteSpec(ctx, po.ID)
}

func (s *service) ListSpecs(ctx context.Context, filter *SpecListFilter) ([]*APISpecResponse, int64, error) {
	if filter.Page < 1 {
		filter.Page = 1
	}
	if filter.PageSize < 1 || filter.PageSize > 100 {
		filter.PageSize = 20
	}

	pos, total, err := s.repo.ListSpecs(ctx, filter)
	if err != nil {
		return nil, 0, err
	}

	responses := make([]*APISpecResponse, len(pos))
	for i, po := range pos {
		responses[i] = FromAPISpecPO(po)
	}

	return responses, total, nil
}

func (s *service) GetSpecWithExamples(ctx context.Context, projectID, id string) (*APISpecResponse, error) {
	po, err := s.getProjectSpec(ctx, projectID, id)
	if err != nil {
		return nil, err
	}

	resp := FromAPISpecPO(po)

	examples, err := s.repo.GetExamplesBySpecID(ctx, id)
	if err == nil && len(examples) > 0 {
		resp.Examples = make([]APIExampleResponse, len(examples))
		for i, ex := range examples {
			resp.Examples[i] = *FromAPIExamplePO(ex)
		}
	}

	return resp, nil
}

// ========== API Example Operations ==========

func (s *service) CreateExample(ctx context.Context, projectID string, req *CreateAPIExampleRequest) (*APIExampleResponse, error) {
	if _, err := s.getProjectSpec(ctx, projectID, req.APISpecID); err != nil {
		return nil, err
	}

	po := ToAPIExamplePO(req)
	if err := s.repo.CreateExample(ctx, po); err != nil {
		return nil, err
	}

	return FromAPIExamplePO(po), nil
}

func (s *service) GetExamplesBySpecID(ctx context.Context, projectID, specID string) ([]*APIExampleResponse, error) {
	if _, err := s.getProjectSpec(ctx, projectID, specID); err != nil {
		return nil, err
	}

	examples, err := s.repo.GetExamplesBySpecID(ctx, specID)
	if err != nil {
		return nil, err
	}

	result := make([]*APIExampleResponse, len(examples))
	for i, ex := range examples {
		result[i] = FromAPIExamplePO(ex)
	}
	return result, nil
}

func (s *service) DeleteExample(ctx context.Context, id string) error {
	return s.repo.DeleteExample(ctx, id)
}

// ========== Share Operations ==========

func (s *service) GetShareBySpecID(ctx context.Context, projectID, specID string) (*APISpecShareResponse, error) {
	if _, err := s.getProjectSpec(ctx, projectID, specID); err != nil {
		return nil, err
	}

	share, err := s.repo.GetShareBySpecID(ctx, projectID, specID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrShareNotFound
		}
		return nil, err
	}

	return fromAPISpecSharePO(share), nil
}

func (s *service) PublishShare(ctx context.Context, projectID, specID string, createdBy string) (*APISpecShareResponse, error) {
	spec, err := s.getProjectSpec(ctx, projectID, specID)
	if err != nil {
		return nil, err
	}

	snapshot, err := marshalPublicShareSnapshot(spec)
	if err != nil {
		return nil, err
	}

	existing, err := s.repo.GetShareBySpecID(ctx, projectID, specID)
	if err == nil && existing != nil {
		existing.Snapshot = snapshot
		if err := s.repo.UpdateShare(ctx, existing); err != nil {
			return nil, err
		}
		return fromAPISpecSharePO(existing), nil
	}
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	slug, err := generateShareSlug()
	if err != nil {
		return nil, err
	}

	share := &APISpecSharePO{
		ProjectID: projectID,
		APISpecID: specID,
		Slug:      slug,
		Snapshot:  snapshot,
		CreatedBy: createdBy,
	}
	if err := s.repo.CreateShare(ctx, share); err != nil {
		return nil, err
	}

	return fromAPISpecSharePO(share), nil
}

func (s *service) DeleteShareBySpecID(ctx context.Context, projectID, specID string) error {
	if _, err := s.getProjectSpec(ctx, projectID, specID); err != nil {
		return err
	}

	if _, err := s.repo.GetShareBySpecID(ctx, projectID, specID); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrShareNotFound
		}
		return err
	}

	return s.repo.DeleteShareBySpecID(ctx, projectID, specID)
}

func (s *service) GetPublicShareBySlug(ctx context.Context, slug string) (*PublicAPISpecShareResponse, error) {
	share, err := s.repo.GetShareBySlug(ctx, slug)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrShareNotFound
		}
		return nil, err
	}

	resp, err := toPublicAPISpecShareResponse(share)
	if err != nil {
		return nil, err
	}

	return resp, nil
}

// ========== Batch Operations ==========

func (s *service) ImportSpecs(ctx context.Context, projectID string, specs []*CreateAPISpecRequest) error {
	for _, spec := range specs {
		spec.ProjectID = projectID

		existing, err := s.repo.GetSpecByMethodAndPath(ctx, projectID, spec.Method, spec.Path)
		if err == nil && existing != nil {
			po := ToAPISpecPO(spec)
			po.ID = existing.ID
			po.CreatedAt = existing.CreatedAt
			po.UpdatedAt = existing.UpdatedAt
			if err := s.repo.UpdateSpec(ctx, po); err != nil {
				return err
			}
			if err := s.syncShareSnapshot(ctx, po); err != nil {
				return err
			}
		} else {
			po := ToAPISpecPO(spec)
			if err := s.repo.CreateSpec(ctx, po); err != nil {
				return err
			}
		}
	}
	return nil
}

func (s *service) ExportSpecs(ctx context.Context, projectID string, format string) (interface{}, error) {
	specs, err := s.repo.ListAllSpecs(ctx, projectID)
	if err != nil {
		return nil, err
	}

	switch format {
	case "openapi", "swagger":
		return s.exportToOpenAPI(specs), nil
	case "markdown":
		return s.exportToMarkdown(specs), nil
	default:
		responses := make([]*APISpecResponse, len(specs))
		for i, po := range specs {
			responses[i] = FromAPISpecPO(po)
		}
		return responses, nil
	}
}

// Helper functions for export
func (s *service) exportToOpenAPI(specs []*APISpecPO) map[string]interface{} {
	openapi := map[string]interface{}{
		"openapi": "3.0.0",
		"info": map[string]interface{}{
			"title":   "Generated API Documentation",
			"version": "1.0.0",
		},
		"paths": make(map[string]interface{}),
	}

	paths := openapi["paths"].(map[string]interface{})

	for _, spec := range specs {
		if paths[spec.Path] == nil {
			paths[spec.Path] = make(map[string]interface{})
		}

		pathItem := paths[spec.Path].(map[string]interface{})
		pathItem[strings.ToLower(spec.Method)] = map[string]interface{}{
			"summary":     spec.Summary,
			"description": spec.Description,
			"responses": map[string]interface{}{
				"200": map[string]interface{}{
					"description": "Successful response",
				},
			},
		}
	}

	return openapi
}

func (s *service) exportToMarkdown(specs []*APISpecPO) string {
	var md strings.Builder
	md.WriteString("# API Documentation\n\n")

	for _, spec := range specs {
		md.WriteString(fmt.Sprintf("## %s %s\n\n", spec.Method, spec.Path))
		if spec.Summary != "" {
			md.WriteString(fmt.Sprintf("**Summary**: %s\n\n", spec.Summary))
		}
		if spec.Description != "" {
			md.WriteString(fmt.Sprintf("%s\n\n", spec.Description))
		}
		md.WriteString("---\n\n")
	}

	return md.String()
}

// batchGenConcurrency controls how many LLM calls run in parallel.
const batchGenConcurrency = 3

// BatchGenDoc generates AI documentation for multiple specs concurrently.
// It returns immediately after queuing the work; generation runs in the background.
func (s *service) BatchGenDoc(ctx context.Context, projectID string, req *BatchGenDocRequest) (*BatchGenDocResponse, error) {
	cfg := config.GlobalConfig
	if cfg == nil || cfg.OpenAI.APIKey == "" {
		return nil, fmt.Errorf("AI documentation generation is not configured (OPENAI_API_KEY missing)")
	}

	lang := req.Lang
	if lang == "" {
		lang = "en"
	}

	specs, err := s.repo.ListSpecsForBatchGen(ctx, projectID, req.CategoryID, req.Force)
	if err != nil {
		return nil, err
	}

	var totalInScope int
	if req.Force {
		totalInScope = len(specs)
	} else {
		allSpecs, err := s.repo.ListSpecsForBatchGen(ctx, projectID, req.CategoryID, true)
		if err != nil {
			return nil, err
		}
		totalInScope = len(allSpecs)
	}

	queued := len(specs)
	skipped := totalInScope - queued

	resp := &BatchGenDocResponse{
		Total:   totalInScope,
		Queued:  queued,
		Skipped: skipped,
	}

	if queued == 0 {
		return resp, nil
	}

	go func() {
		sem := make(chan struct{}, batchGenConcurrency)
		client := &llmClient{
			apiKey:  cfg.OpenAI.APIKey,
			baseURL: cfg.OpenAI.BaseURL,
			model:   cfg.OpenAI.Model,
		}
		systemPrompt := getDocSystemPrompt(lang)

		for _, spec := range specs {
			sem <- struct{}{}
			po := spec
			go func() {
				defer func() { <-sem }()

				llmCtx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
				defer cancel()

				markdown, err := client.complete(llmCtx, systemPrompt, buildDocPrompt(po))
				if err != nil {
					return
				}

				po.DocMarkdown = markdown
				if lang == "zh" {
					po.DocMarkdownZh = markdown
				} else {
					po.DocMarkdownEn = markdown
				}
				po.DocSource = "ai"
				now := time.Now()
				po.DocUpdatedAt = &now
				if lang == "zh" {
					po.DocUpdatedAtZh = &now
				} else {
					po.DocUpdatedAtEn = &now
				}
				if s.repo.UpdateSpec(context.Background(), po) == nil {
					_ = s.syncShareSnapshot(context.Background(), po)
				}
			}()
		}

		for i := 0; i < batchGenConcurrency; i++ {
			sem <- struct{}{}
		}
	}()

	return resp, nil
}

func (s *service) getProjectSpec(ctx context.Context, projectID, specID string) (*APISpecPO, error) {
	po, err := s.repo.GetSpecByIDAndProject(ctx, specID, projectID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrSpecNotFound
		}
		return nil, err
	}
	return po, nil
}

func (s *service) syncShareSnapshot(ctx context.Context, spec *APISpecPO) error {
	share, err := s.repo.GetShareBySpecID(ctx, spec.ProjectID, spec.ID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil
		}
		return err
	}

	snapshot, err := marshalPublicShareSnapshot(spec)
	if err != nil {
		return err
	}

	share.Snapshot = snapshot
	return s.repo.UpdateShare(ctx, share)
}

func generateShareSlug() (string, error) {
	randomBytes := make([]byte, 12)
	if _, err := rand.Read(randomBytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(randomBytes), nil
}
