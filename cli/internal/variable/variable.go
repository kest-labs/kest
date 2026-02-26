package variable

import (
	"crypto/rand"
	"encoding/binary"
	"encoding/hex"
	"fmt"
	"os"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
)

// Thread-safe random number generator
var (
	rngMu   sync.Mutex
	rngSeed uint64
)

func init() {
	// Initialize with crypto/rand for better randomness
	var b [8]byte
	if _, err := rand.Read(b[:]); err == nil {
		rngSeed = binary.LittleEndian.Uint64(b[:])
	} else {
		rngSeed = uint64(time.Now().UnixNano())
	}
}

// InterpolationMode defines how to handle undefined variables
type InterpolationMode int

const (
	// ModePermissive returns original {{var}} for undefined variables
	ModePermissive InterpolationMode = iota
	// ModeWarning collects warnings for undefined variables
	ModeWarning
	// ModeStrict returns error for undefined variables
	ModeStrict
)

// Regular expressions for variable parsing
var (
	// Optimized: single regex matches both {{var}} and {{var | default: "value"}}
	// Supports both escaped quotes (\" in JSON) and normal quotes
	// Group 1: variable name (allows dots for $env.VAR syntax)
	// Group 2: default value (optional, captured only if | default: syntax present)
	combinedRegex = regexp.MustCompile(`\{\{([^|{}]+?)(?:\s*\|\s*default:\s*\\?"([^}]*)\\?")?\}\}`)
	// envVarPrefix is the prefix for reading OS environment variables
	envVarPrefix = "$env."
)

// interpolateWithMode is the unified implementation for all interpolation modes
// This eliminates code duplication and improves performance with a single regex
func interpolateWithMode(text string, vars map[string]string, mode InterpolationMode) (string, []string, error) {
	var warnings []string
	var missing []string

	result := combinedRegex.ReplaceAllStringFunc(text, func(match string) string {
		// Extract submatches
		matches := combinedRegex.FindStringSubmatch(match)
		if len(matches) < 2 {
			return match // Invalid match, keep original
		}

		varName := strings.TrimSpace(matches[1])
		if varName == "" {
			return match
		}

		// Default value is in group 2 (may be empty string)
		defaultValue := ""
		hasDefault := false
		if strings.Contains(match, "| default:") {
			// Check if default syntax was present
			hasDefault = true
			if len(matches) >= 3 {
				defaultValue = matches[2]
			}

			// Clean up the default value:
			// 1. Remove leading/trailing quotes (both \" and ")
			defaultValue = strings.Trim(defaultValue, "\"")
			defaultValue = strings.Trim(defaultValue, "\\")

			// 2. Unescape any escaped characters
			defaultValue = strings.ReplaceAll(defaultValue, "\\\"", "\"")
			defaultValue = strings.ReplaceAll(defaultValue, "\\\\", "\\")
		}

		// Built-in dynamic variables
		if isBuiltinVar(varName) {
			return resolveBuiltin(varName)
		}

		// Check if variable exists
		if val, ok := vars[varName]; ok {
			return val
		}

		// Use default value if provided
		if hasDefault {
			return defaultValue
		}

		// Variable not found - handle based on mode
		switch mode {
		case ModeWarning:
			warnings = append(warnings, varName)
		case ModeStrict:
			missing = append(missing, varName)
		}

		return match // Keep original for undefined variables
	})

	// Check for errors in strict mode
	if mode == ModeStrict && len(missing) > 0 {
		return "", nil, fmt.Errorf("required variables not provided: %s", strings.Join(missing, ", "))
	}

	return result, warnings, nil
}

// Interpolate replaces {{var}} with values from the map
// Supports default value syntax: {{var | default: "value"}}
func Interpolate(text string, vars map[string]string) string {
	result, _, _ := interpolateWithMode(text, vars, ModePermissive)
	return result
}

// InterpolateWithWarning replaces {{var}} and warns about undefined variables
// Supports default value syntax: {{var | default: "value"}}
func InterpolateWithWarning(text string, vars map[string]string, verbose bool) (string, []string) {
	if !verbose {
		return Interpolate(text, vars), nil
	}
	result, warnings, _ := interpolateWithMode(text, vars, ModeWarning)
	return result, warnings
}

// InterpolateStrict replaces {{var}} and returns error if any variable is undefined
// Supports default value syntax: {{var | default: "value"}}
func InterpolateStrict(text string, vars map[string]string) (string, error) {
	result, _, err := interpolateWithMode(text, vars, ModeStrict)
	return result, err
}

// ExtractPlaceholders returns all variable names found in {{var}} placeholders.
// Duplicates are removed while preserving first-seen order.
func ExtractPlaceholders(text string) []string {
	matches := combinedRegex.FindAllStringSubmatch(text, -1)
	if len(matches) == 0 {
		return nil
	}

	seen := make(map[string]struct{}, len(matches))
	vars := make([]string, 0, len(matches))
	for _, m := range matches {
		if len(m) < 2 {
			continue
		}
		name := strings.TrimSpace(m[1])
		if name == "" {
			continue
		}
		if _, ok := seen[name]; ok {
			continue
		}
		seen[name] = struct{}{}
		vars = append(vars, name)
	}
	return vars
}

// parseVarWithDefault is deprecated - kept for backward compatibility
// The new combinedRegex handles this in a single pass
func parseVarWithDefault(content string) (string, string) {
	// Try to match default syntax
	if idx := strings.Index(content, "|"); idx > 0 {
		varName := strings.TrimSpace(content[:idx])
		rest := strings.TrimSpace(content[idx+1:])
		if strings.HasPrefix(rest, "default:") {
			rest = strings.TrimPrefix(rest, "default:")
			rest = strings.TrimSpace(rest)
			if len(rest) >= 2 && rest[0] == '"' && rest[len(rest)-1] == '"' {
				return varName, rest[1 : len(rest)-1]
			}
		}
	}
	return content, ""
}

// isBuiltinVar checks if a variable is a built-in variable
func isBuiltinVar(name string) bool {
	switch name {
	case "$randomInt", "$timestamp", "$uuid", "$randomEmail", "$randomString", "$isoDate", "$unixMs":
		return true
	}
	// $env.VAR_NAME reads OS environment variables
	if strings.HasPrefix(name, envVarPrefix) {
		return true
	}
	return false
}

// resolveBuiltin resolves built-in variable values
// Thread-safe implementation using crypto/rand
func resolveBuiltin(name string) string {
	switch name {
	case "$randomInt":
		return strconv.Itoa(secureRandomInt(10000))
	case "$timestamp":
		return strconv.FormatInt(time.Now().Unix(), 10)
	case "$unixMs":
		return strconv.FormatInt(time.Now().UnixMilli(), 10)
	case "$isoDate":
		return time.Now().UTC().Format(time.RFC3339)
	case "$uuid":
		return generateUUID()
	case "$randomEmail":
		return fmt.Sprintf("user%d@example.com", secureRandomInt(999999))
	case "$randomString":
		return generateRandomString(12)
	}
	// $env.VAR_NAME → read from OS environment
	if strings.HasPrefix(name, envVarPrefix) {
		return os.Getenv(strings.TrimPrefix(name, envVarPrefix))
	}
	return ""
}

// generateUUID produces a random UUID v4 string.
func generateUUID() string {
	var b [16]byte
	rand.Read(b[:])             //nolint: errcheck — crypto/rand rarely fails
	b[6] = (b[6] & 0x0f) | 0x40 // version 4
	b[8] = (b[8] & 0x3f) | 0x80 // variant RFC4122
	return fmt.Sprintf("%s-%s-%s-%s-%s",
		hex.EncodeToString(b[0:4]),
		hex.EncodeToString(b[4:6]),
		hex.EncodeToString(b[6:8]),
		hex.EncodeToString(b[8:10]),
		hex.EncodeToString(b[10:16]),
	)
}

// generateRandomString returns a random hex string of the given length.
func generateRandomString(n int) string {
	raw := make([]byte, (n+1)/2)
	rand.Read(raw[:]) //nolint: errcheck
	return hex.EncodeToString(raw)[:n]
}

// secureRandomInt generates a thread-safe random integer in [0, max)
func secureRandomInt(max int) int {
	if max <= 0 {
		return 0
	}

	rngMu.Lock()
	defer rngMu.Unlock()

	// Simple LCG (Linear Congruential Generator)
	rngSeed = (rngSeed*1103515245 + 12345) & 0x7fffffff
	return int(rngSeed % uint64(max))
}
