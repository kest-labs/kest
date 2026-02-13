package user_test

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/kest-labs/kest/api/internal/domain"
	"github.com/kest-labs/kest/api/internal/modules/user"
)

// =============================================================================
// Mock Definitions
// =============================================================================

// MockRepository is a mock implementation of the user.Repository interface
type MockRepository struct {
	mock.Mock
}

func (m *MockRepository) GetByID(ctx context.Context, id uint) (*domain.User, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.User), args.Error(1)
}

func (m *MockRepository) Create(ctx context.Context, u *domain.User) error {
	args := m.Called(ctx, u)
	return args.Error(0)
}

// =============================================================================
// Unit Tests
// =============================================================================

func TestService_GetByID(t *testing.T) {
	// 1. Setup
	mockRepo := new(MockRepository)
	svc := user.NewService(mockRepo) // Assume NewService accepts the interface
	ctx := context.Background()

	t.Run("success case", func(t *testing.T) {
		// 2. Expectations
		expectedUser := &domain.User{ID: 1, Username: "stark"}
		mockRepo.On("GetByID", ctx, uint(1)).Return(expectedUser, nil).Once()

		// 3. Execution
		result, err := svc.GetByID(ctx, 1)

		// 4. Assertions
		assert.NoError(t, err)
		assert.Equal(t, expectedUser, result)
		mockRepo.AssertExpectations(t)
	})

	t.Run("not found case", func(t *testing.T) {
		// 2. Expectations
		mockRepo.On("GetByID", ctx, uint(999)).Return(nil, errors.New("not found")).Once()

		// 3. Execution
		result, err := svc.GetByID(ctx, 999)

		// 4. Assertions
		assert.Error(t, err)
		assert.Nil(t, result)
		assert.Contains(t, err.Error(), "not found")
		mockRepo.AssertExpectations(t)
	})
}

func TestService_Create(t *testing.T) {
	mockRepo := new(MockRepository)
	svc := user.NewService(mockRepo)
	ctx := context.Background()

	t.Run("successful creation", func(t *testing.T) {
		newUser := &domain.User{Username: "newuser", Email: "new@example.com"}

		// Mock expectation with specific argument check
		mockRepo.On("Create", ctx, mock.MatchedBy(func(u *domain.User) bool {
			return u.Username == "newuser"
		})).Return(nil).Once()

		err := svc.Create(ctx, newUser)

		assert.NoError(t, err)
		mockRepo.AssertExpectations(t)
	})
}
