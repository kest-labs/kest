package importer

import (
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"unicode"
)

var placeholderRe = regexp.MustCompile(`\{\{\s*([^{}|]+?)\s*(\|[^{}]*)?\}\}`)

// postmanDynamicVars maps Postman dynamic variables to Kest built-ins.
var postmanDynamicVars = map[string]string{
	"$guid":               "$uuid",
	"$randomUUID":         "$uuid",
	"$timestamp":          "$timestamp",
	"$isoTimestamp":       "$isoDate",
	"$randomInt":          "$randomInt",
	"$randomEmail":        "$randomEmail",
	"$randomExampleEmail": "$randomEmail",
}

// VarName converts an arbitrary variable name (baseUrl, user-id, API Key) to
// the snake_case form Kest uses (base_url, user_id, api_key).
//
// Kest reads environment variables through a case-insensitive config loader,
// so mixed-case names would not resolve reliably; snake_case avoids that.
func VarName(name string) string {
	name = strings.TrimSpace(name)
	if strings.HasPrefix(name, "$") {
		return name
	}
	runes := []rune(name)
	var b strings.Builder
	for i, r := range runes {
		switch {
		case unicode.IsUpper(r):
			if i > 0 {
				prev := runes[i-1]
				nextLower := i+1 < len(runes) && unicode.IsLower(runes[i+1])
				if unicode.IsLower(prev) || unicode.IsDigit(prev) || (unicode.IsUpper(prev) && nextLower) {
					b.WriteRune('_')
				}
			}
			b.WriteRune(unicode.ToLower(r))
		case unicode.IsLetter(r) || unicode.IsDigit(r):
			b.WriteRune(unicode.ToLower(r))
		default:
			b.WriteRune('_')
		}
	}
	out := b.String()
	for strings.Contains(out, "__") {
		out = strings.ReplaceAll(out, "__", "_")
	}
	out = strings.Trim(out, "_")
	if out == "" {
		return "var"
	}
	if out[0] >= '0' && out[0] <= '9' {
		out = "v_" + out
	}
	return out
}

// Slug converts a display name into a lowercase identifier for step IDs and file names.
func Slug(name string) string {
	var b strings.Builder
	lastDash := true
	for _, r := range strings.ToLower(strings.TrimSpace(name)) {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			b.WriteRune(r)
			lastDash = false
			continue
		}
		if !lastDash {
			b.WriteRune('-')
			lastDash = true
		}
	}
	out := strings.Trim(b.String(), "-")
	if len(out) > 60 {
		out = strings.Trim(out[:60], "-")
	}
	return out
}

// uniqueName returns base, or base-2, base-3... when base is already used.
func uniqueName(base string, used map[string]bool) string {
	if base == "" {
		base = "step"
	}
	name := base
	for i := 2; used[name]; i++ {
		name = base + "-" + strconv.Itoa(i)
	}
	used[name] = true
	return name
}

// renameVars rewrites {{var}} placeholders to Kest variable names and maps
// supported dynamic variables. Unknown dynamic variables are reported via onUnknown.
func renameVars(s string, onUnknown func(string)) string {
	if !strings.Contains(s, "{{") {
		return s
	}
	return placeholderRe.ReplaceAllStringFunc(s, func(m string) string {
		sub := placeholderRe.FindStringSubmatch(m)
		name := strings.TrimSpace(sub[1])
		if strings.HasPrefix(name, "$") {
			if mapped, ok := postmanDynamicVars[name]; ok {
				return "{{" + mapped + "}}"
			}
			if isKestBuiltin(name) {
				return m
			}
			if onUnknown != nil {
				onUnknown(name)
			}
			return m
		}
		return "{{" + VarName(name) + sub[2] + "}}"
	})
}

func isKestBuiltin(name string) bool {
	switch name {
	case "$randomInt", "$timestamp", "$uuid", "$randomEmail", "$randomString", "$isoDate", "$unixMs":
		return true
	}
	return strings.HasPrefix(name, "$env.")
}

// referencedVars lists non-builtin variable names used in s.
func referencedVars(s string) []string {
	var out []string
	for _, m := range placeholderRe.FindAllStringSubmatch(s, -1) {
		name := strings.TrimSpace(m[1])
		if strings.HasPrefix(name, "$") || strings.TrimSpace(m[2]) != "" {
			continue
		}
		out = append(out, name)
	}
	return out
}

// isPureVar reports whether s is exactly one {{var}} placeholder and returns its name.
func isPureVar(s string) (string, bool) {
	s = strings.TrimSpace(s)
	m := placeholderRe.FindStringSubmatch(s)
	if m == nil || m[0] != s {
		return "", false
	}
	return strings.TrimSpace(m[1]), true
}

// encodeFormValue URL-encodes a form value while keeping {{var}} placeholders intact.
func encodeFormValue(s string) string {
	var b strings.Builder
	last := 0
	for _, loc := range placeholderRe.FindAllStringIndex(s, -1) {
		b.WriteString(url.QueryEscape(s[last:loc[0]]))
		b.WriteString(s[loc[0]:loc[1]])
		last = loc[1]
	}
	b.WriteString(url.QueryEscape(s[last:]))
	return b.String()
}

var secretNameRe = regexp.MustCompile(`(?i)(token|secret|passw(or)?d|passwd|pwd|api[_-]?key|apikey|auth|credential|private|session|cookie|signature|client[_-]?key)`)

// looksSecret reports whether a variable name suggests a credential.
func looksSecret(name string) bool {
	return secretNameRe.MatchString(name)
}

var sensitiveHeaders = map[string]string{
	"authorization":       "",
	"proxy-authorization": "proxy_auth",
	"x-api-key":           "api_key",
	"api-key":             "api_key",
	"apikey":              "api_key",
	"x-auth-token":        "auth_token",
	"x-access-token":      "access_token",
	"cookie":              "cookie",
}

// sanitizeHeader replaces literal credentials in sensitive headers with a
// variable. It returns the new value and the variable name used (empty if the
// header was left unchanged).
func sanitizeHeader(name, value string) (string, string) {
	lower := strings.ToLower(strings.TrimSpace(name))
	varName, sensitive := sensitiveHeaders[lower]
	if !sensitive || strings.TrimSpace(value) == "" || strings.Contains(value, "{{") {
		return value, ""
	}
	if lower == "authorization" || lower == "proxy-authorization" {
		scheme, _, hasScheme := strings.Cut(strings.TrimSpace(value), " ")
		prefix := "auth"
		if lower == "proxy-authorization" {
			prefix = "proxy_auth"
		}
		if hasScheme {
			switch strings.ToLower(scheme) {
			case "bearer":
				v := "token"
				if lower == "proxy-authorization" {
					v = "proxy_token"
				}
				return "Bearer {{" + v + "}}", v
			case "basic":
				v := "basic_auth"
				if lower == "proxy-authorization" {
					v = "proxy_basic_auth"
				}
				return "Basic {{" + v + "}}", v
			default:
				v := prefix + "_" + VarName(scheme)
				return scheme + " {{" + v + "}}", v
			}
		}
		return "{{" + prefix + "_header}}", prefix + "_header"
	}
	return "{{" + varName + "}}", varName
}
