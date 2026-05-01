package apispec

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/kest-labs/kest/api/internal/infra/config"
	"gorm.io/gorm"
)

var (
	ErrAIDraftNotFound = errors.New("API spec AI draft not found")
	ErrAIUnavailable   = errors.New("AI generation is not configured")
)

var pathParameterPattern = regexp.MustCompile(`[:{]([A-Za-z0-9_]+)[}]?`)

type AIDraftStreamCallbacks struct {
	OnStatus func(status string)
	OnToken  func(token string)
}

func (s *service) CreateAIDraft(
	ctx context.Context,
	projectID string,
	userID string,
	req *CreateAPISpecAIDraftRequest,
) (*APISpecAIDraftResponse, error) {
	return s.createAIDraft(ctx, projectID, userID, req, AIDraftStreamCallbacks{})
}

func (s *service) CreateAIDraftStream(
	ctx context.Context,
	projectID string,
	userID string,
	req *CreateAPISpecAIDraftRequest,
	callbacks AIDraftStreamCallbacks,
) (*APISpecAIDraftResponse, error) {
	return s.createAIDraft(ctx, projectID, userID, req, callbacks)
}

func (s *service) createAIDraft(
	ctx context.Context,
	projectID string,
	userID string,
	req *CreateAPISpecAIDraftRequest,
	callbacks AIDraftStreamCallbacks,
) (*APISpecAIDraftResponse, error) {
	client, err := newConfiguredLLMClient()
	if err != nil {
		return nil, err
	}

	emitStatus(callbacks, "Analyzing project conventions")
	specs, err := s.repo.ListAllSpecs(ctx, projectID)
	if err != nil {
		return nil, err
	}

	conventions := conventionsForPrompt(specs, req.UseProjectConventions)
	references := selectAIDraftReferences(req, specs)

	llmCtx, cancel := context.WithTimeout(ctx, 90*time.Second)
	defer cancel()

	emitStatus(callbacks, "Generating structured draft")
	var raw string
	if callbacks.OnToken != nil {
		raw, err = client.completeStream(
			llmCtx,
			getAIDraftSystemPrompt(normalizeAIDraftLang(req.Lang)),
			buildCreateAIDraftPrompt(req, conventions, references),
			callbacks.OnToken,
		)
	} else {
		raw, err = client.complete(
			llmCtx,
			getAIDraftSystemPrompt(normalizeAIDraftLang(req.Lang)),
			buildCreateAIDraftPrompt(req, conventions, references),
		)
	}
	if err != nil {
		return nil, fmt.Errorf("failed to generate AI draft: %w", err)
	}

	emitStatus(callbacks, "Validating generated draft")
	output, err := parseAIDraftLLMOutput(raw)
	if err != nil {
		return nil, fmt.Errorf("failed to parse AI draft output: %w", err)
	}

	draft := normalizeAIDraftSpec(&output.Draft, req, conventions)
	if err := validateAIDraftSpec(draft); err != nil {
		return nil, err
	}

	seedJSON, err := marshalAIDraftJSON(req)
	if err != nil {
		return nil, err
	}
	draftJSON, err := marshalAIDraftJSON(draft)
	if err != nil {
		return nil, err
	}
	referencesJSON, err := marshalAIDraftJSON(references)
	if err != nil {
		return nil, err
	}
	assumptionsJSON, err := marshalAIDraftJSON(output.Assumptions)
	if err != nil {
		return nil, err
	}
	questionsJSON, err := marshalAIDraftJSON(output.Questions)
	if err != nil {
		return nil, err
	}
	fieldInsightsJSON, err := marshalAIDraftJSON(output.FieldInsights)
	if err != nil {
		return nil, err
	}
	conventionsJSON, err := marshalAIDraftJSON(conventions)
	if err != nil {
		return nil, err
	}

	emitStatus(callbacks, "Saving draft")
	po := &APISpecAIDraftPO{
		ProjectID:     projectID,
		CreatedBy:     userID,
		Status:        AIDraftStatusDraft,
		Intent:        req.Intent,
		SeedInput:     seedJSON,
		Draft:         draftJSON,
		References:    referencesJSON,
		Assumptions:   assumptionsJSON,
		Questions:     questionsJSON,
		FieldInsights: fieldInsightsJSON,
		Conventions:   conventionsJSON,
	}
	if err := s.repo.CreateAIDraft(ctx, po); err != nil {
		return nil, err
	}

	emitStatus(callbacks, "Draft ready")
	return fromAIDraftPO(po)
}

func emitStatus(callbacks AIDraftStreamCallbacks, status string) {
	if callbacks.OnStatus != nil && strings.TrimSpace(status) != "" {
		callbacks.OnStatus(status)
	}
}

func (s *service) GetAIDraft(ctx context.Context, projectID, draftID string) (*APISpecAIDraftResponse, error) {
	po, err := s.repo.GetAIDraftByIDAndProject(ctx, draftID, projectID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrAIDraftNotFound
		}
		return nil, err
	}

	return fromAIDraftPO(po)
}

func (s *service) RefineAIDraft(
	ctx context.Context,
	projectID, draftID string,
	req *RefineAPISpecAIDraftRequest,
) (*APISpecAIDraftResponse, error) {
	client, err := newConfiguredLLMClient()
	if err != nil {
		return nil, err
	}

	po, err := s.repo.GetAIDraftByIDAndProject(ctx, draftID, projectID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrAIDraftNotFound
		}
		return nil, err
	}

	stored, err := fromAIDraftPO(po)
	if err != nil {
		return nil, err
	}

	currentDraft := &stored.Draft
	if req.CurrentDraft != nil {
		seed := &stored.SeedInput
		currentDraft = normalizeAIDraftSpec(req.CurrentDraft, seed, stored.Conventions)
	}

	llmCtx, cancel := context.WithTimeout(ctx, 90*time.Second)
	defer cancel()

	raw, err := client.complete(
		llmCtx,
		getAIDraftRefineSystemPrompt(normalizeAIDraftLang(req.Lang)),
		buildRefineAIDraftPrompt(req, currentDraft, stored.Conventions, stored.References),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to refine AI draft: %w", err)
	}

	output, err := parseAIDraftLLMOutput(raw)
	if err != nil {
		return nil, fmt.Errorf("failed to parse AI draft output: %w", err)
	}

	refined := normalizeAIDraftSpec(&output.Draft, &stored.SeedInput, stored.Conventions)
	if err := validateAIDraftSpec(refined); err != nil {
		return nil, err
	}

	po.Draft, err = marshalAIDraftJSON(refined)
	if err != nil {
		return nil, err
	}
	po.Assumptions, err = marshalAIDraftJSON(output.Assumptions)
	if err != nil {
		return nil, err
	}
	po.Questions, err = marshalAIDraftJSON(output.Questions)
	if err != nil {
		return nil, err
	}
	po.FieldInsights, err = marshalAIDraftJSON(output.FieldInsights)
	if err != nil {
		return nil, err
	}

	if err := s.repo.UpdateAIDraft(ctx, po); err != nil {
		return nil, err
	}

	return fromAIDraftPO(po)
}

func (s *service) AcceptAIDraft(
	ctx context.Context,
	projectID, draftID string,
	req *AcceptAPISpecAIDraftRequest,
) (*AcceptAPISpecAIDraftResponse, error) {
	po, err := s.repo.GetAIDraftByIDAndProject(ctx, draftID, projectID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrAIDraftNotFound
		}
		return nil, err
	}

	stored, err := fromAIDraftPO(po)
	if err != nil {
		return nil, err
	}

	warnings := make([]string, 0, 2)
	if po.Status == AIDraftStatusAccepted && po.AcceptedSpecID != nil {
		existing, getErr := s.GetSpecByID(ctx, projectID, *po.AcceptedSpecID)
		if getErr == nil {
			return &AcceptAPISpecAIDraftResponse{
				DraftID:  po.ID,
				Spec:     existing,
				Warnings: []string{"draft already accepted; returning the existing API spec"},
			}, nil
		}
		warnings = append(warnings, "accepted draft pointed to a missing spec; created a new spec instead")
	}

	finalDraft := stored.Draft
	if req != nil && req.Overrides != nil {
		finalDraft = *normalizeAIDraftSpec(req.Overrides, &stored.SeedInput, stored.Conventions)
	}

	if err := validateAIDraftSpec(&finalDraft); err != nil {
		return nil, err
	}

	spec, err := s.CreateSpec(ctx, finalDraft.toCreateSpecRequest(projectID))
	if err != nil {
		return nil, err
	}

	lang := normalizeAIDraftLang("")
	if req != nil {
		lang = normalizeAIDraftLang(req.Lang)
	}

	if req != nil && req.GenerateDoc {
		if generated, genErr := s.GenDoc(ctx, projectID, spec.ID, lang); genErr == nil {
			spec = generated
		} else {
			warnings = append(warnings, fmt.Sprintf("documentation generation skipped: %v", genErr))
		}
	}

	generatedTest := ""
	if req != nil && req.GenerateTest {
		if flowContent, genErr := s.GenTest(ctx, projectID, spec.ID, lang); genErr == nil {
			generatedTest = flowContent
		} else {
			warnings = append(warnings, fmt.Sprintf("test generation skipped: %v", genErr))
		}
	}

	if latest, getErr := s.GetSpecByID(ctx, projectID, spec.ID); getErr == nil {
		spec = latest
	}

	po.Status = AIDraftStatusAccepted
	po.AcceptedSpecID = &spec.ID
	po.Draft, err = marshalAIDraftJSON(finalDraft)
	if err != nil {
		return nil, err
	}
	if err := s.repo.UpdateAIDraft(ctx, po); err != nil {
		return nil, err
	}

	return &AcceptAPISpecAIDraftResponse{
		DraftID:       po.ID,
		Spec:          spec,
		GeneratedTest: generatedTest,
		Warnings:      warnings,
	}, nil
}

func newConfiguredLLMClient() (*llmClient, error) {
	cfg := config.GlobalConfig
	if cfg == nil || strings.TrimSpace(cfg.OpenAI.APIKey) == "" {
		return nil, ErrAIUnavailable
	}

	baseURL := strings.TrimSpace(cfg.OpenAI.BaseURL)
	if baseURL == "" {
		baseURL = "https://api.openai.com/v1"
	}

	model := strings.TrimSpace(cfg.OpenAI.Model)
	if model == "" {
		model = "gpt-4o-mini"
	}

	return &llmClient{
		apiKey:  cfg.OpenAI.APIKey,
		baseURL: baseURL,
		model:   model,
	}, nil
}

func conventionsForPrompt(specs []*APISpecPO, useProjectConventions *bool) *APISpecAIDraftConventions {
	if useProjectConventions != nil && !*useProjectConventions {
		return nil
	}
	return deriveAIDraftConventions(specs)
}

func normalizeAIDraftLang(lang string) string {
	if strings.EqualFold(lang, "zh") {
		return "zh"
	}
	return "en"
}

func normalizeAIDraftSpec(
	draft *APISpecAIDraftSpec,
	seedInput *CreateAPISpecAIDraftRequest,
	conventions *APISpecAIDraftConventions,
) *APISpecAIDraftSpec {
	normalized := &APISpecAIDraftSpec{}
	if draft != nil {
		*normalized = *draft
	}

	if seedInput != nil {
		if strings.TrimSpace(seedInput.Method) != "" {
			normalized.Method = strings.ToUpper(strings.TrimSpace(seedInput.Method))
		}
		if strings.TrimSpace(seedInput.Path) != "" {
			normalized.Path = strings.TrimSpace(seedInput.Path)
		}
		if seedInput.CategoryID != nil && normalized.CategoryID == nil {
			normalized.CategoryID = seedInput.CategoryID
		}
	}

	normalized.Method = strings.ToUpper(strings.TrimSpace(normalized.Method))
	normalized.Path = strings.TrimSpace(normalized.Path)
	if normalized.Path != "" && !strings.HasPrefix(normalized.Path, "/") {
		normalized.Path = "/" + normalized.Path
	}

	if strings.TrimSpace(normalized.Version) == "" {
		if conventions != nil && strings.TrimSpace(conventions.DefaultVersion) != "" {
			normalized.Version = conventions.DefaultVersion
		} else {
			normalized.Version = "1.0.0"
		}
	}

	if len(normalized.Tags) == 0 {
		if derived := deriveTagFromPath(normalized.Path); derived != "" {
			normalized.Tags = []string{derived}
		}
	} else {
		normalized.Tags = normalizeDraftTags(normalized.Tags)
	}

	if len(normalized.Responses) == 0 {
		normalized.Responses = defaultResponsesForMethod(normalized.Method)
	}

	normalized.Parameters = ensurePathParameters(normalized.Path, normalized.Parameters)

	return normalized
}

func validateAIDraftSpec(draft *APISpecAIDraftSpec) error {
	if draft == nil {
		return ErrInvalidSpecData
	}
	if !isSupportedHTTPMethod(draft.Method) {
		return ErrInvalidSpecData
	}
	if strings.TrimSpace(draft.Path) == "" || !strings.HasPrefix(draft.Path, "/") {
		return ErrInvalidSpecData
	}
	if strings.TrimSpace(draft.Version) == "" {
		return ErrInvalidSpecData
	}
	return nil
}

func defaultResponsesForMethod(method string) map[string]ResponseSpec {
	successStatus := "200"
	switch strings.ToUpper(strings.TrimSpace(method)) {
	case "POST":
		successStatus = "201"
	case "DELETE":
		successStatus = "204"
	}

	responses := map[string]ResponseSpec{
		successStatus: {
			Description: "Successful response",
			ContentType: "application/json",
			Schema:      map[string]interface{}{},
		},
		"400": {
			Description: "Bad request",
			ContentType: "application/json",
			Schema:      map[string]interface{}{},
		},
	}

	return responses
}

func ensurePathParameters(path string, parameters []ParameterSpec) []ParameterSpec {
	if strings.TrimSpace(path) == "" {
		return parameters
	}

	indexByName := map[string]int{}
	result := make([]ParameterSpec, 0, len(parameters))
	for _, parameter := range parameters {
		name := strings.TrimSpace(parameter.Name)
		if name == "" {
			continue
		}
		indexByName[strings.ToLower(name)] = len(result)
		result = append(result, parameter)
	}

	matches := pathParameterPattern.FindAllStringSubmatch(path, -1)
	for _, match := range matches {
		if len(match) < 2 {
			continue
		}

		name := strings.TrimSpace(match[1])
		if name == "" {
			continue
		}

		if index, ok := indexByName[strings.ToLower(name)]; ok {
			result[index].In = "path"
			result[index].Required = true
			if len(result[index].Schema) == 0 {
				result[index].Schema = map[string]interface{}{"type": "string"}
			}
			continue
		}

		result = append(result, ParameterSpec{
			Name:        name,
			In:          "path",
			Description: fmt.Sprintf("%s identifier", name),
			Required:    true,
			Schema:      map[string]interface{}{"type": "string"},
		})
		indexByName[strings.ToLower(name)] = len(result) - 1
	}

	return result
}

func normalizeDraftTags(tags []string) []string {
	result := make([]string, 0, len(tags))
	seen := map[string]struct{}{}
	for _, tag := range tags {
		tag = strings.TrimSpace(tag)
		if tag == "" {
			continue
		}
		lower := strings.ToLower(tag)
		if _, ok := seen[lower]; ok {
			continue
		}
		seen[lower] = struct{}{}
		result = append(result, tag)
	}
	sort.Strings(result)
	return result
}

func deriveTagFromPath(path string) string {
	segments := splitPathSegments(path)
	for _, segment := range segments {
		if segment == "api" || segment == "v1" || segment == "v2" {
			continue
		}
		return segment
	}
	return ""
}

func isSupportedHTTPMethod(method string) bool {
	switch strings.ToUpper(strings.TrimSpace(method)) {
	case "GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS":
		return true
	default:
		return false
	}
}

func jsonUnmarshalString(payload string, target interface{}) error {
	if strings.TrimSpace(payload) == "" {
		return nil
	}
	return json.Unmarshal([]byte(payload), target)
}
