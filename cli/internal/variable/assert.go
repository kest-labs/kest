package variable

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"

	"github.com/tidwall/gjson"
)

// Assert checks if the response body matches the assertion expression (e.g. status == 200, body.id != 1)
func Assert(status int, body []byte, durationMs int64, vars map[string]string, assertion string) (bool, string) {
	// 1. Handle "exists" assertion (special case)
	if strings.HasSuffix(assertion, " exists") {
		key := strings.TrimSpace(strings.TrimSuffix(assertion, " exists"))
		var query string
		if strings.HasPrefix(key, "body.") {
			query = key[5:]
		} else {
			// Treat bare path (e.g. "data.choices[0]") as body query directly
			query = key
		}
		query = normalizeJSONPath(query)
		result := gjson.Get(string(body), query)
		if result.Exists() {
			return true, ""
		}
		return false, fmt.Sprintf("body path does not exist: %s", query)
	}

	operators := []string{"==", "!=", ">=", "<=", ">", "<", "matches"}
	var op string
	var parts []string

	for _, o := range operators {
		if strings.Contains(assertion, " "+o+" ") || strings.HasSuffix(assertion, " matches") {
			// Special handling for matches to avoid partial hits if needed,
			// but strings.Contains is usually fine for simple operators.
			op = o
			parts = strings.SplitN(assertion, o, 2)
			break
		}
	}

	if op == "" || len(parts) != 2 {
		// Try without spaces for common operators
		for _, o := range []string{"==", "!=", ">=", "<=", ">", "<"} {
			if strings.Contains(assertion, o) {
				op = o
				parts = strings.SplitN(assertion, o, 2)
				break
			}
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
		query := normalizeJSONPath(key[5:])
		result := gjson.Get(string(body), query)
		if !result.Exists() {
			return false, fmt.Sprintf("body path not found: %s", query)
		}
		actual = result.String()
	} else {
		// Treat any other key as a direct gjson path into the response body
		key = normalizeJSONPath(key)
		result := gjson.Get(string(body), key)
		if !result.Exists() {
			return false, fmt.Sprintf("body path not found: %s", key)
		}
		actual = result.String()
	}

	if exprValue, ok := evalNumericExpr(expected); ok {
		expected = strconv.FormatFloat(exprValue, 'f', -1, 64)
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
	case "matches":
		matched, err := regexp.MatchString(expected, actual)
		if err != nil {
			return false, fmt.Sprintf("invalid regex: %s", expected)
		}
		if matched {
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

	// Build detailed error message
	errorMsg := fmt.Sprintf(
		"%s mismatch\n"+
			"  Expected: %s %s\n"+
			"  Actual:   %s",
		key, op, expected, actual,
	)
	return false, errorMsg
}

var indexSyntaxPattern = regexp.MustCompile(`\[(\d+)\]`)
var numberPattern = regexp.MustCompile(`^[+-]?(\d+(\.\d+)?|\.\d+)$`)

func normalizeJSONPath(path string) string {
	path = indexSyntaxPattern.ReplaceAllString(path, `.$1`)
	path = strings.ReplaceAll(path, "..", ".")
	return strings.TrimPrefix(path, ".")
}

func evalNumericExpr(expr string) (float64, bool) {
	expr = strings.TrimSpace(expr)
	if expr == "" {
		return 0, false
	}
	expr = strings.ReplaceAll(expr, "\"", "")
	expr = strings.ReplaceAll(expr, "'", "")
	parts := strings.Fields(expr)
	if len(parts) == 0 {
		return 0, false
	}
	if len(parts) == 1 {
		if !numberPattern.MatchString(parts[0]) {
			return 0, false
		}
		v, err := strconv.ParseFloat(parts[0], 64)
		return v, err == nil
	}
	if len(parts)%2 == 0 {
		return 0, false
	}

	if !numberPattern.MatchString(parts[0]) {
		return 0, false
	}
	result, err := strconv.ParseFloat(parts[0], 64)
	if err != nil {
		return 0, false
	}

	for i := 1; i < len(parts); i += 2 {
		op := parts[i]
		next := parts[i+1]
		if !numberPattern.MatchString(next) {
			return 0, false
		}
		value, err := strconv.ParseFloat(next, 64)
		if err != nil {
			return 0, false
		}
		switch op {
		case "+":
			result += value
		case "-":
			result -= value
		case "*":
			result *= value
		case "/":
			if value == 0 {
				return 0, false
			}
			result /= value
		default:
			return 0, false
		}
	}

	return result, true
}
