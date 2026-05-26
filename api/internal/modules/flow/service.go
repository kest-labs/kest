package flow

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/kest-labs/kest/api/internal/modules/history"
	"gorm.io/gorm"
)

// Service defines the business logic interface for flows
type Service interface {
	// Flow CRUD
	CreateFlow(ctx context.Context, workspaceID string, userID string, req *CreateFlowRequest) (*FlowResponse, error)
	ImportFlowMarkdown(ctx context.Context, workspaceID string, userID string, req *ImportFlowMarkdownRequest) (*FlowDetailResponse, error)
	GetFlow(ctx context.Context, id string) (*FlowDetailResponse, error)
	ListFlows(ctx context.Context, workspaceID string) ([]*FlowResponse, error)
	UpdateFlow(ctx context.Context, id string, req *UpdateFlowRequest) (*FlowResponse, error)
	UpdateFlowMarkdown(ctx context.Context, id string, req *UpdateFlowMarkdownRequest) (*FlowDetailResponse, error)
	DeleteFlow(ctx context.Context, id string) error
	SaveFlow(ctx context.Context, id string, req *SaveFlowRequest) (*FlowDetailResponse, error)

	// Step CRUD
	CreateStep(ctx context.Context, flowID string, req *CreateStepRequest) (*StepResponse, error)
	UpdateStep(ctx context.Context, id string, req *UpdateStepRequest) (*StepResponse, error)
	DeleteStep(ctx context.Context, id string) error

	// Edge CRUD
	CreateEdge(ctx context.Context, flowID string, req *CreateEdgeRequest) (*EdgeResponse, error)
	UpdateEdge(ctx context.Context, id string, req *UpdateEdgeRequest) (*EdgeResponse, error)
	DeleteEdge(ctx context.Context, id string) error

	// Run
	RunFlow(ctx context.Context, flowID string, userID string) (*RunResponse, error)
	ExecuteFlow(ctx context.Context, runID string, baseURL string, events chan<- StepEvent) error
	GetRun(ctx context.Context, runID string) (*RunResponse, error)
	ListRuns(ctx context.Context, flowID string, filter FlowRunListFilter) ([]*RunResponse, error)
	ListRunnableFlowsForCLI(ctx context.Context, workspaceID string) ([]CLIRunnableFlowResponse, error)
	SyncFlowsFromCLI(ctx context.Context, workspaceID string, createdBy string, req *CLIFlowSyncRequest) (*CLIFlowSyncResponseBody, error)
	SyncFlowRunFromCLI(ctx context.Context, workspaceID string, createdBy string, req *CLIFlowRunSyncRequest) (*CLIFlowSyncResponseBody, error)
}

type service struct {
	repo    Repository
	history history.Service
}

// NewService creates a new flow service
func NewService(repo Repository, historyServices ...history.Service) Service {
	var historyService history.Service
	if len(historyServices) > 0 {
		historyService = historyServices[0]
	}
	return &service{repo: repo, history: historyService}
}

// --- Flow CRUD ---

func (s *service) CreateFlow(ctx context.Context, workspaceID string, userID string, req *CreateFlowRequest) (*FlowResponse, error) {
	name := strings.TrimSpace(req.Name)
	if name == "" {
		return nil, newFlowError(422, "flow name is required")
	}

	flow := &FlowPO{
		WorkspaceID: workspaceID,
		Name:        name,
		Description: strings.TrimSpace(req.Description),
		CreatedBy:   userID,
		Source:      "web",
		Revision:    1,
		Enabled:     true,
		ParseStatus: FlowParseStatusUnparsed,
	}
	if err := s.repo.CreateFlow(ctx, flow); err != nil {
		return nil, err
	}
	return ToFlowResponse(flow), nil
}

func (s *service) ImportFlowMarkdown(ctx context.Context, workspaceID string, userID string, req *ImportFlowMarkdownRequest) (*FlowDetailResponse, error) {
	definition := strings.TrimSpace(req.Definition)
	if definition == "" {
		return nil, newFlowError(422, "flow markdown definition is required")
	}

	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}

	parsed := parseFlowMarkdownDefinition(definition)
	name := strings.TrimSpace(req.Name)
	if name == "" {
		name = parsed.Name
	}
	if name == "" {
		name = fallbackFlowName(req.SourcePath)
	}
	if name == "" {
		name = "Untitled flow"
	}

	sourcePath := strings.TrimSpace(req.SourcePath)
	sourceID := parsed.SourceID
	if sourceID == "" && sourcePath != "" {
		sourceID = "path:" + sourcePath
	}
	if sourceID == "" {
		sourceID = "web:" + shortDefinitionHash(definition)
	}

	var flowID string
	if err := s.repo.WithTransaction(ctx, func(txRepo Repository) error {
		flow := &FlowPO{
			WorkspaceID:    workspaceID,
			Name:           name,
			Description:    strings.TrimSpace(req.Description),
			CreatedBy:      userID,
			Source:         "web",
			SourceID:       sourceID,
			SourcePath:     sourcePath,
			SourceHash:     definitionHash(definition),
			SourceReadOnly: false,
			Definition:     definition,
			Revision:       1,
			Enabled:        enabled,
			Metadata:       parsed.Metadata,
			ParseStatus:    parsed.ParseStatus,
			ParseError:     parsed.ParseError,
			ParsedAt:       parsed.ParsedAt,
		}
		if err := txRepo.CreateFlow(ctx, flow); err != nil {
			return err
		}
		flowID = flow.ID
		if parsed.ParseStatus != FlowParseStatusParsed {
			return nil
		}
		return replaceFlowGraph(ctx, txRepo, flow.ID, parsed.Steps, parsed.Edges)
	}); err != nil {
		return nil, err
	}

	return s.GetFlow(ctx, flowID)
}

func (s *service) GetFlow(ctx context.Context, id string) (*FlowDetailResponse, error) {
	flow, err := s.repo.GetFlowByID(ctx, id)
	if err != nil {
		return nil, newFlowError(404, "flow not found")
	}

	steps, err := s.repo.ListStepsByFlow(ctx, id)
	if err != nil {
		return nil, err
	}

	edges, err := s.repo.ListEdgesByFlow(ctx, id)
	if err != nil {
		return nil, err
	}

	stepResponses := make([]StepResponse, 0, len(steps))
	for _, step := range steps {
		stepResponses = append(stepResponses, *ToStepResponse(step))
	}
	ensureUniqueStepClientKeys(stepResponses)

	edgeResponses := make([]EdgeResponse, 0, len(edges))
	for _, edge := range edges {
		edgeResponses = append(edgeResponses, *ToEdgeResponse(edge))
	}

	resp := &FlowDetailResponse{
		FlowResponse: *ToFlowResponse(flow),
		Steps:        stepResponses,
		Edges:        edgeResponses,
	}
	resp.StepCount = len(stepResponses)
	return resp, nil
}

func (s *service) ListFlows(ctx context.Context, workspaceID string) ([]*FlowResponse, error) {
	flows, err := s.repo.ListFlowsByWorkspace(ctx, workspaceID)
	if err != nil {
		return nil, err
	}

	responses := make([]*FlowResponse, 0, len(flows))
	for _, flow := range flows {
		resp := ToFlowResponse(flow)
		// Get step count
		steps, _ := s.repo.ListStepsByFlow(ctx, flow.ID)
		resp.StepCount = len(steps)
		if runs, err := s.repo.ListRunsByFlow(ctx, flow.ID, FlowRunListFilter{}); err == nil && len(runs) > 0 {
			resp.LatestRunStatus = runs[0].Status
			resp.LatestRunMode = runs[0].ExecutionMode
		}
		responses = append(responses, resp)
	}
	return responses, nil
}

func (s *service) UpdateFlow(ctx context.Context, id string, req *UpdateFlowRequest) (*FlowResponse, error) {
	flow, err := s.repo.GetFlowByID(ctx, id)
	if err != nil {
		return nil, newFlowError(404, "flow not found")
	}
	if flow.SourceReadOnly {
		return nil, newFlowError(409, "git-backed flow is read-only in web")
	}

	if req.Name != nil {
		name := strings.TrimSpace(*req.Name)
		if name == "" {
			return nil, newFlowError(422, "flow name is required")
		}
		flow.Name = name
	}
	if req.Description != nil {
		flow.Description = strings.TrimSpace(*req.Description)
	}
	if req.Enabled != nil {
		flow.Enabled = *req.Enabled
	}

	if err := s.repo.UpdateFlow(ctx, flow); err != nil {
		return nil, err
	}
	return ToFlowResponse(flow), nil
}

func (s *service) UpdateFlowMarkdown(ctx context.Context, id string, req *UpdateFlowMarkdownRequest) (*FlowDetailResponse, error) {
	definition := strings.TrimSpace(req.Definition)
	if definition == "" {
		return nil, newFlowError(422, "flow markdown definition is required")
	}

	parsed := parseFlowMarkdownDefinition(definition)
	if err := s.repo.WithTransaction(ctx, func(txRepo Repository) error {
		flow, err := txRepo.GetFlowByID(ctx, id)
		if err != nil {
			return newFlowError(404, "flow not found")
		}
		if flow.SourceReadOnly {
			return newFlowError(409, "git-backed flow is read-only in web")
		}

		if req.Name != nil {
			name := strings.TrimSpace(*req.Name)
			if name == "" {
				name = parsed.Name
			}
			if name == "" {
				return newFlowError(422, "flow name is required")
			}
			flow.Name = name
		} else if strings.TrimSpace(flow.Name) == "" && parsed.Name != "" {
			flow.Name = parsed.Name
		}
		if req.Description != nil {
			flow.Description = strings.TrimSpace(*req.Description)
		}
		if req.SourcePath != nil {
			flow.SourcePath = strings.TrimSpace(*req.SourcePath)
		}
		if req.Enabled != nil {
			flow.Enabled = *req.Enabled
		}
		if flow.SourceID == "" && parsed.SourceID != "" {
			flow.SourceID = parsed.SourceID
		}
		if flow.SourceID == "" && flow.SourcePath != "" {
			flow.SourceID = "path:" + flow.SourcePath
		}
		flow.Source = "web"
		flow.SourceHash = definitionHash(definition)
		flow.Definition = definition
		flow.Revision++
		if flow.Revision < 1 {
			flow.Revision = 1
		}
		flow.Metadata = parsed.Metadata
		flow.ParseStatus = parsed.ParseStatus
		flow.ParseError = parsed.ParseError
		flow.ParsedAt = parsed.ParsedAt

		if err := txRepo.UpdateFlow(ctx, flow); err != nil {
			return err
		}
		if err := txRepo.DeleteEdgesByFlow(ctx, id); err != nil {
			return err
		}
		if err := txRepo.DeleteStepsByFlow(ctx, id); err != nil {
			return err
		}
		if parsed.ParseStatus != FlowParseStatusParsed {
			return nil
		}
		return replaceFlowGraph(ctx, txRepo, id, parsed.Steps, parsed.Edges)
	}); err != nil {
		return nil, err
	}

	return s.GetFlow(ctx, id)
}

func (s *service) DeleteFlow(ctx context.Context, id string) error {
	flow, err := s.repo.GetFlowByID(ctx, id)
	if err != nil {
		return newFlowError(404, "flow not found")
	}
	if flow.SourceReadOnly {
		return newFlowError(409, "git-backed flow is read-only in web")
	}

	// Delete edges, steps, then flow
	if err := s.repo.DeleteEdgesByFlow(ctx, id); err != nil {
		return err
	}
	if err := s.repo.DeleteStepsByFlow(ctx, id); err != nil {
		return err
	}
	return s.repo.DeleteFlow(ctx, id)
}

func (s *service) SaveFlow(ctx context.Context, id string, req *SaveFlowRequest) (*FlowDetailResponse, error) {
	flow, err := s.repo.GetFlowByID(ctx, id)
	if err != nil {
		return nil, newFlowError(404, "flow not found")
	}
	if flow.SourceReadOnly {
		return nil, newFlowError(409, "git-backed flow is read-only in web")
	}
	if err := validateSaveGraph(req.Steps, req.Edges); err != nil {
		return nil, err
	}

	if err := s.repo.WithTransaction(ctx, func(txRepo Repository) error {
		flow, err := txRepo.GetFlowByID(ctx, id)
		if err != nil {
			return newFlowError(404, "flow not found")
		}
		if flow.SourceReadOnly {
			return newFlowError(409, "git-backed flow is read-only in web")
		}

		if req.Name != nil {
			name := strings.TrimSpace(*req.Name)
			if name == "" {
				return newFlowError(422, "flow name is required")
			}
			flow.Name = name
		}
		if req.Description != nil {
			flow.Description = strings.TrimSpace(*req.Description)
		}
		if err := txRepo.UpdateFlow(ctx, flow); err != nil {
			return err
		}

		if err := txRepo.DeleteEdgesByFlow(ctx, id); err != nil {
			return err
		}
		if err := txRepo.DeleteStepsByFlow(ctx, id); err != nil {
			return err
		}

		stepPOs := make([]*FlowStepPO, 0, len(req.Steps))
		for _, stepReq := range req.Steps {
			stepPOs = append(stepPOs, &FlowStepPO{
				FlowID:    id,
				ClientKey: normalizeStepClientKey("", stepReq.ClientKey),
				Name:      stepReq.Name,
				SortOrder: stepReq.SortOrder,
				Method:    stepReq.Method,
				URL:       stepReq.URL,
				Headers:   stepReq.Headers,
				Body:      stepReq.Body,
				Captures:  stepReq.Captures,
				Asserts:   stepReq.Asserts,
				PositionX: stepReq.PositionX,
				PositionY: stepReq.PositionY,
			})
		}
		if err := txRepo.BatchCreateSteps(ctx, stepPOs); err != nil {
			return err
		}

		stepIDByClientKey := make(map[string]string, len(stepPOs))
		for _, step := range stepPOs {
			stepIDByClientKey[step.ClientKey] = step.ID
		}

		edgePOs := make([]*FlowEdgePO, 0, len(req.Edges))
		for _, edgeReq := range req.Edges {
			sourceID, ok := stepIDByClientKey[edgeReq.SourceClientKey]
			if !ok {
				return newFlowError(422, fmt.Sprintf("edge source step %q does not exist", edgeReq.SourceClientKey))
			}
			targetID, ok := stepIDByClientKey[edgeReq.TargetClientKey]
			if !ok {
				return newFlowError(422, fmt.Sprintf("edge target step %q does not exist", edgeReq.TargetClientKey))
			}

			edgePOs = append(edgePOs, &FlowEdgePO{
				FlowID:          id,
				SourceStepID:    sourceID,
				TargetStepID:    targetID,
				VariableMapping: edgeReq.VariableMapping,
			})
		}
		if err := txRepo.BatchCreateEdges(ctx, edgePOs); err != nil {
			return err
		}

		return nil
	}); err != nil {
		return nil, err
	}

	return s.GetFlow(ctx, id)
}

// --- Step CRUD ---

func (s *service) CreateStep(ctx context.Context, flowID string, req *CreateStepRequest) (*StepResponse, error) {
	flow, err := s.repo.GetFlowByID(ctx, flowID)
	if err != nil {
		return nil, newFlowError(404, "flow not found")
	}
	if flow.SourceReadOnly {
		return nil, newFlowError(409, "git-backed flow is read-only in web")
	}

	clientKey := strings.TrimSpace(req.ClientKey)
	step := &FlowStepPO{
		FlowID:    flowID,
		ClientKey: clientKey,
		Name:      req.Name,
		SortOrder: req.SortOrder,
		Method:    req.Method,
		URL:       req.URL,
		Headers:   req.Headers,
		Body:      req.Body,
		Captures:  req.Captures,
		Asserts:   req.Asserts,
		PositionX: req.PositionX,
		PositionY: req.PositionY,
	}
	if err := s.repo.CreateStep(ctx, step); err != nil {
		return nil, err
	}
	if clientKey == "" {
		step.ClientKey = normalizeStepClientKey(step.ID, "")
		if err := s.repo.UpdateStep(ctx, step); err != nil {
			return nil, err
		}
	}
	return ToStepResponse(step), nil
}

func (s *service) UpdateStep(ctx context.Context, id string, req *UpdateStepRequest) (*StepResponse, error) {
	step, err := s.repo.GetStepByID(ctx, id)
	if err != nil {
		return nil, newFlowError(404, "step not found")
	}
	flow, err := s.repo.GetFlowByID(ctx, step.FlowID)
	if err != nil {
		return nil, newFlowError(404, "flow not found")
	}
	if flow.SourceReadOnly {
		return nil, newFlowError(409, "git-backed flow is read-only in web")
	}

	if req.ClientKey != nil {
		step.ClientKey = normalizeStepClientKey(step.ID, *req.ClientKey)
	}
	if req.Name != nil {
		step.Name = *req.Name
	}
	if req.SortOrder != nil {
		step.SortOrder = *req.SortOrder
	}
	if req.Method != nil {
		step.Method = *req.Method
	}
	if req.URL != nil {
		step.URL = *req.URL
	}
	if req.Headers != nil {
		step.Headers = *req.Headers
	}
	if req.Body != nil {
		step.Body = *req.Body
	}
	if req.Captures != nil {
		step.Captures = *req.Captures
	}
	if req.Asserts != nil {
		step.Asserts = *req.Asserts
	}
	if req.PositionX != nil {
		step.PositionX = *req.PositionX
	}
	if req.PositionY != nil {
		step.PositionY = *req.PositionY
	}

	if err := s.repo.UpdateStep(ctx, step); err != nil {
		return nil, err
	}
	return ToStepResponse(step), nil
}

func (s *service) DeleteStep(ctx context.Context, id string) error {
	step, err := s.repo.GetStepByID(ctx, id)
	if err != nil {
		return newFlowError(404, "step not found")
	}
	flow, err := s.repo.GetFlowByID(ctx, step.FlowID)
	if err != nil {
		return newFlowError(404, "flow not found")
	}
	if flow.SourceReadOnly {
		return newFlowError(409, "git-backed flow is read-only in web")
	}
	return s.repo.DeleteStep(ctx, id)
}

// --- Edge CRUD ---

func (s *service) CreateEdge(ctx context.Context, flowID string, req *CreateEdgeRequest) (*EdgeResponse, error) {
	flow, err := s.repo.GetFlowByID(ctx, flowID)
	if err != nil {
		return nil, newFlowError(404, "flow not found")
	}
	if flow.SourceReadOnly {
		return nil, newFlowError(409, "git-backed flow is read-only in web")
	}

	sourceStep, err := s.repo.GetStepByID(ctx, req.SourceStepID)
	if err != nil {
		return nil, newFlowError(422, "edge source step does not exist")
	}
	targetStep, err := s.repo.GetStepByID(ctx, req.TargetStepID)
	if err != nil {
		return nil, newFlowError(422, "edge target step does not exist")
	}
	if sourceStep.FlowID != flowID || targetStep.FlowID != flowID {
		return nil, newFlowError(422, "edge steps must belong to the selected flow")
	}
	if _, err := parseVariableMappingRules(req.VariableMapping); err != nil {
		return nil, err
	}

	steps, err := s.repo.ListStepsByFlow(ctx, flowID)
	if err != nil {
		return nil, err
	}
	edges, err := s.repo.ListEdgesByFlow(ctx, flowID)
	if err != nil {
		return nil, err
	}
	edges = append(edges, &FlowEdgePO{
		FlowID:          flowID,
		SourceStepID:    req.SourceStepID,
		TargetStepID:    req.TargetStepID,
		VariableMapping: req.VariableMapping,
	})
	if err := validateStoredGraph(steps, edges); err != nil {
		return nil, err
	}

	edge := &FlowEdgePO{
		FlowID:          flowID,
		SourceStepID:    req.SourceStepID,
		TargetStepID:    req.TargetStepID,
		VariableMapping: req.VariableMapping,
	}
	if err := s.repo.CreateEdge(ctx, edge); err != nil {
		return nil, err
	}
	return ToEdgeResponse(edge), nil
}

func (s *service) UpdateEdge(ctx context.Context, id string, req *UpdateEdgeRequest) (*EdgeResponse, error) {
	edge, err := s.repo.GetEdgeByID(ctx, id)
	if err != nil {
		return nil, newFlowError(404, "edge not found")
	}
	flow, err := s.repo.GetFlowByID(ctx, edge.FlowID)
	if err != nil {
		return nil, newFlowError(404, "flow not found")
	}
	if flow.SourceReadOnly {
		return nil, newFlowError(409, "git-backed flow is read-only in web")
	}

	if req.SourceStepID != nil {
		edge.SourceStepID = *req.SourceStepID
	}
	if req.TargetStepID != nil {
		edge.TargetStepID = *req.TargetStepID
	}
	if req.VariableMapping != nil {
		edge.VariableMapping = *req.VariableMapping
	}
	if _, err := parseVariableMappingRules(edge.VariableMapping); err != nil {
		return nil, err
	}

	sourceStep, err := s.repo.GetStepByID(ctx, edge.SourceStepID)
	if err != nil {
		return nil, newFlowError(422, "edge source step does not exist")
	}
	targetStep, err := s.repo.GetStepByID(ctx, edge.TargetStepID)
	if err != nil {
		return nil, newFlowError(422, "edge target step does not exist")
	}
	if sourceStep.FlowID != edge.FlowID || targetStep.FlowID != edge.FlowID {
		return nil, newFlowError(422, "edge steps must belong to the selected flow")
	}

	steps, err := s.repo.ListStepsByFlow(ctx, edge.FlowID)
	if err != nil {
		return nil, err
	}
	edges, err := s.repo.ListEdgesByFlow(ctx, edge.FlowID)
	if err != nil {
		return nil, err
	}
	for index := range edges {
		if edges[index].ID == edge.ID {
			edges[index] = edge
			break
		}
	}
	if err := validateStoredGraph(steps, edges); err != nil {
		return nil, err
	}

	if err := s.repo.UpdateEdge(ctx, edge); err != nil {
		return nil, err
	}
	return ToEdgeResponse(edge), nil
}

func (s *service) DeleteEdge(ctx context.Context, id string) error {
	edge, err := s.repo.GetEdgeByID(ctx, id)
	if err != nil {
		return newFlowError(404, "edge not found")
	}
	flow, err := s.repo.GetFlowByID(ctx, edge.FlowID)
	if err != nil {
		return newFlowError(404, "flow not found")
	}
	if flow.SourceReadOnly {
		return newFlowError(409, "git-backed flow is read-only in web")
	}
	return s.repo.DeleteEdge(ctx, id)
}

// --- Run ---

func (s *service) ExecuteFlow(ctx context.Context, runID string, baseURL string, events chan<- StepEvent) error {
	run, err := s.repo.GetRunByID(ctx, runID)
	if err != nil {
		close(events)
		return newFlowError(404, "run not found")
	}

	// Get flow steps and edges
	steps, err := s.repo.ListStepsByFlow(ctx, run.FlowID)
	if err != nil {
		close(events)
		return err
	}

	edges, err := s.repo.ListEdgesByFlow(ctx, run.FlowID)
	if err != nil {
		close(events)
		return err
	}
	if err := validateStoredGraph(steps, edges); err != nil {
		close(events)
		return err
	}

	// Convert to value slices
	stepValues := make([]FlowStepPO, 0, len(steps))
	for _, step := range steps {
		stepValues = append(stepValues, *step)
	}
	edgeValues := make([]FlowEdgePO, 0, len(edges))
	for _, edge := range edges {
		edgeValues = append(edgeValues, *edge)
	}

	runner := NewRunner(s.repo, baseURL)
	return runner.Execute(ctx, run, stepValues, edgeValues, events)
}

func (s *service) RunFlow(ctx context.Context, flowID string, userID string) (*RunResponse, error) {
	flow, err := s.repo.GetFlowByID(ctx, flowID)
	if err != nil {
		return nil, newFlowError(404, "flow not found")
	}
	if flow.SourceReadOnly {
		return nil, newFlowError(409, "git-backed flow runs through CLI automation")
	}

	flowDetail, err := s.GetFlow(ctx, flowID)
	if err != nil {
		return nil, err
	}

	if len(flowDetail.Steps) == 0 {
		return nil, newFlowError(422, "flow has no steps")
	}

	steps, err := s.repo.ListStepsByFlow(ctx, flowID)
	if err != nil {
		return nil, err
	}
	edges, err := s.repo.ListEdgesByFlow(ctx, flowID)
	if err != nil {
		return nil, err
	}
	if err := validateStoredGraph(steps, edges); err != nil {
		return nil, err
	}

	// Create run record
	run := &FlowRunPO{
		FlowID:      flowID,
		Status:      RunStatusPending,
		TriggeredBy: userID,
	}
	if err := s.repo.CreateRun(ctx, run); err != nil {
		return nil, err
	}

	// Create step result placeholders
	for _, step := range flowDetail.Steps {
		result := &FlowStepResultPO{
			RunID:  run.ID,
			StepID: step.ID,
			Status: RunStatusPending,
		}
		if err := s.repo.CreateStepResult(ctx, result); err != nil {
			return nil, fmt.Errorf("failed to create step result: %w", err)
		}
	}

	return ToRunResponse(run), nil
}

func (s *service) GetRun(ctx context.Context, runID string) (*RunResponse, error) {
	run, err := s.repo.GetRunByID(ctx, runID)
	if err != nil {
		return nil, newFlowError(404, "run not found")
	}

	resp := ToRunResponse(run)

	results, err := s.repo.ListStepResultsByRun(ctx, runID)
	if err != nil {
		return nil, err
	}

	stepResults := make([]StepResultResponse, 0, len(results))
	for _, result := range results {
		stepResults = append(stepResults, *ToStepResultResponse(result))
	}
	resp.StepResults = stepResults

	return resp, nil
}

func (s *service) ListRuns(ctx context.Context, flowID string, filter FlowRunListFilter) ([]*RunResponse, error) {
	filter.RunnerType = normalizeOptionalRunnerType(filter.RunnerType)
	filter.Status = normalizeOptionalRunStatus(filter.Status)
	filter.Source = strings.TrimSpace(filter.Source)
	filter.Profile = strings.TrimSpace(filter.Profile)
	runs, err := s.repo.ListRunsByFlow(ctx, flowID, filter)
	if err != nil {
		return nil, err
	}

	responses := make([]*RunResponse, 0, len(runs))
	for _, run := range runs {
		responses = append(responses, ToRunResponse(run))
	}
	return responses, nil
}

func (s *service) ListRunnableFlowsForCLI(ctx context.Context, workspaceID string) ([]CLIRunnableFlowResponse, error) {
	flows, err := s.repo.ListRunnableFlowsByWorkspace(ctx, workspaceID)
	if err != nil {
		return nil, err
	}
	responses := make([]CLIRunnableFlowResponse, 0, len(flows))
	for _, flow := range flows {
		responses = append(responses, CLIRunnableFlowResponse{
			ID:          flow.ID,
			SourceID:    flow.SourceID,
			SourcePath:  flow.SourcePath,
			SourceHash:  flow.SourceHash,
			Name:        flow.Name,
			Description: flow.Description,
			Definition:  flow.Definition,
			Revision:    flow.Revision,
			UpdatedAt:   flow.UpdatedAt,
		})
	}
	return responses, nil
}

func (s *service) SyncFlowsFromCLI(ctx context.Context, workspaceID string, createdBy string, req *CLIFlowSyncRequest) (*CLIFlowSyncResponseBody, error) {
	result := &CLIFlowSyncResponseBody{}
	source := normalizeSource(req.Source)

	for _, item := range req.Flows {
		if strings.TrimSpace(item.SourceID) == "" || strings.TrimSpace(item.SourcePath) == "" {
			result.Errors = append(result.Errors, "flow source_id and source_path are required")
			continue
		}

		created := false
		err := s.repo.WithTransaction(ctx, func(txRepo Repository) error {
			flow, err := txRepo.GetFlowBySource(ctx, workspaceID, source, item.SourceID, item.SourcePath)
			if err != nil {
				if !errors.Is(err, gorm.ErrRecordNotFound) {
					return err
				}
				flow = &FlowPO{
					WorkspaceID:    workspaceID,
					Name:           strings.TrimSpace(item.Name),
					Description:    strings.TrimSpace(item.Description),
					CreatedBy:      createdBy,
					Source:         source,
					SourceID:       strings.TrimSpace(item.SourceID),
					SourcePath:     strings.TrimSpace(item.SourcePath),
					SourceHash:     strings.TrimSpace(item.SourceHash),
					SourceReadOnly: item.ReadOnly,
					Revision:       1,
					Enabled:        true,
					ParseStatus:    FlowParseStatusParsed,
				}
				if err := txRepo.CreateFlow(ctx, flow); err != nil {
					return err
				}
				created = true
			} else {
				flow.Name = strings.TrimSpace(item.Name)
				flow.Description = strings.TrimSpace(item.Description)
				flow.SourceID = strings.TrimSpace(item.SourceID)
				flow.SourcePath = strings.TrimSpace(item.SourcePath)
				flow.SourceHash = strings.TrimSpace(item.SourceHash)
				flow.SourceReadOnly = item.ReadOnly
				if err := txRepo.UpdateFlow(ctx, flow); err != nil {
					return err
				}
			}

			if err := txRepo.DeleteEdgesByFlow(ctx, flow.ID); err != nil {
				return err
			}
			if err := txRepo.DeleteStepsByFlow(ctx, flow.ID); err != nil {
				return err
			}

			stepPOs := make([]*FlowStepPO, 0, len(item.Steps))
			for _, step := range item.Steps {
				stepType := strings.TrimSpace(step.Type)
				if stepType == "" {
					stepType = "http"
				}
				method := strings.TrimSpace(step.Method)
				if method == "" {
					method = "STEP"
				}
				url := strings.TrimSpace(step.URL)
				if url == "" {
					url = strings.TrimSpace(step.Name)
				}
				stepPOs = append(stepPOs, &FlowStepPO{
					FlowID:    flow.ID,
					ClientKey: normalizeStepClientKey("", step.SourceID),
					SourceID:  strings.TrimSpace(step.SourceID),
					StepType:  stepType,
					Name:      strings.TrimSpace(step.Name),
					SortOrder: step.SortOrder,
					Method:    method,
					URL:       url,
					Headers:   step.Headers,
					Body:      step.Body,
					Captures:  step.Captures,
					Asserts:   step.Asserts,
					PositionX: step.PositionX,
					PositionY: step.PositionY,
				})
			}
			if err := txRepo.BatchCreateSteps(ctx, stepPOs); err != nil {
				return err
			}

			stepIDBySource := make(map[string]string, len(stepPOs))
			for _, step := range stepPOs {
				stepIDBySource[step.SourceID] = step.ID
				stepIDBySource[step.ClientKey] = step.ID
			}

			edgePOs := make([]*FlowEdgePO, 0, len(item.Edges))
			for _, edge := range item.Edges {
				sourceStepID, ok := stepIDBySource[strings.TrimSpace(edge.SourceStepID)]
				if !ok {
					return newFlowError(422, fmt.Sprintf("edge source step %q does not exist", edge.SourceStepID))
				}
				targetStepID, ok := stepIDBySource[strings.TrimSpace(edge.TargetStepID)]
				if !ok {
					return newFlowError(422, fmt.Sprintf("edge target step %q does not exist", edge.TargetStepID))
				}
				edgePOs = append(edgePOs, &FlowEdgePO{
					FlowID:          flow.ID,
					SourceStepID:    sourceStepID,
					TargetStepID:    targetStepID,
					VariableMapping: edge.Condition,
				})
			}
			return txRepo.BatchCreateEdges(ctx, edgePOs)
		})
		if err != nil {
			result.Errors = append(result.Errors, fmt.Sprintf("%s: %v", item.SourcePath, err))
			continue
		}
		if created {
			result.Created++
		} else {
			result.Updated++
		}
	}

	return result, nil
}

func (s *service) SyncFlowRunFromCLI(ctx context.Context, workspaceID string, createdBy string, req *CLIFlowRunSyncRequest) (*CLIFlowSyncResponseBody, error) {
	result := &CLIFlowSyncResponseBody{}
	source := normalizeSource(req.Source)

	if existing, err := s.repo.GetRunBySourceEvent(ctx, source, req.SourceEventID); err == nil && existing != nil {
		result.Skipped++
		return result, nil
	} else if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	flow, err := s.repo.GetFlowBySource(ctx, workspaceID, source, req.Run.SourceFlowID, req.Run.SourcePath)
	if err != nil {
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, err
		}
		flow = &FlowPO{
			WorkspaceID:    workspaceID,
			Name:           fallbackFlowName(req.Run.SourcePath),
			CreatedBy:      createdBy,
			Source:         source,
			SourceID:       strings.TrimSpace(req.Run.SourceFlowID),
			SourcePath:     strings.TrimSpace(req.Run.SourcePath),
			SourceReadOnly: true,
			Revision:       1,
			Enabled:        true,
			ParseStatus:    FlowParseStatusUnparsed,
		}
		if flow.SourceID == "" {
			flow.SourceID = "path:" + flow.SourcePath
		}
		if err := s.repo.CreateFlow(ctx, flow); err != nil {
			return nil, err
		}
	}

	run := &FlowRunPO{
		FlowID:        flow.ID,
		Status:        normalizeRunStatus(req.Run.Status),
		TriggeredBy:   fallbackString(req.Run.TriggeredBy, createdBy),
		ExecutionMode: "cli",
		Source:        source,
		SourceEventID: req.SourceEventID,
		RunnerType:    normalizeRunnerType(req.Run.RunnerType),
		Profile:       strings.TrimSpace(req.Run.Profile),
		Environment:   strings.TrimSpace(req.Run.Environment),
		BaseURL:       strings.TrimSpace(req.Run.BaseURL),
		TotalSteps:    req.Run.TotalSteps,
		PassedSteps:   req.Run.PassedSteps,
		FailedSteps:   req.Run.FailedSteps,
		DurationMs:    req.Run.DurationMs,
		ErrorMessage:  strings.TrimSpace(req.Run.Error),
		LogContent:    req.Run.LogContent,
		LogPath:       strings.TrimSpace(req.Run.LogPath),
		LogExcerpt:    req.Run.LogExcerpt,
		LogTruncated:  req.Run.LogTruncated,
		StartedAt:     timePtr(req.Run.StartedAt),
		FinishedAt:    timePtr(req.Run.FinishedAt),
	}
	if err := s.repo.CreateRun(ctx, run); err != nil {
		return nil, err
	}

	steps, _ := s.repo.ListStepsByFlow(ctx, flow.ID)
	stepIDBySource := make(map[string]string, len(steps))
	stepIDByName := make(map[string]string, len(steps))
	for _, step := range steps {
		stepIDBySource[step.SourceID] = step.ID
		stepIDBySource[step.ClientKey] = step.ID
		stepIDByName[strings.TrimSpace(step.Name)] = step.ID
	}

	for _, item := range req.Results {
		stepID := stepIDBySource[strings.TrimSpace(item.SourceStepID)]
		if stepID == "" {
			stepID = stepIDByName[strings.TrimSpace(item.Name)]
		}
		if stepID == "" {
			stepID = strings.TrimSpace(item.SourceStepID)
		}
		if stepID == "" {
			stepID = strings.TrimSpace(item.Name)
		}
		stepResult := &FlowStepResultPO{
			RunID:         run.ID,
			StepID:        stepID,
			Status:        normalizeRunStatus(item.Status),
			Request:       item.Request,
			Response:      item.Response,
			AssertResults: item.AssertResult,
			DurationMs:    item.DurationMs,
			ErrorMessage:  item.Error,
		}
		if err := s.repo.CreateStepResult(ctx, stepResult); err != nil {
			return nil, err
		}
	}

	result.Created++
	s.recordCLIFlowRunHistory(ctx, workspaceID, createdBy, req, flow.ID, run.ID)
	return result, nil
}

func (s *service) recordCLIFlowRunHistory(ctx context.Context, workspaceID string, createdBy string, req *CLIFlowRunSyncRequest, flowID string, runID string) {
	if s.history == nil {
		return
	}
	action := "run"
	if normalizeRunStatus(req.Run.Status) == RunStatusFailed {
		action = "run_failed"
	}
	_, _ = s.history.Record(ctx, &history.RecordHistoryRequest{
		EntityType:    "flow",
		EntityID:      flowID,
		WorkspaceID:   workspaceID,
		UserID:        createdBy,
		Source:        normalizeSource(req.Source),
		SourceEventID: req.SourceEventID,
		Action:        action,
		Message:       fmt.Sprintf("CLI flow %s %s", req.Run.SourcePath, normalizeRunStatus(req.Run.Status)),
		Data: map[string]interface{}{
			"run":    req.Run,
			"run_id": runID,
			"log": map[string]interface{}{
				"content":   req.Run.LogContent,
				"path":      strings.TrimSpace(req.Run.LogPath),
				"excerpt":   req.Run.LogExcerpt,
				"truncated": req.Run.LogTruncated,
			},
			"results": req.Results,
		},
	})
}

func normalizeSource(source string) string {
	source = strings.TrimSpace(source)
	if source == "" {
		return "cli"
	}
	return source
}

func normalizeRunStatus(status string) string {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case RunStatusPending, RunStatusRunning, RunStatusPassed, RunStatusFailed, RunStatusCanceled:
		return strings.ToLower(strings.TrimSpace(status))
	default:
		return RunStatusFailed
	}
}

func normalizeRunnerType(runnerType string) string {
	switch strings.ToLower(strings.TrimSpace(runnerType)) {
	case "server_ci":
		return "server_ci"
	case "test_machine":
		return "test_machine"
	default:
		return "test_machine"
	}
}

func normalizeOptionalRunnerType(runnerType string) string {
	switch strings.ToLower(strings.TrimSpace(runnerType)) {
	case "server_ci":
		return "server_ci"
	case "test_machine":
		return "test_machine"
	default:
		return ""
	}
}

func normalizeOptionalRunStatus(status string) string {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case RunStatusPending, RunStatusRunning, RunStatusPassed, RunStatusFailed, RunStatusCanceled:
		return strings.ToLower(strings.TrimSpace(status))
	default:
		return ""
	}
}

func fallbackFlowName(sourcePath string) string {
	name := strings.TrimSpace(sourcePath)
	if name == "" {
		return "CLI flow"
	}
	parts := strings.Split(name, "/")
	return parts[len(parts)-1]
}

func fallbackString(value string, fallback string) string {
	if strings.TrimSpace(value) != "" {
		return strings.TrimSpace(value)
	}
	return strings.TrimSpace(fallback)
}

func timePtr(value time.Time) *time.Time {
	if value.IsZero() {
		return nil
	}
	normalized := value.UTC()
	return &normalized
}

func ensureUniqueStepClientKeys(steps []StepResponse) {
	used := make(map[string]struct{}, len(steps))

	for index := range steps {
		base := normalizeStepClientKey(steps[index].ID, steps[index].ClientKey)
		candidate := base
		if _, exists := used[candidate]; exists {
			candidate = fmt.Sprintf("%s-%s", base, steps[index].ID)
			for suffix := 2; ; suffix += 1 {
				if _, exists := used[candidate]; !exists {
					break
				}
				candidate = fmt.Sprintf("%s-%s-%d", base, steps[index].ID, suffix)
			}
		}

		steps[index].ClientKey = candidate
		used[candidate] = struct{}{}
	}
}
