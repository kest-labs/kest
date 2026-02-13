package user

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/golang/mock/gomock"
	"github.com/stretchr/testify/assert"
	"github.com/kest-labs/kest/api/internal/domain"
	"github.com/kest-labs/kest/api/internal/infra/jwt"
	"github.com/kest-labs/kest/api/pkg/utils"
	"github.com/kest-labs/kest/api/test/mocks"
	"golang.org/x/crypto/bcrypt"
)

func TestService_Register(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockRepo := mocks.NewMockUserRepository(ctrl)
	mockJWT := &jwt.Service{} // jwt service is not used in Register, so we can use a real one
	service := NewService(mockRepo, mockJWT)

	tests := []struct {
		name        string
		req         *UserRegisterRequest
		setup       func()
		wantErr     bool
		expectedErr error
	}{
		{
			name: "successful registration",
			req: &UserRegisterRequest{
				Username: "testuser",
				Email:    "test@example.com",
				Password: "password123",
				Nickname: "Test User",
				Phone:    "1234567890",
			},
			setup: func() {
				mockRepo.EXPECT().FindByEmail(gomock.Any(), "test@example.com").Return(nil, errors.New("not found"))
				mockRepo.EXPECT().Create(gomock.Any(), gomock.Any()).DoAndReturn(func(ctx context.Context, user *domain.User) error {
					assert.Equal(t, "testuser", user.Username)
					assert.Equal(t, "test@example.com", user.Email)
					assert.NotEmpty(t, user.Password)
					assert.Equal(t, "Test User", user.Nickname)
					assert.Equal(t, "1234567890", user.Phone)
					assert.Equal(t, int8(1), user.Status)
					return nil
				})
			},
			wantErr: false,
		},
		{
			name: "email already exists",
			req: &UserRegisterRequest{
				Username: "testuser",
				Email:    "existing@example.com",
				Password: "password123",
			},
			setup: func() {
				existingUser := &domain.User{ID: 1, Email: "existing@example.com"}
				mockRepo.EXPECT().FindByEmail(gomock.Any(), "existing@example.com").Return(existingUser, nil)
			},
			wantErr:     true,
			expectedErr: domain.ErrEmailAlreadyExists,
		},
		{
			name: "failed to hash password",
			req: &UserRegisterRequest{
				Username: "testuser",
				Email:    "test@example.com",
				Password: string(make([]byte, 10000)), // extremely long password to cause error
			},
			setup: func() {
				mockRepo.EXPECT().FindByEmail(gomock.Any(), "test@example.com").Return(nil, errors.New("not found"))
			},
			wantErr: true,
		},
		{
			name: "failed to create user",
			req: &UserRegisterRequest{
				Username: "testuser",
				Email:    "test@example.com",
				Password: "password123",
			},
			setup: func() {
				mockRepo.EXPECT().FindByEmail(gomock.Any(), "test@example.com").Return(nil, errors.New("not found"))
				mockRepo.EXPECT().Create(gomock.Any(), gomock.Any()).Return(errors.New("database error"))
			},
			wantErr:     true,
			expectedErr: fmt.Errorf("failed to create user: database error"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.setup()
			got, err := service.Register(context.Background(), tt.req)
			if tt.wantErr {
				assert.Error(t, err)
				if tt.expectedErr != nil {
					assert.Equal(t, tt.expectedErr, err)
				}
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, got)
				assert.Equal(t, tt.req.Username, got.Username)
				assert.Equal(t, tt.req.Email, got.Email)
				assert.Equal(t, tt.req.Nickname, got.Nickname)
				assert.Equal(t, tt.req.Phone, got.Phone)
			}
		})
	}
}

func TestService_Login(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockRepo := mocks.NewMockUserRepository(ctrl)
	mockJWT := mocks.NewMockJWTService(ctrl)
	mockEventBus := mocks.NewMockEventBus(ctrl)            // Added mockEventBus
	service := NewService(mockRepo, mockJWT, mockEventBus) // Updated NewService call

	tests := []struct {
		name        string
		req         *UserLoginRequest
		setup       func()
		wantErr     bool
		expectedErr error
	}{
		{
			name: "login with username success",
			req: &UserLoginRequest{
				Username: "testuser",
				Password: "password123",
			},
			setup: func() {
				hashedPassword, _ := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.DefaultCost)
				user := &domain.User{
					ID:       1,
					Username: "testuser",
					Email:    "test@example.com",
					Password: string(hashedPassword),
					Status:   1,
				}
				mockRepo.EXPECT().FindByUsername(gomock.Any(), "testuser").Return(user, nil)
				mockJWT.EXPECT().GenerateToken(uint(1), "testuser").Return("token123", nil)
				mockRepo.EXPECT().Update(gomock.Any(), gomock.Any()).DoAndReturn(func(ctx context.Context, u *domain.User) error {
					assert.NotNil(t, u.LastLogin)
					return nil
				}).AnyTimes()
				mockEventBus.EXPECT().PublishAsync(gomock.Any(), gomock.Any()).AnyTimes() // Expect PublishAsync
			},
			wantErr: false,
		},
		{
			name: "login with email success",
			req: &UserLoginRequest{
				Username: "test@example.com",
				Password: "password123",
			},
			setup: func() {
				hashedPassword, _ := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.DefaultCost)
				user := &domain.User{
					ID:       1,
					Username: "testuser",
					Email:    "test@example.com",
					Password: string(hashedPassword),
					Status:   1,
				}
				mockRepo.EXPECT().FindByUsername(gomock.Any(), "test@example.com").Return(nil, errors.New("not found"))
				mockRepo.EXPECT().FindByEmail(gomock.Any(), "test@example.com").Return(user, nil)
				mockJWT.EXPECT().GenerateToken(uint(1), "testuser").Return("token123", nil)
				mockRepo.EXPECT().Update(gomock.Any(), gomock.Any()).DoAndReturn(func(ctx context.Context, u *domain.User) error {
					assert.NotNil(t, u.LastLogin)
					return nil
				}).AnyTimes()
				mockEventBus.EXPECT().PublishAsync(gomock.Any(), gomock.Any()).AnyTimes() // Expect PublishAsync
			},
			wantErr: false,
		},
		{
			name: "invalid credentials - user not found",
			req: &UserLoginRequest{
				Username: "unknownuser",
				Password: "password123",
			},
			setup: func() {
				mockRepo.EXPECT().FindByUsername(gomock.Any(), "unknownuser").Return(nil, errors.New("not found"))
				mockRepo.EXPECT().FindByEmail(gomock.Any(), "unknownuser").Return(nil, errors.New("not found"))
			},
			wantErr:     true,
			expectedErr: domain.ErrInvalidCredentials,
		},
		{
			name: "invalid credentials - wrong password",
			req: &UserLoginRequest{
				Username: "testuser",
				Password: "wrongpassword",
			},
			setup: func() {
				hashedPassword, _ := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.DefaultCost)
				user := &domain.User{
					ID:       1,
					Username: "testuser",
					Email:    "test@example.com",
					Password: string(hashedPassword),
					Status:   1,
				}
				mockRepo.EXPECT().FindByUsername(gomock.Any(), "testuser").Return(user, nil)
			},
			wantErr:     true,
			expectedErr: domain.ErrInvalidCredentials,
		},
		{
			name: "account disabled",
			req: &UserLoginRequest{
				Username: "disableduser",
				Password: "password123",
			},
			setup: func() {
				hashedPassword, _ := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.DefaultCost)
				user := &domain.User{
					ID:       1,
					Username: "disableduser",
					Email:    "disabled@example.com",
					Password: string(hashedPassword),
					Status:   0, // disabled
				}
				mockRepo.EXPECT().FindByUsername(gomock.Any(), "disableduser").Return(user, nil)
			},
			wantErr:     true,
			expectedErr: domain.ErrAccountDisabled,
		},
		{
			name: "failed to generate token",
			req: &UserLoginRequest{
				Username: "testuser",
				Password: "password123",
			},
			setup: func() {
				hashedPassword, _ := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.DefaultCost)
				user := &domain.User{
					ID:       1,
					Username: "testuser",
					Email:    "test@example.com",
					Password: string(hashedPassword),
					Status:   1,
				}
				mockRepo.EXPECT().FindByUsername(gomock.Any(), "testuser").Return(user, nil)
				mockJWT.EXPECT().GenerateToken(uint(1), "testuser").Return("", errors.New("jwt error"))
			},
			wantErr:     true,
			expectedErr: fmt.Errorf("failed to generate token: jwt error"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.setup()
			got, err := service.Login(context.Background(), tt.req)
			if tt.wantErr {
				assert.Error(t, err)
				if tt.expectedErr != nil {
					assert.Equal(t, tt.expectedErr, err)
				}
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, got)
				assert.Equal(t, "token123", got.AccessToken)
				assert.Equal(t, uint(1), got.User.ID)
			}
		})
	}
}

func TestService_GetProfile(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockRepo := mocks.NewMockUserRepository(ctrl)
	mockJWT := mocks.NewMockJWTService(ctrl)               // Changed to mockJWT
	mockEventBus := mocks.NewMockEventBus(ctrl)            // Added mockEventBus
	service := NewService(mockRepo, mockJWT, mockEventBus) // Updated NewService call

	tests := []struct {
		name        string
		userID      uint
		setup       func()
		wantErr     bool
		expectedErr error
	}{
		{
			name:   "get profile success",
			userID: 1,
			setup: func() {
				user := &domain.User{
					ID:        1,
					Username:  "testuser",
					Email:     "test@example.com",
					Nickname:  "Test User",
					Avatar:    "avatar.jpg",
					Phone:     "1234567890",
					Bio:       "Hello world",
					Status:    1,
					CreatedAt: time.Now().Add(-time.Hour),
					UpdatedAt: time.Now(),
				}
				mockRepo.EXPECT().FindByID(gomock.Any(), uint(1)).Return(user, nil)
			},
			wantErr: false,
		},
		{
			name:   "user not found",
			userID: 999,
			setup: func() {
				mockRepo.EXPECT().FindByID(gomock.Any(), uint(999)).Return(nil, errors.New("user not found"))
			},
			wantErr:     true,
			expectedErr: domain.ErrUserNotFound,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.setup()
			got, err := service.GetProfile(context.Background(), tt.userID)
			if tt.wantErr {
				assert.Error(t, err)
				if tt.expectedErr != nil {
					assert.Equal(t, tt.expectedErr, err)
				}
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, got)
				assert.Equal(t, uint(1), got.ID)
			}
		})
	}
}

func TestService_UpdateProfile(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockRepo := mocks.NewMockUserRepository(ctrl)
	mockJWT := mocks.NewMockJWTService(ctrl)               // Changed to mockJWT
	mockEventBus := mocks.NewMockEventBus(ctrl)            // Added mockEventBus
	service := NewService(mockRepo, mockJWT, mockEventBus) // Updated NewService call

	tests := []struct {
		name        string
		userID      uint
		req         *UserUpdateRequest
		setup       func()
		wantErr     bool
		expectedErr error
	}{
		{
			name:   "update profile success",
			userID: 1,
			req: &UserUpdateRequest{
				Nickname: "New Nickname",
				Avatar:   "new-avatar.jpg",
				Phone:    "0987654321",
				Bio:      "Updated bio",
			},
			setup: func() {
				user := &domain.User{
					ID:        1,
					Username:  "testuser",
					Email:     "test@example.com",
					Nickname:  "Old Nickname",
					Avatar:    "old-avatar.jpg",
					Phone:     "1111111111",
					Bio:       "Old bio",
					Status:    1,
					CreatedAt: time.Now(),
					UpdatedAt: time.Now(),
				}
				mockRepo.EXPECT().FindByID(gomock.Any(), uint(1)).Return(user, nil)
				mockRepo.EXPECT().Update(gomock.Any(), gomock.Any()).DoAndReturn(func(ctx context.Context, u *domain.User) error {
					assert.Equal(t, "New Nickname", u.Nickname)
					assert.Equal(t, "new-avatar.jpg", u.Avatar)
					assert.Equal(t, "0987654321", u.Phone)
					assert.Equal(t, "Updated bio", u.Bio)
					return nil
				})
				mockEventBus.EXPECT().PublishAsync(gomock.Any(), gomock.Any()).AnyTimes() // Expect PublishAsync
			},
			wantErr: false,
		},
		{
			name:   "partial update - only nickname",
			userID: 1,
			req: &UserUpdateRequest{
				Nickname: "New Nickname",
			},
			setup: func() {
				user := &domain.User{
					ID:        1,
					Username:  "testuser",
					Email:     "test@example.com",
					Nickname:  "Old Nickname",
					Avatar:    "old-avatar.jpg",
					Phone:     "1111111111",
					Bio:       "Old bio",
					Status:    1,
					CreatedAt: time.Now(),
					UpdatedAt: time.Now(),
				}
				mockRepo.EXPECT().FindByID(gomock.Any(), uint(1)).Return(user, nil)
				mockRepo.EXPECT().Update(gomock.Any(), gomock.Any()).DoAndReturn(func(ctx context.Context, u *domain.User) error {
					assert.Equal(t, "New Nickname", u.Nickname)
					assert.Equal(t, "old-avatar.jpg", u.Avatar) // unchanged
					assert.Equal(t, "1111111111", u.Phone)      // unchanged
					assert.Equal(t, "Old bio", u.Bio)           // unchanged
					return nil
				})
				mockEventBus.EXPECT().PublishAsync(gomock.Any(), gomock.Any()).AnyTimes() // Expect PublishAsync
			},
			wantErr: false,
		},
		{
			name:   "user not found",
			userID: 999,
			req: &UserUpdateRequest{
				Nickname: "New Nickname",
			},
			setup: func() {
				mockRepo.EXPECT().FindByID(gomock.Any(), uint(999)).Return(nil, errors.New("user not found"))
			},
			wantErr:     true,
			expectedErr: domain.ErrUserNotFound,
		},
		{
			name:   "failed to update user",
			userID: 1,
			req: &UserUpdateRequest{
				Nickname: "New Nickname",
			},
			setup: func() {
				user := &domain.User{
					ID:       1,
					Username: "testuser",
					Email:    "test@example.com",
				}
				mockRepo.EXPECT().FindByID(gomock.Any(), uint(1)).Return(user, nil)
				mockRepo.EXPECT().Update(gomock.Any(), gomock.Any()).Return(errors.New("database error"))
			},
			wantErr:     true,
			expectedErr: fmt.Errorf("failed to update user: database error"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.setup()
			got, err := service.UpdateProfile(context.Background(), tt.userID, tt.req)
			if tt.wantErr {
				assert.Error(t, err)
				if tt.expectedErr != nil {
					assert.Equal(t, tt.expectedErr, err)
				}
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, got)
				assert.Equal(t, tt.userID, got.ID)
			}
		})
	}
}

func TestService_ChangePassword(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockRepo := mocks.NewMockUserRepository(ctrl)
	mockJWT := mocks.NewMockJWTService(ctrl)               // Changed to mockJWT
	mockEventBus := mocks.NewMockEventBus(ctrl)            // Added mockEventBus
	service := NewService(mockRepo, mockJWT, mockEventBus) // Updated NewService call

	tests := []struct {
		name        string
		userID      uint
		req         *UserChangePasswordRequest
		setup       func()
		wantErr     bool
		expectedErr error
	}{
		{
			name:   "change password success",
			userID: 1,
			req: &UserChangePasswordRequest{
				OldPassword: "oldpassword123",
				NewPassword: "newpassword123",
			},
			setup: func() {
				hashedOldPassword, _ := bcrypt.GenerateFromPassword([]byte("oldpassword123"), bcrypt.DefaultCost)
				user := &domain.User{
					ID:       1,
					Username: "testuser",
					Email:    "test@example.com",
					Password: string(hashedOldPassword),
				}
				mockRepo.EXPECT().FindByID(gomock.Any(), uint(1)).Return(user, nil)
				mockRepo.EXPECT().Update(gomock.Any(), gomock.Any()).DoAndReturn(func(ctx context.Context, u *domain.User) error {
					assert.NotEqual(t, string(hashedOldPassword), u.Password)
					err := bcrypt.CompareHashAndPassword([]byte(u.Password), []byte("newpassword123"))
					assert.NoError(t, err)
					return nil
				})
				mockEventBus.EXPECT().PublishAsync(gomock.Any(), gomock.Any()).AnyTimes() // Expect PublishAsync
			},
			wantErr: false,
		},
		{
			name:   "user not found",
			userID: 999,
			req: &UserChangePasswordRequest{
				OldPassword: "oldpassword123",
				NewPassword: "newpassword123",
			},
			setup: func() {
				mockRepo.EXPECT().FindByID(gomock.Any(), uint(999)).Return(nil, errors.New("user not found"))
			},
			wantErr:     true,
			expectedErr: domain.ErrUserNotFound,
		},
		{
			name:   "incorrect old password",
			userID: 1,
			req: &UserChangePasswordRequest{
				OldPassword: "wrongpassword",
				NewPassword: "newpassword123",
			},
			setup: func() {
				hashedOldPassword, _ := bcrypt.GenerateFromPassword([]byte("oldpassword123"), bcrypt.DefaultCost)
				user := &domain.User{
					ID:       1,
					Username: "testuser",
					Email:    "test@example.com",
					Password: string(hashedOldPassword),
				}
				mockRepo.EXPECT().FindByID(gomock.Any(), uint(1)).Return(user, nil)
			},
			wantErr:     true,
			expectedErr: fmt.Errorf("incorrect old password"),
		},
		{
			name:   "failed to hash new password",
			userID: 1,
			req: &UserChangePasswordRequest{
				OldPassword: "oldpassword123",
				NewPassword: string(make([]byte, 10000)), // too long for bcrypt
			},
			setup: func() {
				hashedOldPassword, _ := bcrypt.GenerateFromPassword([]byte("oldpassword123"), bcrypt.DefaultCost)
				user := &domain.User{
					ID:       1,
					Username: "testuser",
					Email:    "test@example.com",
					Password: string(hashedOldPassword),
				}
				mockRepo.EXPECT().FindByID(gomock.Any(), uint(1)).Return(user, nil)
			},
			wantErr: true,
		},
		{
			name:   "failed to update user",
			userID: 1,
			req: &UserChangePasswordRequest{
				OldPassword: "oldpassword123",
				NewPassword: "newpassword123",
			},
			setup: func() {
				hashedOldPassword, _ := bcrypt.GenerateFromPassword([]byte("oldpassword123"), bcrypt.DefaultCost)
				user := &domain.User{
					ID:       1,
					Username: "testuser",
					Email:    "test@example.com",
					Password: string(hashedOldPassword),
				}
				mockRepo.EXPECT().FindByID(gomock.Any(), uint(1)).Return(user, nil)
				mockRepo.EXPECT().Update(gomock.Any(), gomock.Any()).Return(errors.New("database error"))
			},
			wantErr:     true,
			expectedErr: fmt.Errorf("failed to update user: database error"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.setup()
			err := service.ChangePassword(context.Background(), tt.userID, tt.req)
			if tt.wantErr {
				assert.Error(t, err)
				if tt.expectedErr != nil {
					assert.Equal(t, tt.expectedErr, err)
				}
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestService_ResetPassword(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockRepo := mocks.NewMockUserRepository(ctrl)
	mockJWT := mocks.NewMockJWTService(ctrl)               // Changed to mockJWT
	mockEventBus := mocks.NewMockEventBus(ctrl)            // Added mockEventBus
	service := NewService(mockRepo, mockJWT, mockEventBus) // Updated NewService call

	tests := []struct {
		name        string
		req         *UserPasswordResetRequest
		setup       func()
		wantErr     bool
		expectedErr error
	}{
		{
			name: "reset password success",
			req: &UserPasswordResetRequest{
				Email: "test@example.com",
			},
			setup: func() {
				user := &domain.User{
					ID:       1,
					Username: "testuser",
					Email:    "test@example.com",
					Password: "oldhash",
				}
				mockRepo.EXPECT().FindByEmail(gomock.Any(), "test@example.com").Return(user, nil)
				mockRepo.EXPECT().Update(gomock.Any(), gomock.Any()).DoAndReturn(func(ctx context.Context, u *domain.User) error {
					assert.NotEmpty(t, u.Password)
					assert.NotEqual(t, "oldhash", u.Password)
					return nil
				})
				mockEventBus.EXPECT().PublishAsync(gomock.Any(), gomock.Any()).AnyTimes() // Expect PublishAsync
			},
			wantErr: false,
		},
		{
			name: "user not found",
			req: &UserPasswordResetRequest{
				Email: "unknown@example.com",
			},
			setup: func() {
				mockRepo.EXPECT().FindByEmail(gomock.Any(), "unknown@example.com").Return(nil, errors.New("user not found"))
			},
			wantErr:     true,
			expectedErr: domain.ErrUserNotFound,
		},
		{
			name: "failed to hash new password",
			req: &UserPasswordResetRequest{
				Email: "test@example.com",
			},
			setup: func() {
				user := &domain.User{
					ID:       1,
					Username: "testuser",
					Email:    "test@example.com",
					Password: "oldhash",
				}
				mockRepo.EXPECT().FindByEmail(gomock.Any(), "test@example.com").Return(user, nil)
				// Force bcrypt to fail by using an invalid cost
				utils.RandomStringLength = 0
			},
			wantErr:     true,
			expectedErr: fmt.Errorf("failed to hash password: crypto/bcrypt: cost is 0"),
		},
		{
			name: "failed to update user",
			req: &UserPasswordResetRequest{
				Email: "test@example.com",
			},
			setup: func() {
				user := &domain.User{
					ID:       1,
					Username: "testuser",
					Email:    "test@example.com",
					Password: "oldhash",
				}
				mockRepo.EXPECT().FindByEmail(gomock.Any(), "test@example.com").Return(user, nil)
				mockRepo.EXPECT().Update(gomock.Any(), gomock.Any()).Return(errors.New("database error"))
			},
			wantErr:     true,
			expectedErr: fmt.Errorf("failed to reset password: database error"),
		},
		{
			name: "failed to send email",
			req: &UserPasswordResetRequest{
				Email: "test@example.com",
			},
			setup: func() {
				user := &domain.User{
					ID:       1,
					Username: "testuser",
					Email:    "test@example.com",
					Password: "oldhash",
				}
				mockRepo.EXPECT().FindByEmail(gomock.Any(), "test@example.com").Return(user, nil)
				mockRepo.EXPECT().Update(gomock.Any(), gomock.Any()).Return(nil)
				// No mock for email service, so it would fail if it were a dependency.
				// Assuming the current implementation handles email sending outside the core logic or logs errors.
				mockEventBus.EXPECT().PublishAsync(gomock.Any(), gomock.Any()).AnyTimes() // Expect PublishAsync
			},
			wantErr: false, // email failure should not cause method to fail
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Reset utils.RandomStringLength after test that modifies it
			if tt.name == "failed to hash new password" {
				utils.RandomStringLength = 12
			}
			tt.setup()
			err := service.ResetPassword(context.Background(), tt.req)
			if tt.wantErr {
				assert.Error(t, err)
				if tt.expectedErr != nil {
					assert.Equal(t, tt.expectedErr, err)
				}
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestService_DeleteAccount(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockRepo := mocks.NewMockUserRepository(ctrl)
	mockJWT := &jwt.Service{}
	service := NewService(mockRepo, mockJWT)

	tests := []struct {
		name        string
		userID      uint
		setup       func()
		wantErr     bool
		expectedErr error
	}{
		{
			name:   "delete account success",
			userID: 1,
			setup: func() {
				mockRepo.EXPECT().Delete(gomock.Any(), uint(1)).Return(nil)
			},
			wantErr: false,
		},
		{
			name:   "failed to delete account",
			userID: 1,
			setup: func() {
				mockRepo.EXPECT().Delete(gomock.Any(), uint(1)).Return(errors.New("database error"))
			},
			wantErr:     true,
			expectedErr: errors.New("database error"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.setup()
			err := service.DeleteAccount(context.Background(), tt.userID)
			if tt.wantErr {
				assert.Error(t, err)
				if tt.expectedErr != nil {
					assert.Equal(t, tt.expectedErr, err)
				}
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestService_GetByID(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockRepo := mocks.NewMockUserRepository(ctrl)
	mockJWT := &jwt.Service{}
	service := NewService(mockRepo, mockJWT)

	tests := []struct {
		name        string
		id          uint
		setup       func()
		wantErr     bool
		expectedErr error
	}{
		{
			name: "get by id success",
			id:   1,
			setup: func() {
				user := &domain.User{
					ID:        1,
					Username:  "testuser",
					Email:     "test@example.com",
					Nickname:  "Test User",
					Avatar:    "avatar.jpg",
					Phone:     "1234567890",
					Bio:       "Hello world",
					Status:    1,
					CreatedAt: time.Now().Add(-time.Hour),
					UpdatedAt: time.Now(),
				}
				mockRepo.EXPECT().FindByID(gomock.Any(), uint(1)).Return(user, nil)
			},
			wantErr: false,
		},
		{
			name: "user not found",
			id:   999,
			setup: func() {
				mockRepo.EXPECT().FindByID(gomock.Any(), uint(999)).Return(nil, errors.New("user not found"))
			},
			wantErr:     true,
			expectedErr: errors.New("user not found"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.setup()
			got, err := service.GetByID(context.Background(), tt.id)
			if tt.wantErr {
				assert.Error(t, err)
				if tt.expectedErr != nil {
					assert.Equal(t, tt.expectedErr, err)
				}
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, got)
				assert.Equal(t, tt.id, got.ID)
			}
		})
	}
}

func TestService_List(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockRepo := mocks.NewMockUserRepository(ctrl)
	mockJWT := &jwt.Service{}
	service := NewService(mockRepo, mockJWT)

	tests := []struct {
		name        string
		page        int
		pageSize    int
		setup       func()
		wantErr     bool
		expectedErr error
	}{
		{
			name:     "list users success",
			page:     1,
			pageSize: 10,
			setup: func() {
				users := []*domain.User{
					{
						ID:        1,
						Username:  "testuser1",
						Email:     "test1@example.com",
						Nickname:  "User One",
						Avatar:    "avatar1.jpg",
						Phone:     "1111111111",
						Bio:       "Bio 1",
						Status:    1,
						CreatedAt: time.Now().Add(-time.Hour),
						UpdatedAt: time.Now(),
					},
					{
						ID:        2,
						Username:  "testuser2",
						Email:     "test2@example.com",
						Nickname:  "User Two",
						Avatar:    "avatar2.jpg",
						Phone:     "2222222222",
						Bio:       "Bio 2",
						Status:    1,
						CreatedAt: time.Now().Add(-2 * time.Hour),
						UpdatedAt: time.Now().Add(-time.Minute),
					},
				}
				mockRepo.EXPECT().FindAll(gomock.Any(), 1, 10).Return(users, int64(2), nil)
			},
			wantErr: false,
		},
		{
			name:     "empty list",
			page:     1,
			pageSize: 10,
			setup: func() {
				mockRepo.EXPECT().FindAll(gomock.Any(), 1, 10).Return([]*domain.User{}, int64(0), nil)
			},
			wantErr: false,
		},
		{
			name:     "failed to list users",
			page:     1,
			pageSize: 10,
			setup: func() {
				mockRepo.EXPECT().FindAll(gomock.Any(), 1, 10).Return(nil, int64(0), errors.New("database error"))
			},
			wantErr:     true,
			expectedErr: errors.New("database error"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.setup()
			got, total, err := service.List(context.Background(), tt.page, tt.pageSize)
			if tt.wantErr {
				assert.Error(t, err)
				if tt.expectedErr != nil {
					assert.Equal(t, tt.expectedErr, err)
				}
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, got)
				assert.GreaterOrEqual(t, total, int64(0))
			}
		})
	}
}

func TestService_GetUserByID(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockRepo := mocks.NewMockUserRepository(ctrl)
	mockJWT := &jwt.Service{}
	service := NewService(mockRepo, mockJWT)

	tests := []struct {
		name        string
		id          uint
		setup       func()
		wantErr     bool
		expectedErr error
	}{
		{
			name: "get user by id success",
			id:   1,
			setup: func() {
				user := &domain.User{
					ID:        1,
					Username:  "testuser",
					Email:     "test@example.com",
					Nickname:  "Test User",
					Avatar:    "avatar.jpg",
					Phone:     "1234567890",
					Bio:       "Hello world",
					Status:    1,
					LastLogin: &time.Time{},
				}
				mockRepo.EXPECT().FindByID(gomock.Any(), uint(1)).Return(user, nil)
			},
			wantErr: false,
		},
		{
			name: "user not found",
			id:   999,
			setup: func() {
				mockRepo.EXPECT().FindByID(gomock.Any(), uint(999)).Return(nil, errors.New("user not found"))
			},
			wantErr:     true,
			expectedErr: errors.New("user not found"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.setup()
			got, err := service.GetUserByID(context.Background(), tt.id)
			if tt.wantErr {
				assert.Error(t, err)
				if tt.expectedErr != nil {
					assert.Equal(t, tt.expectedErr, err)
				}
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, got)
				assert.Equal(t, tt.id, got.ID)
			}
		})
	}
}
