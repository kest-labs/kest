package main

import "strings"

// parseFlowUse parses the value of `@use <path> [as <alias>]`.
func parseFlowUse(val string, line int) (FlowUse, bool) {
	fields := strings.Fields(val)
	if len(fields) == 0 {
		return FlowUse{}, false
	}
	use := FlowUse{Path: fields[0], LineNum: line}
	if len(fields) >= 3 && strings.EqualFold(fields[1], "as") {
		use.Alias = fields[2]
	}
	return use, true
}
