package importer

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/url"
	"regexp"
	"strings"
)

// CurlOptions configures a curl import.
type CurlOptions struct {
	Name     string // step name; defaults to "METHOD /path"
	Absolute bool   // keep the absolute URL instead of a base_url-relative path
}

// curl flags that take a value and are ignored (they do not change the request semantics we model).
var curlIgnoredValueFlags = map[string]bool{
	"-o": true, "--output": true, "-m": true, "--max-time": true, "--connect-timeout": true,
	"--retry": true, "--retry-delay": true, "--retry-max-time": true, "-w": true, "--write-out": true,
	"--cacert": true, "--capath": true, "-E": true, "--cert": true, "--key": true, "--cert-type": true,
	"-x": true, "--proxy": true, "--resolve": true, "--interface": true, "-c": true, "--cookie-jar": true,
	"-r": true, "--range": true, "--limit-rate": true, "-D": true, "--dump-header": true, "-K": true, "--config": true,
}

// curl boolean flags that are safe to ignore.
var curlIgnoredBoolFlags = map[string]bool{
	"-s": true, "--silent": true, "-S": true, "--show-error": true, "-L": true, "--location": true,
	"-k": true, "--insecure": true, "-i": true, "--include": true, "-v": true, "--verbose": true,
	"--compressed": true, "-f": true, "--fail": true, "--fail-with-body": true, "-N": true, "--no-buffer": true,
	"--http1.1": true, "--http2": true, "--http1.0": true, "-0": true, "-#": true, "--progress-bar": true,
	"-g": true, "--globoff": true, "-4": true, "-6": true, "--ipv4": true, "--ipv6": true, "-n": true, "--netrc": true,
	"-1": true, "-2": true, "-3": true, "--tlsv1.2": true, "--tlsv1.3": true, "--location-trusted": true,
}

// short flags that take a value
const curlShortValueFlags = "XHdubAeFTomwExrcDK"

// ImportCurl converts a curl command line into a single-step flow.
func ImportCurl(command string, opts CurlOptions) (*Result, error) {
	args, err := SplitShellWords(command)
	if err != nil {
		return nil, err
	}
	if len(args) > 0 && (args[0] == "curl" || strings.HasSuffix(args[0], "/curl") || args[0] == "curl.exe") {
		args = args[1:]
	}
	if len(args) == 0 {
		return nil, fmt.Errorf("empty curl command")
	}

	res := &Result{SourceKind: "curl", SourceName: "curl"}
	const loc = "curl"
	var (
		method     string
		rawURL     string
		headers    []KV
		dataParts  []string
		jsonBody   bool
		forceGet   bool
		head       bool
		userCreds  string
		hasForm    bool
		formFields []string
	)

	takeValue := func(i *int, flag string) (string, error) {
		if *i+1 >= len(args) {
			return "", fmt.Errorf("curl flag %s requires a value", flag)
		}
		*i++
		return args[*i], nil
	}

	for i := 0; i < len(args); i++ {
		arg := args[i]
		if !strings.HasPrefix(arg, "-") || arg == "-" {
			if rawURL == "" {
				rawURL = arg
			} else {
				res.warn(loc, "extra argument %q ignored (only one URL is supported)", arg)
			}
			continue
		}

		var flag, value string
		hasValue := false
		if strings.HasPrefix(arg, "--") {
			flag = arg
			if k, v, ok := strings.Cut(arg, "="); ok {
				flag, value, hasValue = k, v, true
			}
		} else {
			// Short flags: -XPOST, -sSL, -H value
			cluster := arg[1:]
			for j := 0; j < len(cluster); j++ {
				c := cluster[j]
				if strings.IndexByte(curlShortValueFlags, c) >= 0 {
					flag = "-" + string(c)
					if j+1 < len(cluster) {
						value, hasValue = cluster[j+1:], true
					}
					break
				}
				f := "-" + string(c)
				switch {
				case f == "-I":
					head = true
				case f == "-G":
					forceGet = true
				case curlIgnoredBoolFlags[f]:
				default:
					res.warn(loc, "curl flag %s is not supported and was ignored", f)
				}
			}
			if flag == "" {
				continue
			}
		}

		needValue := func() (string, error) {
			if hasValue {
				return value, nil
			}
			return takeValue(&i, flag)
		}

		switch flag {
		case "-X", "--request":
			v, err := needValue()
			if err != nil {
				return nil, err
			}
			method = strings.ToUpper(v)
		case "-H", "--header":
			v, err := needValue()
			if err != nil {
				return nil, err
			}
			name, val, ok := strings.Cut(v, ":")
			if !ok {
				res.warn(loc, "header %q ignored (expected Name: value)", v)
				continue
			}
			name = strings.TrimSpace(name)
			val = strings.TrimSpace(val)
			if val == "" {
				continue // "Header:" removes a header in curl
			}
			headers = append(headers, KV{Name: name, Value: val})
		case "-d", "--data", "--data-raw", "--data-ascii", "--data-binary":
			v, err := needValue()
			if err != nil {
				return nil, err
			}
			if strings.HasPrefix(v, "@") && flag != "--data-raw" {
				res.warn(loc, "body is read from file %s; paste its content into the step body", v[1:])
			}
			dataParts = append(dataParts, v)
		case "--data-urlencode":
			v, err := needValue()
			if err != nil {
				return nil, err
			}
			if k, val, ok := strings.Cut(v, "="); ok {
				dataParts = append(dataParts, k+"="+url.QueryEscape(val))
			} else {
				dataParts = append(dataParts, url.QueryEscape(v))
			}
		case "--json":
			v, err := needValue()
			if err != nil {
				return nil, err
			}
			jsonBody = true
			dataParts = append(dataParts, v)
		case "-u", "--user":
			v, err := needValue()
			if err != nil {
				return nil, err
			}
			userCreds = v
		case "--oauth2-bearer":
			if _, err := needValue(); err != nil {
				return nil, err
			}
			headers = append(headers, KV{Name: "Authorization", Value: "Bearer literal"})
		case "-A", "--user-agent":
			v, err := needValue()
			if err != nil {
				return nil, err
			}
			headers = append(headers, KV{Name: "User-Agent", Value: v})
		case "-e", "--referer":
			v, err := needValue()
			if err != nil {
				return nil, err
			}
			headers = append(headers, KV{Name: "Referer", Value: v})
		case "-b", "--cookie":
			v, err := needValue()
			if err != nil {
				return nil, err
			}
			if !strings.Contains(v, "=") {
				res.warn(loc, "cookie file %s ignored", v)
				continue
			}
			headers = append(headers, KV{Name: "Cookie", Value: v})
		case "-F", "--form", "--form-string":
			v, err := needValue()
			if err != nil {
				return nil, err
			}
			hasForm = true
			formFields = append(formFields, v)
		case "--url":
			v, err := needValue()
			if err != nil {
				return nil, err
			}
			rawURL = v
		case "-T", "--upload-file":
			v, err := needValue()
			if err != nil {
				return nil, err
			}
			res.warn(loc, "--upload-file %s is not supported; add the body manually", v)
		case "--head":
			head = true
		case "--get":
			forceGet = true
		default:
			if curlIgnoredBoolFlags[flag] {
				continue
			}
			if curlIgnoredValueFlags[flag] {
				if !hasValue {
					if _, err := takeValue(&i, flag); err != nil {
						return nil, err
					}
				}
				continue
			}
			res.warn(loc, "curl flag %s is not supported and was ignored", flag)
		}
	}

	if rawURL == "" {
		return nil, fmt.Errorf("no URL found in curl command")
	}
	if !strings.Contains(rawURL, "://") {
		rawURL = "http://" + rawURL
	}
	u, err := url.Parse(rawURL)
	if err != nil {
		return nil, fmt.Errorf("invalid URL %q: %w", rawURL, err)
	}

	body := strings.Join(dataParts, "&")
	if jsonBody {
		body = strings.Join(dataParts, "")
	}
	queries := splitQuery(u.RawQuery)
	if forceGet && body != "" {
		queries = append(queries, splitQuery(body)...)
		body = ""
	}

	switch {
	case method != "":
	case head:
		method = "HEAD"
	case forceGet:
		method = "GET"
	case body != "" || hasForm:
		method = "POST"
	default:
		method = "GET"
	}

	st := Step{Method: method}
	path := u.EscapedPath()
	if path == "" {
		path = "/"
	}
	origin := u.Scheme + "://" + u.Host
	if opts.Absolute {
		st.URL = origin + path
	} else {
		st.URL = path
		res.Env.BaseURL = origin
	}
	st.Queries = queries
	st.Name = opts.Name
	if st.Name == "" {
		st.Name = method + " " + path
	}
	st.ID = Slug(strings.ToLower(method) + " " + path)
	if st.ID == "" {
		st.ID = "request"
	}

	hasCT := false
	for _, h := range headers {
		if strings.EqualFold(h.Name, "Content-Type") {
			hasCT = true
		}
	}
	for _, h := range headers {
		value := h.Value
		if sanitized, v := sanitizeHeader(h.Name, value); v != "" {
			value = sanitized
			res.Env.addSecret(v)
			res.warn(loc, "credential in header %q was replaced with {{%s}}; pass it with --var %s=...", h.Name, v, v)
		}
		st.Headers = append(st.Headers, KV{Name: h.Name, Value: value})
	}
	if userCreds != "" {
		user, _, _ := strings.Cut(userCreds, ":")
		st.Headers = append(st.Headers, KV{Name: "Authorization", Value: basicAuthHeader})
		res.Env.setVar("basic_username", user)
		res.Env.addSecret("basic_password")
		res.warn(loc, "-u password was not copied; pass it with --var basic_password=...")
	}
	if jsonBody {
		if !hasCT {
			st.Headers = append(st.Headers, KV{Name: "Content-Type", Value: "application/json"})
			hasCT = true
		}
		if !hasHeader(st.Headers, "Accept") {
			st.Headers = append(st.Headers, KV{Name: "Accept", Value: "application/json"})
		}
	}
	if body != "" {
		t := strings.TrimSpace(body)
		isJSON := (strings.HasPrefix(t, "{") || strings.HasPrefix(t, "[")) && json.Valid([]byte(t))
		if isJSON {
			var buf bytes.Buffer
			if json.Indent(&buf, []byte(t), "", "  ") == nil {
				body = buf.String()
			}
		}
		if !hasCT {
			ct := "application/x-www-form-urlencoded" // curl's default for -d
			if isJSON {
				ct = "application/json"
			}
			st.Headers = append(st.Headers, KV{Name: "Content-Type", Value: ct})
		}
		if pickFence(body) == "" {
			st.Notes = append(st.Notes, Note{Title: "Request body could not be embedded.", Lang: "text", Content: body})
			res.warn(loc, "request body could not be embedded (kept as a note)")
			body = ""
		}
		st.Body = body
	}
	if hasForm {
		st.Notes = append(st.Notes, Note{Title: "multipart/form-data (-F) was not translated (flow steps do not support multipart yet). Fields:", Lang: "text", Content: strings.Join(formFields, "\n")})
		res.warn(loc, "multipart form fields (-F) not translated")
	}
	st.Asserts = []string{"status >= 200", "status < 300"}

	f := FlowFile{
		FileName: st.ID + ".flow.md",
		ID:       st.ID,
		Name:     st.Name,
		Source:   "Imported from a curl command with `kest import curl`.",
		Tags:     []string{"curl", "imported"},
		Sections: []Section{{Steps: []Step{st}}},
	}
	res.Files = []FlowFile{f}
	res.finalizeEnv()
	return res, nil
}

func hasHeader(headers []KV, name string) bool {
	for _, h := range headers {
		if strings.EqualFold(h.Name, name) {
			return true
		}
	}
	return false
}

func splitQuery(raw string) []KV {
	var out []KV
	for _, part := range strings.Split(raw, "&") {
		if part == "" {
			continue
		}
		k, v, _ := strings.Cut(part, "=")
		if dk, err := url.QueryUnescape(k); err == nil {
			k = dk
		}
		if dv, err := url.QueryUnescape(v); err == nil {
			v = dv
		}
		out = append(out, KV{Name: k, Value: v})
	}
	return out
}

// SplitShellWords splits a POSIX shell command line (as copied from a browser
// or terminal) into arguments. It supports single quotes, double quotes,
// $'...' strings, backslash escapes and line continuations.
func SplitShellWords(s string) ([]string, error) {
	var (
		args    []string
		cur     strings.Builder
		inWord  bool
		runes   = []rune(s)
		hasWord = func() { inWord = true }
	)
	flush := func() {
		if inWord {
			args = append(args, cur.String())
			cur.Reset()
			inWord = false
		}
	}
	for i := 0; i < len(runes); i++ {
		r := runes[i]
		switch {
		case r == '\\':
			if i+1 < len(runes) {
				next := runes[i+1]
				i++
				if next == '\n' {
					continue
				}
				if next == '\r' && i+1 < len(runes) && runes[i+1] == '\n' {
					i++
					continue
				}
				cur.WriteRune(next)
				hasWord()
			}
		case r == '\'':
			hasWord()
			j := i + 1
			for j < len(runes) && runes[j] != '\'' {
				cur.WriteRune(runes[j])
				j++
			}
			if j >= len(runes) {
				return nil, fmt.Errorf("unterminated single quote")
			}
			i = j
		case r == '$' && i+1 < len(runes) && runes[i+1] == '\'':
			hasWord()
			j := i + 2
			for j < len(runes) && runes[j] != '\'' {
				if runes[j] == '\\' && j+1 < len(runes) {
					j++
					switch runes[j] {
					case 'n':
						cur.WriteRune('\n')
					case 't':
						cur.WriteRune('\t')
					case 'r':
						cur.WriteRune('\r')
					default:
						cur.WriteRune(runes[j])
					}
				} else {
					cur.WriteRune(runes[j])
				}
				j++
			}
			if j >= len(runes) {
				return nil, fmt.Errorf("unterminated $'...' string")
			}
			i = j
		case r == '"':
			hasWord()
			j := i + 1
			for j < len(runes) && runes[j] != '"' {
				if runes[j] == '\\' && j+1 < len(runes) && strings.ContainsRune("\"\\$`\n", runes[j+1]) {
					j++
					if runes[j] != '\n' {
						cur.WriteRune(runes[j])
					}
				} else {
					cur.WriteRune(runes[j])
				}
				j++
			}
			if j >= len(runes) {
				return nil, fmt.Errorf("unterminated double quote")
			}
			i = j
		case r == ' ' || r == '\t' || r == '\n' || r == '\r':
			flush()
		default:
			cur.WriteRune(r)
			hasWord()
		}
	}
	flush()
	return args, nil
}

var shellSafeRe = regexp.MustCompile(`^[A-Za-z0-9_@%+=:,./-]+$`)

// ShellJoin quotes args so that SplitShellWords(ShellJoin(args)) == args.
func ShellJoin(args []string) string {
	out := make([]string, len(args))
	for i, a := range args {
		if a != "" && shellSafeRe.MatchString(a) {
			out[i] = a
		} else {
			out[i] = "'" + strings.ReplaceAll(a, "'", `'\''`) + "'"
		}
	}
	return strings.Join(out, " ")
}

var stepIDRe = regexp.MustCompile(`(?m)^\s*@id\s+(\S+)`)

// UniqueStepID returns id, or a suffixed variant not already used in content.
func UniqueStepID(content, id string) string {
	used := map[string]bool{}
	for _, m := range stepIDRe.FindAllStringSubmatch(content, -1) {
		used[m[1]] = true
	}
	return uniqueName(id, used)
}
