package importer

import (
	"regexp"
	"strconv"
	"strings"
)

// scriptTranslation is the result of translating a Postman test script.
type scriptTranslation struct {
	Asserts  []string
	Captures []string
	// Untranslated is true when at least one statement could not be converted.
	Untranslated bool
}

const (
	jsIdent   = `[A-Za-z_$][\w$]*`
	jsPath    = `((?:\.[A-Za-z_$][\w$]*|\[\d+\]|\[\s*['"][^'"\]]+['"]\s*\])*)`
	jsLiteral = `("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|-?\d+(?:\.\d+)?|true|false|null)`
)

var (
	reJSONDecl   = regexp.MustCompile(`^(?:var|let|const)\s+(` + jsIdent + `)\s*=\s*(?:pm\.response\.json\(\)|JSON\.parse\(\s*responseBody\s*\))\s*;?$`)
	reTestOpen   = regexp.MustCompile(`^pm\.test\(\s*(?:"[^"]*"|'[^']*'|` + "`[^`]*`" + `)\s*,\s*(?:function\s*\(\s*\)|\(\s*\)\s*=>)\s*\{$`)
	reTestInline = regexp.MustCompile(`^pm\.test\(\s*(?:"[^"]*"|'[^']*'|` + "`[^`]*`" + `)\s*,\s*(?:function\s*\(\s*\)|\(\s*\)\s*=>)\s*\{(.*)\}\s*\)\s*;?$`)
	reCloser     = regexp.MustCompile(`^\}\s*\)?\s*;?$`)
	reControl    = regexp.MustCompile(`\b(if|else|for|while|switch|try|catch|do|return|throw)\b|\.forEach\(|\.map\(|\.filter\(|\.find\(|setTimeout|pm\.sendRequest|\?\s*[^:]+:`)
	reStringLit  = regexp.MustCompile(`"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|` + "`[^`]*`")

	reStatusHave    = regexp.MustCompile(`^pm\.response\.to\.have\.status\((\d{3})\)$`)
	reStatusExpect  = regexp.MustCompile(`^pm\.expect\(\s*pm\.response\.(?:code|status)\s*\)\.to\.(?:eql|equal|eq|be\.equal|deep\.equal)\((\d{3})\)$`)
	reStatusLegacy  = regexp.MustCompile(`^tests\[[^\]]*\]\s*=\s*responseCode\.code\s*===?\s*(\d{3})$`)
	reStatusOK      = regexp.MustCompile(`^pm\.response\.to\.be\.ok$`)
	reStatusSuccess = regexp.MustCompile(`^pm\.response\.to\.be\.success$`)
	reDuration      = regexp.MustCompile(`^pm\.expect\(\s*pm\.response\.responseTime\s*\)\.to\.be\.(?:below|lessThan)\((\d+)\)$`)
	reConsole       = regexp.MustCompile(`^console\.(?:log|info|debug|warn)\(.*\)$`)
)

// translateTestScript converts the safe subset of a Postman test script into
// Kest assertions and captures. Anything else marks the script as
// untranslated; when control flow is present nothing is emitted because the
// assertions might be conditional.
func translateTestScript(lines []string) scriptTranslation {
	var out scriptTranslation
	jsonVars := map[string]bool{}
	for _, raw := range lines {
		for _, line := range strings.Split(raw, "\n") {
			if m := reJSONDecl.FindStringSubmatch(strings.TrimSpace(line)); m != nil {
				jsonVars[m[1]] = true
			}
		}
	}

	var statements []string
	for _, raw := range lines {
		for _, line := range strings.Split(raw, "\n") {
			t := strings.TrimSpace(line)
			if t == "" || strings.HasPrefix(t, "//") {
				continue
			}
			if reControl.MatchString(reStringLit.ReplaceAllString(t, `""`)) {
				return scriptTranslation{Untranslated: true}
			}
			if m := reTestInline.FindStringSubmatch(t); m != nil {
				for _, part := range strings.Split(m[1], ";") {
					if p := strings.TrimSpace(part); p != "" {
						statements = append(statements, p)
					}
				}
				continue
			}
			statements = append(statements, t)
		}
	}

	for _, st := range statements {
		st = strings.TrimSpace(strings.TrimSuffix(strings.TrimSpace(st), ";"))
		if st == "" || reJSONDecl.MatchString(st+";") || reJSONDecl.MatchString(st) ||
			reTestOpen.MatchString(st) || reCloser.MatchString(st) || reConsole.MatchString(st) {
			continue
		}
		asserts, captures, ok := translateStatement(st, jsonVars)
		if !ok {
			out.Untranslated = true
			continue
		}
		out.Asserts = appendUnique(out.Asserts, asserts...)
		out.Captures = appendUnique(out.Captures, captures...)
	}
	return out
}

func translateStatement(st string, jsonVars map[string]bool) ([]string, []string, bool) {
	if m := reStatusHave.FindStringSubmatch(st); m != nil {
		return []string{"status == " + m[1]}, nil, true
	}
	if m := reStatusExpect.FindStringSubmatch(st); m != nil {
		return []string{"status == " + m[1]}, nil, true
	}
	if m := reStatusLegacy.FindStringSubmatch(st); m != nil {
		return []string{"status == " + m[1]}, nil, true
	}
	if reStatusOK.MatchString(st) {
		return []string{"status == 200"}, nil, true
	}
	if reStatusSuccess.MatchString(st) {
		return []string{"status >= 200", "status < 300"}, nil, true
	}
	if m := reDuration.FindStringSubmatch(st); m != nil {
		return []string{"duration < " + m[1]}, nil, true
	}

	src := jsonSourcePattern(jsonVars)

	// pm.expect(jsonData.a.b).to.eql("x")
	reEq := regexp.MustCompile(`^pm\.expect\(\s*` + src + jsPath + `\s*\)\.to\.(?:eql|equal|eq|be\.equal|deep\.equal)\(\s*` + jsLiteral + `\s*\)$`)
	if m := reEq.FindStringSubmatch(st); m != nil {
		path, ok := toKestPath(m[1])
		if !ok || path == "" {
			return nil, nil, false
		}
		lit, ok := toKestLiteral(m[2])
		if !ok {
			return nil, nil, false
		}
		return []string{"body." + path + " == " + lit}, nil, true
	}

	// pm.expect(jsonData.a).to.exist / to.not.be.undefined
	reExist := regexp.MustCompile(`^pm\.expect\(\s*` + src + jsPath + `\s*\)\.to\.(?:exist|not\.be\.undefined|be\.not\.undefined)$`)
	if m := reExist.FindStringSubmatch(st); m != nil {
		path, ok := toKestPath(m[1])
		if !ok || path == "" {
			return nil, nil, false
		}
		return []string{"body." + path + " exists"}, nil, true
	}

	// pm.expect(jsonData.active).to.be.true
	reBool := regexp.MustCompile(`^pm\.expect\(\s*` + src + jsPath + `\s*\)\.to\.be\.(true|false)$`)
	if m := reBool.FindStringSubmatch(st); m != nil {
		path, ok := toKestPath(m[1])
		if !ok || path == "" {
			return nil, nil, false
		}
		return []string{"body." + path + " == " + m[2]}, nil, true
	}

	// pm.expect(jsonData).to.have.property("a")
	reProp := regexp.MustCompile(`^pm\.expect\(\s*` + src + jsPath + `\s*\)\.to\.have\.property\(\s*(?:"([^"]+)"|'([^']+)')\s*\)$`)
	if m := reProp.FindStringSubmatch(st); m != nil {
		path, ok := toKestPath(m[1])
		key := m[2] + m[3]
		if !ok || !isSimpleKey(key) {
			return nil, nil, false
		}
		if path != "" {
			path += "."
		}
		return []string{"body." + path + key + " exists"}, nil, true
	}

	// pm.expect(jsonData.items).to.have.lengthOf(3)
	reLen := regexp.MustCompile(`^pm\.expect\(\s*` + src + jsPath + `\s*\)\.to\.have\.(?:lengthOf|length)\((\d+)\)$`)
	if m := reLen.FindStringSubmatch(st); m != nil {
		path, ok := toKestPath(m[1])
		if !ok || path == "" {
			return nil, nil, false
		}
		return []string{"body." + path + " length == " + m[2]}, nil, true
	}

	// pm.environment.set("token", jsonData.token)
	reSet := regexp.MustCompile(`^(?:pm\.(?:environment|collectionVariables|globals|variables)\.set|postman\.set(?:Environment|Global)Variable)\(\s*(?:"([^"]+)"|'([^']+)')\s*,\s*` + src + jsPath + `\s*\)$`)
	if m := reSet.FindStringSubmatch(st); m != nil {
		path, ok := toKestPath(m[3])
		if !ok || path == "" {
			return nil, nil, false
		}
		return nil, []string{VarName(m[1]+m[2]) + " = " + path}, true
	}
	return nil, nil, false
}

func jsonSourcePattern(jsonVars map[string]bool) string {
	alts := []string{`pm\.response\.json\(\)`}
	for v := range jsonVars {
		alts = append(alts, regexp.QuoteMeta(v))
	}
	// Longest first so that e.g. "jsonData" wins over "json".
	sortByLenDesc(alts)
	return `(?:` + strings.Join(alts, "|") + `)`
}

func sortByLenDesc(s []string) {
	for i := 1; i < len(s); i++ {
		for j := i; j > 0 && len(s[j]) > len(s[j-1]); j-- {
			s[j], s[j-1] = s[j-1], s[j]
		}
	}
}

var reBracketKey = regexp.MustCompile(`\[\s*['"]([^'"\]]+)['"]\s*\]`)

// toKestPath converts a JS accessor suffix (".data[0]['id']") into a Kest body path ("data[0].id").
func toKestPath(js string) (string, bool) {
	ok := true
	js = reBracketKey.ReplaceAllStringFunc(js, func(m string) string {
		key := reBracketKey.FindStringSubmatch(m)[1]
		if !isSimpleKey(key) {
			ok = false
		}
		return "." + key
	})
	if !ok {
		return "", false
	}
	return strings.TrimPrefix(js, "."), true
}

var simpleKeyRe = regexp.MustCompile(`^[A-Za-z0-9_\-$]+$`)

func isSimpleKey(k string) bool { return simpleKeyRe.MatchString(k) }

// unsafeLiteralTokens are substrings that the Kest assertion parser treats as operators.
var unsafeLiteralTokens = []string{"==", "!=", ">", "<", " contains ", " startsWith ", " endsWith ", " length ", " exists", " matches", "{{"}

func toKestLiteral(lit string) (string, bool) {
	if strings.HasPrefix(lit, "'") || strings.HasPrefix(lit, `"`) {
		var s string
		if strings.HasPrefix(lit, "'") {
			inner := lit[1 : len(lit)-1]
			inner = strings.ReplaceAll(inner, `\'`, `'`)
			s = inner
		} else {
			u, err := strconv.Unquote(lit)
			if err != nil {
				return "", false
			}
			s = u
		}
		if strings.ContainsAny(s, "\"'\n") {
			return "", false
		}
		for _, tok := range unsafeLiteralTokens {
			if strings.Contains(s, tok) {
				return "", false
			}
		}
		return `"` + s + `"`, true
	}
	if lit == "null" {
		// Kest compares string values; gjson renders JSON null as "".
		return "", false
	}
	return lit, true
}

func appendUnique(dst []string, items ...string) []string {
	for _, it := range items {
		found := false
		for _, d := range dst {
			if d == it {
				found = true
				break
			}
		}
		if !found {
			dst = append(dst, it)
		}
	}
	return dst
}
