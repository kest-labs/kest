package flow

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type runnerRepoStub struct {
	stepResultsByRun map[uint][]*FlowStepResultPO
	updatedRuns      []*FlowRunPO
	updatedResults   map[uint]*FlowStepResultPO
}

type roundTripFunc func(*http.Request) (*http.Response, error)

func (fn roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return fn(req)
}

var _ Repository = (*runnerRepoStub)(nil)

func newRunnerRepoStub(runID uint, stepIDs ...uint) *runnerRepoStub {
	results := make([]*FlowStepResultPO, 0, len(stepIDs))
	for index, stepID := range stepIDs {
		results = append(results, &FlowStepResultPO{
			ID:     uint(index + 1),
			RunID:  runID,
			StepID: stepID,
			Status: RunStatusPending,
		})
	}

	return &runnerRepoStub{
		stepResultsByRun: map[uint][]*FlowStepResultPO{runID: results},
		updatedResults:   make(map[uint]*FlowStepResultPO),
	}
}

func (r *runnerRepoStub) CreateFlow(context.Context, *FlowPO) error {
	panic("unexpected CreateFlow call")
}
func (r *runnerRepoStub) GetFlowByID(context.Context, uint) (*FlowPO, error) {
	panic("unexpected GetFlowByID call")
}
func (r *runnerRepoStub) ListFlowsByProject(context.Context, uint) ([]*FlowPO, error) {
	panic("unexpected ListFlowsByProject call")
}
func (r *runnerRepoStub) UpdateFlow(context.Context, *FlowPO) error {
	panic("unexpected UpdateFlow call")
}
func (r *runnerRepoStub) DeleteFlow(context.Context, uint) error { panic("unexpected DeleteFlow call") }

func (r *runnerRepoStub) CreateStep(context.Context, *FlowStepPO) error {
	panic("unexpected CreateStep call")
}
func (r *runnerRepoStub) GetStepByID(context.Context, uint) (*FlowStepPO, error) {
	panic("unexpected GetStepByID call")
}
func (r *runnerRepoStub) ListStepsByFlow(context.Context, uint) ([]*FlowStepPO, error) {
	panic("unexpected ListStepsByFlow call")
}
func (r *runnerRepoStub) UpdateStep(context.Context, *FlowStepPO) error {
	panic("unexpected UpdateStep call")
}
func (r *runnerRepoStub) DeleteStep(context.Context, uint) error { panic("unexpected DeleteStep call") }
func (r *runnerRepoStub) DeleteStepsByFlow(context.Context, uint) error {
	panic("unexpected DeleteStepsByFlow call")
}

func (r *runnerRepoStub) CreateEdge(context.Context, *FlowEdgePO) error {
	panic("unexpected CreateEdge call")
}
func (r *runnerRepoStub) GetEdgeByID(context.Context, uint) (*FlowEdgePO, error) {
	panic("unexpected GetEdgeByID call")
}
func (r *runnerRepoStub) ListEdgesByFlow(context.Context, uint) ([]*FlowEdgePO, error) {
	panic("unexpected ListEdgesByFlow call")
}
func (r *runnerRepoStub) UpdateEdge(context.Context, *FlowEdgePO) error {
	panic("unexpected UpdateEdge call")
}
func (r *runnerRepoStub) DeleteEdge(context.Context, uint) error { panic("unexpected DeleteEdge call") }
func (r *runnerRepoStub) DeleteEdgesByFlow(context.Context, uint) error {
	panic("unexpected DeleteEdgesByFlow call")
}

func (r *runnerRepoStub) CreateRun(context.Context, *FlowRunPO) error {
	panic("unexpected CreateRun call")
}
func (r *runnerRepoStub) GetRunByID(context.Context, uint) (*FlowRunPO, error) {
	panic("unexpected GetRunByID call")
}
func (r *runnerRepoStub) ListRunsByFlow(context.Context, uint) ([]*FlowRunPO, error) {
	panic("unexpected ListRunsByFlow call")
}
func (r *runnerRepoStub) UpdateRun(_ context.Context, run *FlowRunPO) error {
	copyRun := *run
	r.updatedRuns = append(r.updatedRuns, &copyRun)
	return nil
}

func (r *runnerRepoStub) CreateStepResult(context.Context, *FlowStepResultPO) error {
	panic("unexpected CreateStepResult call")
}
func (r *runnerRepoStub) ListStepResultsByRun(_ context.Context, runID uint) ([]*FlowStepResultPO, error) {
	return r.stepResultsByRun[runID], nil
}
func (r *runnerRepoStub) UpdateStepResult(_ context.Context, result *FlowStepResultPO) error {
	copyResult := *result
	r.updatedResults[result.StepID] = &copyResult
	return nil
}

func (r *runnerRepoStub) BatchCreateSteps(context.Context, []*FlowStepPO) error {
	panic("unexpected BatchCreateSteps call")
}
func (r *runnerRepoStub) BatchCreateEdges(context.Context, []*FlowEdgePO) error {
	panic("unexpected BatchCreateEdges call")
}
func (r *runnerRepoStub) WithTransaction(context.Context, func(Repository) error) error {
	panic("unexpected WithTransaction call")
}

func executeTwoStepFlow(t *testing.T, variableMapping string, downstreamHeaders string) (*runnerRepoStub, *FlowRunPO) {
	t.Helper()

	originalTransport := http.DefaultTransport
	http.DefaultTransport = roundTripFunc(func(r *http.Request) (*http.Response, error) {
		var (
			statusCode = http.StatusNotFound
			body       = `{"error":"not found"}`
		)

		switch r.URL.Path {
		case "/login":
			statusCode = http.StatusOK
			body = `{"data":{"access_token":"token-123"}}`
		case "/profile":
			if r.Header.Get("Authorization") == "Bearer token-123" {
				statusCode = http.StatusOK
				body = `{"data":{"id":42}}`
			} else {
				statusCode = http.StatusUnauthorized
				body = `{"error":"unauthorized"}`
			}
		}

		return &http.Response{
			StatusCode: statusCode,
			Header: http.Header{
				"Content-Type": []string{"application/json"},
			},
			Body:    io.NopCloser(strings.NewReader(body)),
			Request: r,
		}, nil
	})
	t.Cleanup(func() {
		http.DefaultTransport = originalTransport
	})

	repo := newRunnerRepoStub(1, 101, 202)
	runner := NewRunner(repo, "mock://flow")
	run := &FlowRunPO{
		ID:     1,
		FlowID: 99,
		Status: RunStatusPending,
	}
	steps := []FlowStepPO{
		{
			ID:        101,
			FlowID:    99,
			ClientKey: "login",
			Name:      "Login",
			SortOrder: 0,
			Method:    http.MethodPost,
			URL:       "/login",
			Captures:  "token: data.access_token",
			Asserts:   "status == 200",
		},
		{
			ID:        202,
			FlowID:    99,
			ClientKey: "profile",
			Name:      "Profile",
			SortOrder: 1,
			Method:    http.MethodGet,
			URL:       "/profile",
			Headers:   downstreamHeaders,
			Asserts:   "status == 200",
		},
	}
	edges := []FlowEdgePO{
		{
			FlowID:          99,
			SourceStepID:    101,
			TargetStepID:    202,
			VariableMapping: variableMapping,
		},
	}

	err := runner.Execute(context.Background(), run, steps, edges, make(chan StepEvent, 8))
	require.NoError(t, err)

	return repo, run
}

func TestRunnerExecute_UsesExplicitEdgeMappings(t *testing.T) {
	repo, run := executeTwoStepFlow(
		t,
		`[{"source":"token","target":"authToken"}]`,
		`{"Authorization":"Bearer {{authToken}}"}`,
	)

	require.NotEmpty(t, repo.updatedRuns)
	assert.Equal(t, RunStatusRunning, repo.updatedRuns[0].Status)
	assert.Equal(t, RunStatusPassed, run.Status)

	profileResult := repo.updatedResults[202]
	require.NotNil(t, profileResult)
	assert.Equal(t, RunStatusPassed, profileResult.Status)

	var requestPayload map[string]any
	require.NoError(t, json.Unmarshal([]byte(profileResult.Request), &requestPayload))
	assert.Equal(t, `{"Authorization":"Bearer token-123"}`, requestPayload["headers"])
}

func TestRunnerExecute_FailsWhenRenamedVariableHasNoEdgeMapping(t *testing.T) {
	repo, run := executeTwoStepFlow(
		t,
		`[]`,
		`{"Authorization":"Bearer {{authToken}}"}`,
	)

	assert.Equal(t, RunStatusFailed, run.Status)

	profileResult := repo.updatedResults[202]
	require.NotNil(t, profileResult)
	assert.Equal(t, RunStatusFailed, profileResult.Status)
	assert.Equal(t, "unresolved variables: authToken", profileResult.ErrorMessage)
}

func TestRunnerExecute_KeepsLegacyGlobalVariablesWorking(t *testing.T) {
	repo, run := executeTwoStepFlow(
		t,
		`[]`,
		`{"Authorization":"Bearer {{token}}"}`,
	)

	assert.Equal(t, RunStatusPassed, run.Status)

	profileResult := repo.updatedResults[202]
	require.NotNil(t, profileResult)
	assert.Equal(t, RunStatusPassed, profileResult.Status)
}

func TestRunnerProcessCaptures_SupportsBodyPrefixAndArrayIndexes(t *testing.T) {
	runner := NewRunner(newRunnerRepoStub(1), "mock://flow")
	variables := map[string]any{}
	responseData := map[string]any{
		"data": map[string]any{
			"token": "token-123",
			"items": []any{
				map[string]any{"id": "item-1"},
			},
		},
	}

	captured := runner.processCaptures(
		"authToken: body.data.token\nitemId = data.items[0].id",
		http.StatusOK,
		responseData,
		variables,
	)

	assert.Equal(t, "token-123", captured["authToken"])
	assert.Equal(t, "item-1", captured["itemId"])
	assert.Equal(t, "token-123", variables["authToken"])
	assert.Equal(t, "item-1", variables["itemId"])
}
