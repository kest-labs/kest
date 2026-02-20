package variable

import (
	"crypto/rand"
	"encoding/binary"
	"fmt"
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

// Regular expressions for variable parsing
var (
	// Matches {{var}} or {{var | default: "value"}}
	varRegex = regexp.MustCompile(`\{\{([^}]+)\}\}`)
	// Matches default value syntax: {{var | default: "value"}}
	// Allows empty default values
	defaultRegex = regexp.MustCompile(`^([^|]+)\s*\|\s*default:\s*"([^"]*)"$`)
)

// Interpolate replaces {{var}} with values from the map
// Supports default value syntax: {{var | default: "value"}}
func Interpolate(text string, vars map[string]string) string {
	return varRegex.ReplaceAllStringFunc(text, func(match string) string {
		// Boundary check
		if len(match) < 4 {
			return match
		}

		content := strings.TrimSpace(match[2 : len(match)-2])
		if content == "" {
			return match
		}

		// Check for default value syntax
		varName, defaultValue := parseVarWithDefault(content)

		// Built-in dynamic variables
		if isBuiltinVar(varName) {
			return resolveBuiltin(varName)
		}

		if val, ok := vars[varName]; ok {
			return val
		}

		// Use default value if provided
		if defaultValue != "" {
			return defaultValue
		}

		// Variable not found - return original to make it obvious
		return match
	})
}

// InterpolateWithWarning replaces {{var}} and warns about undefined variables
// Supports default value syntax: {{var | default: "value"}}
func InterpolateWithWarning(text string, vars map[string]string, verbose bool) (string, []string) {
	var warnings []string
	result := varRegex.ReplaceAllStringFunc(text, func(match string) string {
		// Boundary check
		if len(match) < 4 {
			return match
		}

		content := strings.TrimSpace(match[2 : len(match)-2])
		if content == "" {
			return match
		}

		// Check for default value syntax
		varName, defaultValue := parseVarWithDefault(content)

		// Built-in dynamic variables
		if isBuiltinVar(varName) {
			return resolveBuiltin(varName)
		}

		if val, ok := vars[varName]; ok {
			return val
		}

		// Use default value if provided
		if defaultValue != "" {
			return defaultValue
		}

		// Variable not found
		if verbose {
			warnings = append(warnings, varName)
		}
		return match
	})
	return result, warnings
}

// InterpolateStrict replaces {{var}} and returns error if any variable is undefined
// Supports default value syntax: {{var | default: "value"}}
func InterpolateStrict(text string, vars map[string]string) (string, error) {
	var missing []string
	result := varRegex.ReplaceAllStringFunc(text, func(match string) string {
		// Boundary check
		if len(match) < 4 {
			return match
		}

		content := strings.TrimSpace(match[2 : len(match)-2])
		if content == "" {
			return match
		}

		// Check for default value syntax
		varName, defaultValue := parseVarWithDefault(content)

		// Built-in dynamic variables
		if isBuiltinVar(varName) {
			return resolveBuiltin(varName)
		}

		if val, ok := vars[varName]; ok {
			return val
		}

		// Use default value if provided
		if defaultValue != "" {
			return defaultValue
		}

		// Variable not found and no default - record as missing
		missing = append(missing, varName)
		return match
	})

	if len(missing) > 0 {
		return "", fmt.Errorf("required variables not provided: %s", strings.Join(missing, ", "))
	}

	return result, nil
}

// parseVarWithDefault parses variable name and default value from content
// Returns (varName, defaultValue)
func parseVarWithDefault(content string) (string, string) {
	matches := defaultRegex.FindStringSubmatch(content)
	if len(matches) == 3 {
		return strings.TrimSpace(matches[1]), matches[2]
	}
	return content, ""
}

// isBuiltinVar checks if a variable is a built-in variable
func isBuiltinVar(name string) bool {
	switch name {
	case "$randomInt", "$timestamp":
		return true
	default:
		return false
	}
}

// resolveBuiltin resolves built-in variable values
// Thread-safe implementation using crypto/rand
func resolveBuiltin(name string) string {
	switch name {
	case "$randomInt":
		return strconv.Itoa(secureRandomInt(10000))
	case "$timestamp":
		return strconv.FormatInt(time.Now().Unix(), 10)
	default:
		return ""
	}
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
