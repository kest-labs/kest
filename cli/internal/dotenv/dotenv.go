// Package dotenv reads simple KEY=VALUE files such as .kest/.env.
//
// It deliberately supports only the common subset: comments, blank lines, an
// optional `export ` prefix, single- and double-quoted values and `#` inline
// comments on unquoted values. There is no variable expansion.
package dotenv

import (
	"os"
	"strings"
	"sync"
	"time"
)

// Parse parses dotenv content into a map. Later keys win.
func Parse(content string) map[string]string {
	out := map[string]string{}
	for _, line := range strings.Split(strings.ReplaceAll(content, "\r\n", "\n"), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		line = strings.TrimSpace(strings.TrimPrefix(line, "export "))
		eq := strings.Index(line, "=")
		if eq <= 0 {
			continue
		}
		key := strings.TrimSpace(line[:eq])
		if key == "" || strings.ContainsAny(key, " \t") {
			continue
		}
		out[key] = parseValue(strings.TrimSpace(line[eq+1:]))
	}
	return out
}

func parseValue(raw string) string {
	if raw == "" {
		return ""
	}
	switch raw[0] {
	case '"':
		if end := closingQuote(raw, '"'); end > 0 {
			v := raw[1:end]
			r := strings.NewReplacer(`\n`, "\n", `\r`, "\r", `\t`, "\t", `\"`, `"`, `\\`, `\`)
			return r.Replace(v)
		}
	case '\'':
		if end := strings.IndexByte(raw[1:], '\''); end >= 0 {
			return raw[1 : end+1]
		}
	}
	// Unquoted: strip an inline comment that is preceded by whitespace.
	if idx := strings.Index(raw, " #"); idx >= 0 {
		raw = raw[:idx]
	}
	if idx := strings.Index(raw, "\t#"); idx >= 0 {
		raw = raw[:idx]
	}
	return strings.TrimSpace(raw)
}

// closingQuote returns the index of the closing quote of a quoted value that
// starts at raw[0], honouring backslash escapes, or -1.
func closingQuote(raw string, q byte) int {
	for i := 1; i < len(raw); i++ {
		if raw[i] == '\\' {
			i++
			continue
		}
		if raw[i] == q {
			return i
		}
	}
	return -1
}

type cacheEntry struct {
	mod  time.Time
	size int64
	vals map[string]string
}

var (
	mu    sync.Mutex
	cache = map[string]cacheEntry{}
)

// ReadFile parses the file at path. A missing or unreadable file yields an
// empty map. Results are cached per path until the file's mtime/size change.
func ReadFile(path string) map[string]string {
	info, err := os.Stat(path)
	if err != nil || info.IsDir() {
		return nil
	}
	mu.Lock()
	defer mu.Unlock()
	if e, ok := cache[path]; ok && e.mod.Equal(info.ModTime()) && e.size == info.Size() {
		return e.vals
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return nil
	}
	vals := Parse(string(data))
	cache[path] = cacheEntry{mod: info.ModTime(), size: info.Size(), vals: vals}
	return vals
}
