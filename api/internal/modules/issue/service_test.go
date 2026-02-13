package issue

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/kest-labs/kest/api/internal/modules/envelope"
)

// mockRepository is a mock implementation of the Repository interface
type mockRepository struct {
	mock.Mock
}

func (m *mockRepository) GetByFingerprint(ctx context.Context, projectID uint64, fingerprint string) (*Issue, error) {
	args := m.Called(ctx, projectID, fingerprint)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*Issue), args.Error(1)
}

func (m *mockRepository) List(ctx context.Context, projectID uint64, opts ListOptions) ([]*Issue, int64, error) {
	args := m.Called(ctx, projectID, opts)
	if args.Get(0) == nil {
		return nil, args.Get(1).(int64), args.Error(2)
	}
	return args.Get(0).([]*Issue), args.Get(1).(int64), args.Error(2)
}

func (m *mockRepository) UpdateStatus(ctx context.Context, projectID uint64, fingerprint string, status IssueStatus) error {
	args := m.Called(ctx, projectID, fingerprint, status)
	return args.Error(0)
}

func (m *mockRepository) GetEvents(ctx context.Context, projectID uint64, fingerprint string, opts EventListOptions) ([]*envelope.Event, int64, error) {
	args := m.Called(ctx, projectID, fingerprint, opts)
	if args.Get(0) == nil {
		return nil, args.Get(1).(int64), args.Error(2)
	}
	return args.Get(0).([]*envelope.Event), args.Get(1).(int64), args.Error(2)
}

func (m *mockRepository) InitSchema(ctx context.Context) error {
	args := m.Called(ctx)
	return args.Error(0)
}

func TestService_GetIssue(t *testing.T) {
	ctx := context.Background()
	projectID := uint64(1)
	fingerprint := "test-fingerprint"

	t.Run("success", func(t *testing.T) {
		repo := new(mockRepository)
		service := NewService(repo)
		issue := &Issue{
			ProjectID:   projectID,
			Fingerprint: fingerprint,
			LastLevel:   "error",
			Status:      IssueStatusUnresolved,
		}
		events := []*envelope.Event{
			{EventID: "e1"},
		}

		repo.On("GetByFingerprint", mock.Anything, projectID, fingerprint).Return(issue, nil)
		repo.On("GetEvents", mock.Anything, projectID, fingerprint, mock.Anything).Return(events, int64(1), nil)

		detail, err := service.GetIssue(ctx, projectID, fingerprint)

		assert.NoError(t, err)
		assert.NotNil(t, detail)
		assert.Equal(t, fingerprint, detail.Fingerprint)
		assert.Len(t, detail.RecentEvents, 1)
		repo.AssertExpectations(t)
	})

	t.Run("not found", func(t *testing.T) {
		repo := new(mockRepository)
		service := NewService(repo)
		repo.On("GetByFingerprint", mock.Anything, projectID, fingerprint).Return(nil, errors.New("not found"))

		detail, err := service.GetIssue(ctx, projectID, fingerprint)

		assert.Error(t, err)
		assert.Nil(t, detail)
		assert.Contains(t, err.Error(), "not found")
		repo.AssertExpectations(t)
	})
}

func TestService_ListIssues(t *testing.T) {
	ctx := context.Background()
	projectID := uint64(1)
	opts := ListOptions{Page: 1, PerPage: 20}

	t.Run("success", func(t *testing.T) {
		repo := new(mockRepository)
		service := NewService(repo)
		issues := []*Issue{
			{Fingerprint: "f1"},
		}
		repo.On("List", mock.Anything, projectID, opts).Return(issues, int64(1), nil)

		resp, err := service.ListIssues(ctx, projectID, opts)

		assert.NoError(t, err)
		assert.Len(t, resp.Items, 1)
		assert.Equal(t, int64(1), resp.Total)
		repo.AssertExpectations(t)
	})
}

func TestService_StatusManagement(t *testing.T) {
	ctx := context.Background()
	projectID := uint64(1)
	fingerprint := "test-fingerprint"

	t.Run("resolve", func(t *testing.T) {
		repo := new(mockRepository)
		service := NewService(repo)
		repo.On("UpdateStatus", mock.Anything, projectID, fingerprint, IssueStatusResolved).Return(nil)
		err := service.ResolveIssue(ctx, projectID, fingerprint)
		assert.NoError(t, err)
		repo.AssertExpectations(t)
	})

	t.Run("ignore", func(t *testing.T) {
		repo := new(mockRepository)
		service := NewService(repo)
		repo.On("UpdateStatus", mock.Anything, projectID, fingerprint, IssueStatusIgnored).Return(nil)
		err := service.IgnoreIssue(ctx, projectID, fingerprint)
		assert.NoError(t, err)
		repo.AssertExpectations(t)
	})

	t.Run("reopen", func(t *testing.T) {
		repo := new(mockRepository)
		service := NewService(repo)
		repo.On("UpdateStatus", mock.Anything, projectID, fingerprint, IssueStatusUnresolved).Return(nil)
		err := service.ReopenIssue(ctx, projectID, fingerprint)
		assert.NoError(t, err)
		repo.AssertExpectations(t)
	})
}

func TestService_GetIssueEvents(t *testing.T) {
	ctx := context.Background()
	projectID := uint64(1)
	fingerprint := "test-fingerprint"
	opts := EventListOptions{Page: 1, PerPage: 10}

	t.Run("success", func(t *testing.T) {
		repo := new(mockRepository)
		service := NewService(repo)
		events := []*envelope.Event{
			{EventID: "e1"},
			{EventID: "e2"},
		}
		repo.On("GetEvents", mock.Anything, projectID, fingerprint, opts).Return(events, int64(2), nil)

		resp, err := service.GetIssueEvents(ctx, projectID, fingerprint, opts)

		assert.NoError(t, err)
		assert.Len(t, resp.Items, 2)
		assert.Equal(t, int64(2), resp.Total)
		repo.AssertExpectations(t)
	})
}
