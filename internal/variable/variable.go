package variable

import (
	"math/rand"
	"regexp"
	"strconv"
	"strings"
	"time"
)

func init() {
	rand.Seed(time.Now().UnixNano())
}

var varRegex = regexp.MustCompile(`\{\{([^}]+)\}\}`)

// Interpolate replaces {{var}} with values from the map
func Interpolate(text string, vars map[string]string) string {
	return varRegex.ReplaceAllStringFunc(text, func(match string) string {
		name := strings.TrimSpace(match[2 : len(match)-2])

		// Built-in dynamic variables
		switch name {
		case "$randomInt":
			return strconv.Itoa(rand.Intn(10000))
		case "$timestamp":
			return strconv.FormatInt(time.Now().Unix(), 10)
		}

		if val, ok := vars[name]; ok {
			return val
		}
		return match
	})
}
