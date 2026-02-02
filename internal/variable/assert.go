package variable

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/tidwall/gjson"
)

// Assert checks if the response body matches the assertion expression (e.g. status == 200, body.id != 1)
func Assert(status int, body []byte, durationMs int64, vars map[string]string, assertion string) (bool, string) {
	// 1. Handle "exists" assertion (special case)
	if strings.HasSuffix(assertion, " exists") {
		key := strings.TrimSpace(strings.TrimSuffix(assertion, " exists"))
		if strings.HasPrefix(key, "body.") {
			query := key[5:]
			result := gjson.Get(string(body), query)
			if result.Exists() {
				return true, ""
			}
			return false, fmt.Sprintf("body path does not exist: %s", query)
		}
		return false, fmt.Sprintf("exists check only supported for body fields: %s", key)
	}

	operators := []string{"==", "!=", ">=", "<=", ">", "<"}
	var op string
	var parts []string

	for _, o := range operators {
		if strings.Contains(assertion, o) {
			op = o
			parts = strings.SplitN(assertion, o, 2)
			break
		}
	}

	if op == "" || len(parts) != 2 {
		// Fallback to "=" for backward compatibility
		if strings.Contains(assertion, "=") {
			op = "=="
			parts = strings.SplitN(assertion, "=", 2)
		} else {
			return false, fmt.Sprintf("invalid assertion format: %s", assertion)
		}
	}

	key := strings.TrimSpace(parts[0])
	expectedRaw := strings.TrimSpace(parts[1])
	// Interpolate variables in expected value
	expected := Interpolate(expectedRaw, vars)
	// Remove quotes if present
	expected = strings.Trim(expected, "\"'")

	var actual string
	if key == "status" {
		actual = fmt.Sprintf("%d", status)
	} else if key == "duration" {
		// Strip "ms" from expected if present for duration
		expected = strings.TrimSuffix(expected, "ms")
		actual = fmt.Sprintf("%d", durationMs)
	} else if strings.HasPrefix(key, "body.") {
		query := key[5:]
		result := gjson.Get(string(body), query)
		if !result.Exists() {
			return false, fmt.Sprintf("body path not found: %s", query)
		}
		actual = result.String()
	} else {
		return false, fmt.Sprintf("unknown assertion key: %s", key)
	}

	switch op {
	case "==":
		if actual == expected {
			return true, ""
		}
	case "!=":
		if actual != expected {
			return true, ""
		}
	case ">", ">=", "<", "<=":
		// Numeric comparison
		actualInt, err1 := strconv.ParseFloat(actual, 64)
		expectedInt, err2 := strconv.ParseFloat(expected, 64)
		if err1 == nil && err2 == nil {
			switch op {
			case ">":
				if actualInt > expectedInt {
					return true, ""
				}
			case ">=":
				if actualInt >= expectedInt {
					return true, ""
				}
			case "<":
				if actualInt < expectedInt {
					return true, ""
				}
			case "<=":
				if actualInt <= expectedInt {
					return true, ""
				}
			}
		}
	}

	return false, fmt.Sprintf("%s mismatch: expected %s %s, got %s", key, op, expected, actual)
}
