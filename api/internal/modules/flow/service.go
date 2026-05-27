package flow

import (
	"context"
	"fmt"
	"strings"
)

// Service defines the business logic interface for flows
type Service interface {
	// Flow CRUD
	CreateFlow(ctx context.Context, workspaceID string, userID string, req *CreateFlowRequest) (*FlowResponse, error)
	GetFlow(ctx context.Context, workspaceID, id string) (*FlowDetailResponse, error)
	ListFlows(ctx context.Context, workspaceID string) ([]*FlowResponse, error)
	UpdateFlow(ctx context.Context, workspaceID, id string, req *UpdateFlowRequest) (*FlowResponse, error)
	DeleteFlow(ctx context.Context, workspaceID, id string) error
	SaveFlow(ctx context.Context, workspaceID, id string, req *SaveFlowRequest) (*FlowDetailResponse, error)

	// Step CRUD
	CreateStep(ctx context.Context, flowID string, req *CreateStepRequest) (*StepResponse, error)
	UpdateStep(ctx context.Context, id string, req *UpdateStepRequest) (*StepResponse, error)
	DeleteStep(ctx context.Context, id string) error

	// Edge CRUD
	CreateEdge(ctx context.Context, flowID string, req *CreateEdgeRequest) (*EdgeResponse, error)
	UpdateEdge(ctx context.Context, id string, req *UpdateEdgeRequest) (*EdgeResponse, error)
	DeleteEdge(ctx context.Context, id string) error

	// Run
	RunFlow(ctx context.Context, workspaceID, flowID string, userID string) (*RunResponse, error)
	ExecuteFlow(ctx context.Context, runID string, baseURL string, events chan<- StepEvent) error
	GetRun(ctx context.Context, runID string) (*RunResponse, error)
	ListRuns(ctx context.Context, flowID string) ([]*RunResponse, error)
}

type service struct {
	repo Repository
}

// NewService creates a new flow service
func NewService(repo Repository) Service {
	return &service{repo: repo}
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
	}
	if err := s.repo.CreateFlow(ctx, flow); err != nil {
		return nil, err
	}
	return ToFlowResponse(flow), nil
}

func (s *service) GetFlow(ctx context.Context, workspaceID, id string) (*FlowDetailResponse, error) {
	flow, err := s.repo.GetFlowByIDAndWorkspace(ctx, id, workspaceID)
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
		responses = append(responses, resp)
	}
	return responses, nil
}

func (s *service) UpdateFlow(ctx context.Context, workspaceID, id string, req *UpdateFlowRequest) (*FlowResponse, error) {
	flow, err := s.repo.GetFlowByIDAndWorkspace(ctx, id, workspaceID)
	if err != nil {
		return nil, newFlowError(404, "flow not found")
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

	if err := s.repo.UpdateFlow(ctx, flow); err != nil {
		return nil, err
	}
	return ToFlowResponse(flow), nil
}

func (s *service) DeleteFlow(ctx context.Context, workspaceID, id string) error {
	_, err := s.repo.GetFlowByIDAndWorkspace(ctx, id, workspaceID)
	if err != nil {
		return newFlowError(404, "flow not found")
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

func (s *service) SaveFlow(ctx context.Context, workspaceID, id string, req *SaveFlowRequest) (*FlowDetailResponse, error) {
	if _, err := s.repo.GetFlowByIDAndWorkspace(ctx, id, workspaceID); err != nil {
		return nil, newFlowError(404, "flow not found")
	}
	if err := validateSaveGraph(req.Steps, req.Edges); err != nil {
		return nil, err
	}

	if err := s.repo.WithTransaction(ctx, func(txRepo Repository) error {
		flow, err := txRepo.GetFlowByIDAndWorkspace(ctx, id, workspaceID)
		if err != nil {
			return newFlowError(404, "flow not found")
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

	return s.GetFlow(ctx, workspaceID, id)
}

// --- Step CRUD ---

func (s *service) CreateStep(ctx context.Context, flowID string, req *CreateStepRequest) (*StepResponse, error) {
	_, err := s.repo.GetFlowByID(ctx, flowID)
	if err != nil {
		return nil, newFlowError(404, "flow not found")
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
	_, err := s.repo.GetStepByID(ctx, id)
	if err != nil {
		return newFlowError(404, "step not found")
	}
	return s.repo.DeleteStep(ctx, id)
}

// --- Edge CRUD ---

func (s *service) CreateEdge(ctx context.Context, flowID string, req *CreateEdgeRequest) (*EdgeResponse, error) {
	_, err := s.repo.GetFlowByID(ctx, flowID)
	if err != nil {
		return nil, newFlowError(404, "flow not found")
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
	_, err := s.repo.GetEdgeByID(ctx, id)
	if err != nil {
		return newFlowError(404, "edge not found")
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

func (s *service) RunFlow(ctx context.Context, workspaceID, flowID string, userID string) (*RunResponse, error) {
	flowDetail, err := s.GetFlow(ctx, workspaceID, flowID)
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

func (s *service) ListRuns(ctx context.Context, flowID string) ([]*RunResponse, error) {
	runs, err := s.repo.ListRunsByFlow(ctx, flowID)
	if err != nil {
		return nil, err
	}

	responses := make([]*RunResponse, 0, len(runs))
	for _, run := range runs {
		responses = append(responses, ToRunResponse(run))
	}
	return responses, nil
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
