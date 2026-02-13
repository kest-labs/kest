package email

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/kest-labs/kest/api/internal/infra/config"
	"github.com/kest-labs/kest/api/pkg/logger"
)

var (
	// defaultService is kept for backward compatibility with middleware.
	// New code should use Wire DI instead.
	defaultService *Service
)

// Service encapsulates email sending logic with bound configuration.
// Injected via Wire DI - no global state in new code.
type Service struct {
	from   string
	apiKey string
}

// NewService constructs an email service for the provided configuration.
// This is the Wire provider function.
func NewService(cfg *config.Config) *Service {
	svc := &Service{
		from:   cfg.Email.From,
		apiKey: cfg.Email.ResendAPIKey,
	}
	// Set as default for backward compatibility
	defaultService = svc
	return svc
}

// NewTestService creates an email service for testing (no-op).
func NewTestService() *Service {
	return &Service{
		from:   "test@example.com",
		apiKey: "test-api-key",
	}
}

type EmailRequest struct {
	From    string   `json:"from"`
	To      []string `json:"to"`
	Subject string   `json:"subject"`
	Html    string   `json:"html"`
}

type EmailResponse struct {
	ID      string `json:"id"`
	From    string `json:"from"`
	To      string `json:"to"`
	Created string `json:"created"`
	Error   string `json:"error"`
}

// SendEmail sends an email
func (s *Service) SendEmail(to []string, subject, htmlContent string) error {
	if s.apiKey == "" {
		logger.Warn("Email service not configured, skipping email", map[string]any{
			"to":      to,
			"subject": subject,
		})
		return nil
	}

	logger.Info("Preparing to send email", map[string]any{
		"from":    s.from,
		"to":      to,
		"subject": subject,
	})

	reqBody := EmailRequest{
		From:    s.from,
		To:      to,
		Subject: subject,
		Html:    htmlContent,
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		logger.Error("Failed to serialize request", map[string]any{"error": err})
		return fmt.Errorf("failed to marshal email request: %w", err)
	}

	logger.Info("Request data", map[string]any{"data": string(jsonData)})

	req, err := http.NewRequest("POST", "https://api.resend.com/emails", bytes.NewBuffer(jsonData))
	if err != nil {
		logger.Error("Failed to create request", map[string]any{"error": err})
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.apiKey)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		logger.Error("Failed to send request", map[string]any{"error": err})
		return fmt.Errorf("failed to send email: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		logger.Error("Failed to read response", map[string]any{"error": err})
		return fmt.Errorf("failed to read response body: %w", err)
	}

	logger.Info("Received response", map[string]any{"body": string(body)})

	if resp.StatusCode == http.StatusForbidden {
		var resendError struct {
			Name       string `json:"name"`
			Message    string `json:"message"`
			StatusCode int    `json:"statusCode"`
		}
		if err := json.Unmarshal(body, &resendError); err != nil {
			logger.Error("Failed to parse error response", map[string]any{"error": err})
			return fmt.Errorf("failed to unmarshal error response: %w", err)
		}
		logger.Error("Resend API error", map[string]any{
			"name":       resendError.Name,
			"message":    resendError.Message,
			"statusCode": resendError.StatusCode,
		})
		if resendError.Name == "validation_error" && strings.Contains(resendError.Message, "domain is not verified") {
			return fmt.Errorf("recipient domain not verified, please contact admin to add domain verification")
		}
		return fmt.Errorf("Resend API error: %s", resendError.Message)
	}

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		logger.Error("Email sending failed", map[string]any{
			"status":   resp.StatusCode,
			"response": string(body),
		})
		return fmt.Errorf("failed to send email: status code %d, response: %s", resp.StatusCode, string(body))
	}

	var emailResp EmailResponse
	if err := json.Unmarshal(body, &emailResp); err != nil {
		logger.Error("Failed to parse response", map[string]any{"error": err})
		return fmt.Errorf("failed to unmarshal response: %w", err)
	}

	if emailResp.Error != "" {
		logger.Error("Email service error", map[string]any{"error": emailResp.Error})
		return fmt.Errorf("email service error: %s", emailResp.Error)
	}

	logger.Info("Email sent successfully", map[string]any{"id": emailResp.ID})
	return nil
}

// SendEmail sends an email using the global service instance.
// Deprecated: Use Wire DI to inject *Service instead.
func SendEmail(to []string, subject, htmlContent string) error {
	if defaultService == nil {
		return fmt.Errorf("email service not initialized")
	}
	return defaultService.SendEmail(to, subject, htmlContent)
}

// SendPasswordResetEmail sends a password reset notification email
func SendPasswordResetEmail(to string, newPassword string) error {
	subject := "Password Reset Notification"
	htmlContent := fmt.Sprintf(`
		<h2>Password Reset Notification</h2>
		<p>Your password has been reset. The new temporary password is:</p>
		<p style="font-size: 18px; font-weight: bold; color: #333;">%s</p>
		<p>Please use this temporary password to log in and change it to your own password immediately.</p>
		<p>If this was not your action, please contact the administrator immediately.</p>
	`, newPassword)

	return SendEmail([]string{to}, subject, htmlContent)
}

// SendWelcomeEmail sends a welcome email
func SendWelcomeEmail(to string, username string) error {
	subject := "Welcome to ZGO"
	htmlContent := fmt.Sprintf(`
		<h2>Welcome to ZGO</h2>
		<p>Dear %s,</p>
		<p>Thank you for registering as our user!</p>
		<p>If you have any questions, please feel free to contact our support team.</p>
	`, username)

	return SendEmail([]string{to}, subject, htmlContent)
}
