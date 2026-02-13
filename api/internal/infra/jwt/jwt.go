package jwt

import (
	"fmt"
	"time"

	"github.com/kest-labs/kest/api/internal/infra/config"
	"github.com/golang-jwt/jwt/v5"
)

// Service provides JWT helpers bound to a configuration instance.
// Injected via Wire DI - no global state.
type Service struct {
	secret string
	expire time.Duration
}

// NewService constructs a JWT service using the provided configuration.
// This is the Wire provider function.
func NewService(cfg *config.Config) *Service {
	return &Service{
		secret: cfg.JWT.Secret,
		expire: cfg.JWT.ExpireDuration(),
	}
}

// NewTestService creates a JWT service for testing with default values.
func NewTestService() *Service {
	return &Service{
		secret: "test-secret-key-for-testing-only",
		expire: time.Hour,
	}
}

// Claims represents custom JWT claims
type Claims struct {
	UserID   uint   `json:"user_id"`
	Username string `json:"username"`
	jwt.RegisteredClaims
}

// GenerateToken generates a JWT token
func (s *Service) GenerateToken(userID uint, username string) (string, error) {
	now := time.Now()
	claims := Claims{
		UserID:   userID,
		Username: username,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(s.expire)),
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(s.secret))
}

// ParseToken parses and validates a JWT token
func (s *Service) ParseToken(tokenString string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(s.secret), nil
	})

	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(*Claims); ok && token.Valid {
		return claims, nil
	}

	return nil, fmt.Errorf("invalid token")
}
