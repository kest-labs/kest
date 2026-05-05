package flow

import (
	"errors"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestParseVariableMappingRules(t *testing.T) {
	t.Run("accepts valid json rules", func(t *testing.T) {
		rules, err := parseVariableMappingRules(`[{"source":"token","target":"authToken"}]`)
		require.NoError(t, err)
		require.Len(t, rules, 1)
		assert.Equal(t, "token", rules[0].Source)
		assert.Equal(t, "authToken", rules[0].Target)
	})

	t.Run("rejects invalid json", func(t *testing.T) {
		_, err := parseVariableMappingRules(`{invalid}`)
		require.Error(t, err)

		var flowErr *FlowError
		require.True(t, errors.As(err, &flowErr))
		assert.Equal(t, http.StatusUnprocessableEntity, flowErr.Status)
		assert.Equal(t, "variable_mapping must be valid JSON", flowErr.Message)
	})

	t.Run("rejects blank source or target", func(t *testing.T) {
		_, err := parseVariableMappingRules(`[{"source":"token","target":""}]`)
		require.Error(t, err)

		var flowErr *FlowError
		require.True(t, errors.As(err, &flowErr))
		assert.Equal(t, http.StatusUnprocessableEntity, flowErr.Status)
		assert.Equal(t, "variable_mapping rules require non-empty source and target", flowErr.Message)
	})
}

func TestValidateSaveGraph(t *testing.T) {
	validSteps := []SaveStepRequest{
		{ClientKey: "login", Name: "Login", Method: "POST", URL: "/login"},
		{ClientKey: "profile", Name: "Profile", Method: "GET", URL: "/profile"},
	}

	t.Run("accepts a valid dag", func(t *testing.T) {
		err := validateSaveGraph(validSteps, []SaveEdgeRequest{
			{
				SourceClientKey: "login",
				TargetClientKey: "profile",
				VariableMapping: `[{"source":"token","target":"authToken"}]`,
			},
		})
		require.NoError(t, err)
	})

	t.Run("rejects duplicate client keys", func(t *testing.T) {
		err := validateSaveGraph([]SaveStepRequest{
			{ClientKey: "dup", Name: "One", Method: "GET", URL: "/one"},
			{ClientKey: "dup", Name: "Two", Method: "GET", URL: "/two"},
		}, nil)
		require.Error(t, err)

		var flowErr *FlowError
		require.True(t, errors.As(err, &flowErr))
		assert.Equal(t, http.StatusUnprocessableEntity, flowErr.Status)
		assert.Equal(t, `duplicate step client_key "dup"`, flowErr.Message)
	})

	t.Run("rejects cycles", func(t *testing.T) {
		err := validateSaveGraph(validSteps, []SaveEdgeRequest{
			{SourceClientKey: "login", TargetClientKey: "profile"},
			{SourceClientKey: "profile", TargetClientKey: "login"},
		})
		require.Error(t, err)

		var flowErr *FlowError
		require.True(t, errors.As(err, &flowErr))
		assert.Equal(t, http.StatusUnprocessableEntity, flowErr.Status)
		assert.Equal(t, "flow edges cannot form cycles", flowErr.Message)
	})
}

func TestValidateStoredGraph_AllowsLegacyStepsWithoutClientKeys(t *testing.T) {
	err := validateStoredGraph(
		[]*FlowStepPO{
			{ID: "11", ClientKey: "", SortOrder: 0},
			{ID: "22", ClientKey: "", SortOrder: 1},
		},
		[]*FlowEdgePO{
			{SourceStepID: "11", TargetStepID: "22"},
		},
	)
	require.NoError(t, err)
}
