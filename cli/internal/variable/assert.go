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
	// 1. Handle "not exists" assertion (must come before "exists" check)
	if strings.HasSuffix(assertion, " not exists") {
		key := strings.TrimSpace(strings.TrimSuffix(assertion, " not exists"))
		query := bodyPathQuery(key)
		result := gjson.Get(string(body), query)
		if !result.Exists() {
			return true, ""
		}
		return false, fmt.Sprintf("expected body path to not exist: %s", query)
	}

	// 2. Handle "exists" assertion
	if strings.HasSuffix(assertion, " exists") {
		key := strings.TrimSpace(strings.TrimSuffix(assertion, " exists"))
		query := bodyPathQuery(key)
		result := gjson.Get(string(body), query)
		if result.Exists() {
			return true, ""
		}
		return false, fmt.Sprintf("body path does not exist: %s", query)
	}

	// 3. Handle "contains" operator: body.field contains "substring" or body.array contains "item"
	if idx := strings.Index(assertion, " contains "); idx != -1 {
		key := strings.TrimSpace(assertion[:idx])
		expected := strings.Trim(strings.TrimSpace(assertion[idx+10:]), "\"'")
		expected = Interpolate(expected, vars)
		actual := resolveKey(key, status, durationMs, body)
		// Array contains: check if any element matches
		if gjsonResult := gjson.Get(string(body), bodyPathQuery(key)); gjsonResult.IsArray() {
			for _, item := range gjsonResult.Array() {
				if item.String() == expected {
					return true, ""
				}
			}
			return false, fmt.Sprintf("%s does not contain %q (array check)", key, expected)
		}
		if strings.Contains(actual, expected) {
			return true, ""
		}
		return false, fmt.Sprintf("%s does not contain %q\n  Actual: %s", key, expected, actual)
	}

	// 4. Handle "startsWith" operator
	if idx := strings.Index(assertion, " startsWith "); idx != -1 {
		key := strings.TrimSpace(assertion[:idx])
		expected := strings.Trim(strings.TrimSpace(assertion[idx+12:]), "\"'")
		expected = Interpolate(expected, vars)
		actual := resolveKey(key, status, durationMs, body)
		if strings.HasPrefix(actual, expected) {
			return true, ""
		}
		return false, fmt.Sprintf("%s does not start with %q\n  Actual: %s", key, expected, actual)
	}

	// 5. Handle "endsWith" operator
	if idx := strings.Index(assertion, " endsWith "); idx != -1 {
		key := strings.TrimSpace(assertion[:idx])
		expected := strings.Trim(strings.TrimSpace(assertion[idx+10:]), "\"'")
		expected = Interpolate(expected, vars)
		actual := resolveKey(key, status, durationMs, body)
		if strings.HasSuffix(actual, expected) {
			return true, ""
		}
		return false, fmt.Sprintf("%s does not end with %q\n  Actual: %s", key, expected, actual)
	}

	// 6. Handle "length" operator: body.items length == 3
	if idx := strings.Index(assertion, " length "); idx != -1 {
		key := strings.TrimSpace(assertion[:idx])
		rest := strings.TrimSpace(assertion[idx+8:])
		query := bodyPathQuery(key)
		result := gjson.Get(string(body), query)
		var length int64
		if result.IsArray() {
			length = int64(len(result.Array()))
		} else {
			length = int64(len(result.String()))
		}
		// Delegate numeric comparison on the length value
		lengthAssertion := fmt.Sprintf("status %s", rest)
		// Reuse numeric comparison by treating length as a synthetic "status"
		return Assert(int(length), nil, 0, vars, lengthAssertion)
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

// bodyPathQuery strips the "body." prefix (if present) and normalizes the JSON path.
func bodyPathQuery(key string) string {
	if strings.HasPrefix(key, "body.") {
		return normalizeJSONPath(key[5:])
	}
	return normalizeJSONPath(key)
}

// resolveKey extracts the actual string value for a given assertion key.
func resolveKey(key string, status int, durationMs int64, body []byte) string {
	switch key {
	case "status":
		return fmt.Sprintf("%d", status)
	case "duration":
		return fmt.Sprintf("%d", durationMs)
	}
	query := bodyPathQuery(key)
	result := gjson.Get(string(body), query)
	return result.String()
}

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
