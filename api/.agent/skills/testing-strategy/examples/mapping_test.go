package user_test

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/kest-labs/kest/api/internal/domain"
	"github.com/kest-labs/kest/api/internal/modules/user"
)

func TestToResponse(t *testing.T) {
	now := time.Now()

	// Table-driven test cases
	tests := []struct {
		name     string
		input    *domain.User
		expected *user.UserResponse
	}{
		{
			name: "full user mapping",
			input: &domain.User{
				ID:        1,
				Username:  "stark",
				Email:     "stark@example.com",
				CreatedAt: now,
			},
			expected: &user.UserResponse{
				ID:        1,
				Username:  "stark",
				Email:     "stark@example.com",
				CreatedAt: now.Format(time.RFC3339),
			},
		},
		{
			name:     "nil input handling",
			input:    nil,
			expected: nil,
		},
		{
			name:  "empty user mapping",
			input: &domain.User{},
			expected: &user.UserResponse{
				ID: 0,
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := user.ToResponse(tt.input)

			if tt.expected == nil {
				assert.Nil(t, result)
			} else {
				assert.NotNil(t, result)
				assert.Equal(t, tt.expected.ID, result.ID)
				assert.Equal(t, tt.expected.Username, result.Username)
				assert.Equal(t, tt.expected.Email, result.Email)
				if tt.expected.CreatedAt != "" {
					assert.Equal(t, tt.expected.CreatedAt, result.CreatedAt)
				}
			}
		})
	}
}
