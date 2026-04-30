package platformsync

import (
	"encoding/json"
	"regexp"
	"slices"
	"strings"
)

const (
	DefaultBodyLimit = 12000
	DefaultLogLimit  = 12000
)

var (
	sensitiveHeaderNames = []string{
		"authorization",
		"cookie",
		"set-cookie",
		"x-api-key",
		"proxy-authorization",
	}
	sensitiveFieldNames = []string{
		"password",
		"pass",
		"token",
		"access_token",
		"refresh_token",
		"secret",
		"client_secret",
		"api_key",
		"apikey",
		"authorization",
		"cookie",
	}
	headerLinePattern = regexp.MustCompile(`(?im)^([ \t]*)(authorization|cookie|set-cookie|x-api-key|proxy-authorization)(\s*:\s*)(.+)$`)
)

func SanitizeStringMap(input map[string]string) map[string]string {
	if len(input) == 0 {
		return nil
	}

	output := make(map[string]string, len(input))
	for key, value := range input {
		if isSensitiveKey(key) {
			output[key] = "[REDACTED]"
			continue
		}
		output[key] = sanitizeLooseText(value)
	}
	return output
}

func SanitizeStringSliceMap(input map[string][]string) map[string][]string {
	if len(input) == 0 {
		return nil
	}

	output := make(map[string][]string, len(input))
	for key, values := range input {
		if isSensitiveKey(key) {
			output[key] = []string{"[REDACTED]"}
			continue
		}
		next := make([]string, 0, len(values))
		for _, value := range values {
			next = append(next, sanitizeLooseText(value))
		}
		output[key] = next
	}
	return output
}

func SanitizeBody(value string) (string, bool) {
	return sanitizeStructuredText(value, DefaultBodyLimit)
}

func SanitizeLogExcerpt(value string) (string, bool) {
	return sanitizeStructuredText(value, DefaultLogLimit)
}

func SanitizeJSONPayload(raw json.RawMessage) any {
	if len(raw) == 0 {
		return nil
	}

	var payload any
	if err := json.Unmarshal(raw, &payload); err != nil {
		return sanitizeLooseText(string(raw))
	}
	return sanitizeAny(payload)
}

func SanitizeValue(value any) any {
	return sanitizeAny(value)
}

func sanitizeStructuredText(value string, limit int) (string, bool) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return "", false
	}

	var payload any
	if err := json.Unmarshal([]byte(trimmed), &payload); err == nil {
		sanitized, marshalErr := json.Marshal(sanitizeAny(payload))
		if marshalErr == nil {
			return truncateString(string(sanitized), limit)
		}
	}

	return truncateString(sanitizeLooseText(trimmed), limit)
}

func sanitizeLooseText(value string) string {
	value = headerLinePattern.ReplaceAllString(value, "${1}${2}${3}[REDACTED]")
	for _, key := range sensitiveFieldNames {
		pattern := regexp.MustCompile(`(?i)("` + regexp.QuoteMeta(key) + `"\s*:\s*")([^"]*)(")`)
		value = pattern.ReplaceAllString(value, `$1[REDACTED]$3`)
	}
	return value
}

func sanitizeAny(value any) any {
	switch typed := value.(type) {
	case map[string]any:
		output := make(map[string]any, len(typed))
		for key, item := range typed {
			if isSensitiveKey(key) {
				output[key] = "[REDACTED]"
				continue
			}
			output[key] = sanitizeAny(item)
		}
		return output
	case map[string]string:
		return SanitizeStringMap(typed)
	case map[string][]string:
		return SanitizeStringSliceMap(typed)
	case []any:
		output := make([]any, 0, len(typed))
		for _, item := range typed {
			output = append(output, sanitizeAny(item))
		}
		return output
	case []string:
		output := make([]string, 0, len(typed))
		for _, item := range typed {
			output = append(output, sanitizeLooseText(item))
		}
		return output
	case string:
		return sanitizeLooseText(typed)
	default:
		return value
	}
}

func truncateString(value string, limit int) (string, bool) {
	if limit <= 0 || len(value) <= limit {
		return value, false
	}
	if limit <= 3 {
		return value[:limit], true
	}
	return value[:limit-3] + "...", true
}

func isSensitiveKey(key string) bool {
	normalized := strings.ToLower(strings.TrimSpace(key))
	if normalized == "" {
		return false
	}

	if slices.Contains(sensitiveHeaderNames, normalized) {
		return true
	}
	if slices.Contains(sensitiveFieldNames, normalized) {
		return true
	}
	return strings.Contains(normalized, "secret") || strings.Contains(normalized, "token")
}
