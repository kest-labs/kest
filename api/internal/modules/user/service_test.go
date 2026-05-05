package user

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"golang.org/x/crypto/bcrypt"

	"github.com/kest-labs/kest/api/internal/domain"
	"github.com/kest-labs/kest/api/internal/infra/config"
	"github.com/kest-labs/kest/api/internal/infra/email"
	infraevents "github.com/kest-labs/kest/api/internal/infra/events"
	"github.com/kest-labs/kest/api/internal/infra/jwt"
)

var errStubUserNotFound = errors.New("user not found")

type stubUserRepo struct {
	users      map[string]*domain.User
	createFn   func(*domain.User) error
	updateFn   func(*domain.User) error
	deleteFn   func(string) error
	findAllFn  func(int, int) ([]*domain.User, int64, error)
	searchFn   func(string, int) ([]*domain.User, error)
	deletedIDs []string
}

func newStubUserRepo(users ...*domain.User) *stubUserRepo {
	repo := &stubUserRepo{
		users: make(map[string]*domain.User, len(users)),
	}

	for _, user := range users {
		repo.users[user.ID] = cloneUser(user)
	}

	return repo
}

func newTestService(repo *stubUserRepo) *service {
	email.NewService(&config.Config{
		Email: config.EmailConfig{
			From: "test@example.com",
		},
	})

	return NewService(repo, jwt.NewTestService(), infraevents.NewEventBus())
}

func cloneUser(user *domain.User) *domain.User {
	if user == nil {
		return nil
	}

	cloned := *user
	return &cloned
}

func (r *stubUserRepo) Create(_ context.Context, user *domain.User) error {
	if r.createFn != nil {
		return r.createFn(user)
	}

	if user.ID == "" {
		user.ID = fmt.Sprintf("user-%d", len(r.users)+1)
	}
	r.users[user.ID] = cloneUser(user)
	return nil
}

func (r *stubUserRepo) Update(_ context.Context, user *domain.User) error {
	if r.updateFn != nil {
		return r.updateFn(user)
	}

	r.users[user.ID] = cloneUser(user)
	return nil
}

func (r *stubUserRepo) Delete(_ context.Context, id string) error {
	if r.deleteFn != nil {
		return r.deleteFn(id)
	}

	r.deletedIDs = append(r.deletedIDs, id)
	delete(r.users, id)
	return nil
}

func (r *stubUserRepo) FindByID(_ context.Context, id string) (*domain.User, error) {
	user, ok := r.users[id]
	if !ok {
		return nil, errStubUserNotFound
	}
	return cloneUser(user), nil
}

func (r *stubUserRepo) FindByEmail(_ context.Context, email string) (*domain.User, error) {
	for _, user := range r.users {
		if user.Email == email {
			return cloneUser(user), nil
		}
	}
	return nil, errStubUserNotFound
}

func (r *stubUserRepo) FindByUsername(_ context.Context, username string) (*domain.User, error) {
	for _, user := range r.users {
		if user.Username == username {
			return cloneUser(user), nil
		}
	}
	return nil, errStubUserNotFound
}

func (r *stubUserRepo) FindAll(_ context.Context, page, pageSize int) ([]*domain.User, int64, error) {
	if r.findAllFn != nil {
		return r.findAllFn(page, pageSize)
	}

	users := make([]*domain.User, 0, len(r.users))
	for _, user := range r.users {
		users = append(users, cloneUser(user))
	}
	return users, int64(len(users)), nil
}

func (r *stubUserRepo) Search(_ context.Context, query string, limit int) ([]*domain.User, error) {
	if r.searchFn != nil {
		return r.searchFn(query, limit)
	}

	query = strings.ToLower(strings.TrimSpace(query))
	results := make([]*domain.User, 0, limit)
	for _, user := range r.users {
		if strings.Contains(strings.ToLower(user.Username), query) || strings.Contains(strings.ToLower(user.Email), query) {
			results = append(results, cloneUser(user))
			if len(results) >= limit {
				break
			}
		}
	}
	return results, nil
}

func TestServiceRegisterCreatesHashedPassword(t *testing.T) {
	repo := newStubUserRepo()
	svc := newTestService(repo)

	user, err := svc.Register(context.Background(), &UserRegisterRequest{
		Username: "testuser",
		Password: "password123",
		Email:    "test@example.com",
		Nickname: "Test User",
		Phone:    "1234567890",
	})

	if !assert.NoError(t, err) {
		return
	}

	assert.Equal(t, "testuser", user.Username)
	assert.Equal(t, "test@example.com", user.Email)
	assert.NotEmpty(t, user.ID)
	assert.NotEqual(t, "password123", user.Password)
	assert.NoError(t, bcrypt.CompareHashAndPassword([]byte(user.Password), []byte("password123")))
}

func TestServiceRegisterRejectsExistingEmail(t *testing.T) {
	repo := newStubUserRepo(&domain.User{
		ID:       "1",
		Username: "existing",
		Email:    "existing@example.com",
	})
	svc := newTestService(repo)

	_, err := svc.Register(context.Background(), &UserRegisterRequest{
		Username: "newuser",
		Password: "password123",
		Email:    "existing@example.com",
	})

	assert.ErrorIs(t, err, domain.ErrEmailAlreadyExists)
}

func TestServiceLoginReturnsJWTToken(t *testing.T) {
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.DefaultCost)
	if err != nil {
		t.Fatalf("failed to hash password: %v", err)
	}

	repo := newStubUserRepo(&domain.User{
		ID:       "1",
		Username: "testuser",
		Email:    "test@example.com",
		Password: string(hashedPassword),
		Status:   1,
	})
	svc := newTestService(repo)

	resp, err := svc.Login(context.Background(), &UserLoginRequest{
		Username: "testuser",
		Password: "password123",
	})

	if !assert.NoError(t, err) {
		return
	}

	assert.NotEmpty(t, resp.AccessToken)
	assert.Equal(t, "1", resp.User.ID)
	assert.NotNil(t, repo.users["1"].LastLogin)

	claims, err := svc.jwtService.ParseToken(resp.AccessToken)
	if !assert.NoError(t, err) {
		return
	}
	assert.Equal(t, "1", string(claims.UserID))
	assert.Equal(t, "testuser", claims.Username)
}

func TestServiceGetProfileReturnsNotFound(t *testing.T) {
	svc := newTestService(newStubUserRepo())

	_, err := svc.GetProfile(context.Background(), "missing")

	assert.ErrorIs(t, err, domain.ErrUserNotFound)
}

func TestServiceUpdateProfileUpdatesOnlyNonEmptyFields(t *testing.T) {
	repo := newStubUserRepo(&domain.User{
		ID:       "1",
		Username: "testuser",
		Email:    "test@example.com",
		Nickname: "Old Nickname",
		Avatar:   "old-avatar.jpg",
		Phone:    "1111111111",
		Bio:      "Old bio",
		Status:   1,
	})
	svc := newTestService(repo)

	updated, err := svc.UpdateProfile(context.Background(), "1", &UserUpdateRequest{
		Nickname: "New Nickname",
		Bio:      "Updated bio",
	})

	if !assert.NoError(t, err) {
		return
	}

	assert.Equal(t, "New Nickname", updated.Nickname)
	assert.Equal(t, "old-avatar.jpg", updated.Avatar)
	assert.Equal(t, "1111111111", updated.Phone)
	assert.Equal(t, "Updated bio", updated.Bio)
}

func TestServiceChangePasswordValidatesOldPassword(t *testing.T) {
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte("oldpassword123"), bcrypt.DefaultCost)
	if err != nil {
		t.Fatalf("failed to hash password: %v", err)
	}

	repo := newStubUserRepo(&domain.User{
		ID:       "1",
		Username: "testuser",
		Email:    "test@example.com",
		Password: string(hashedPassword),
		Status:   1,
	})
	svc := newTestService(repo)

	err = svc.ChangePassword(context.Background(), "1", &UserChangePasswordRequest{
		OldPassword: "wrongpassword",
		NewPassword: "newpassword123",
	})

	assert.EqualError(t, err, "incorrect old password")
}

func TestServiceResetPasswordUpdatesStoredPassword(t *testing.T) {
	repo := newStubUserRepo(&domain.User{
		ID:       "1",
		Username: "testuser",
		Email:    "test@example.com",
		Password: "oldhash",
		Status:   1,
	})
	svc := newTestService(repo)

	err := svc.ResetPassword(context.Background(), &UserPasswordResetRequest{
		Email: "test@example.com",
	})

	if !assert.NoError(t, err) {
		return
	}

	assert.NotEqual(t, "oldhash", repo.users["1"].Password)
}

func TestServiceDeleteAccountPassesThrough(t *testing.T) {
	repo := newStubUserRepo(&domain.User{
		ID:       "1",
		Username: "testuser",
		Email:    "test@example.com",
		Status:   1,
	})
	svc := newTestService(repo)

	err := svc.DeleteAccount(context.Background(), "1")

	if !assert.NoError(t, err) {
		return
	}

	assert.Equal(t, []string{"1"}, repo.deletedIDs)
}

func TestServiceListAndSearch(t *testing.T) {
	repo := newStubUserRepo(
		&domain.User{ID: "1", Username: "alpha", Email: "alpha@example.com", Status: 1},
		&domain.User{ID: "2", Username: "beta", Email: "beta@example.com", Status: 1},
	)
	svc := newTestService(repo)

	users, total, err := svc.List(context.Background(), 1, 10)
	if !assert.NoError(t, err) {
		return
	}

	assert.Len(t, users, 2)
	assert.Equal(t, int64(2), total)

	results, err := svc.Search(context.Background(), "alpha", 10)
	if !assert.NoError(t, err) {
		return
	}

	assert.Len(t, results, 1)
	assert.Equal(t, "1", results[0].ID)
}
