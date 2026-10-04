package importer

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/url"
	"regexp"
	"sort"
	"strings"
)

// Postman Collection v2.0 / v2.1 model. Fields that differ between the two
// versions (string vs. object, array vs. map) are kept as raw JSON.

type pmCollection struct {
	Info     pmInfo          `json:"info"`
	Item     []pmItem        `json:"item"`
	Variable []pmKV          `json:"variable"`
	Auth     json.RawMessage `json:"auth"`
	Event    []pmEvent       `json:"event"`
	Requests json.RawMessage `json:"requests"` // v1 marker
}

type pmInfo struct {
	Name        string          `json:"name"`
	Description json.RawMessage `json:"description"`
	Schema      string          `json:"schema"`
}

type pmItem struct {
	Name        string          `json:"name"`
	Description json.RawMessage `json:"description"`
	Item        []pmItem        `json:"item"`
	Request     json.RawMessage `json:"request"`
	Event       []pmEvent       `json:"event"`
	Auth        json.RawMessage `json:"auth"`
}

type pmEvent struct {
	Listen   string `json:"listen"`
	Disabled bool   `json:"disabled"`
	Script   struct {
		Exec json.RawMessage `json:"exec"`
	} `json:"script"`
}

type pmKV struct {
	Key      string          `json:"key"`
	Value    json.RawMessage `json:"value"`
	Type     string          `json:"type"`
	Disabled bool            `json:"disabled"`
	Enabled  *bool           `json:"enabled"`
	Src      json.RawMessage `json:"src"`
}

type pmRequest struct {
	Method      string          `json:"method"`
	Header      json.RawMessage `json:"header"`
	URL         json.RawMessage `json:"url"`
	Body        *pmBody         `json:"body"`
	Auth        json.RawMessage `json:"auth"`
	Description json.RawMessage `json:"description"`
}

type pmURL struct {
	Raw      string          `json:"raw"`
	Protocol string          `json:"protocol"`
	Host     json.RawMessage `json:"host"`
	Port     string          `json:"port"`
	Path     json.RawMessage `json:"path"`
	Query    []pmKV          `json:"query"`
	Variable []pmKV          `json:"variable"`
}

type pmBody struct {
	Mode       string `json:"mode"`
	Raw        string `json:"raw"`
	Disabled   bool   `json:"disabled"`
	URLEncoded []pmKV `json:"urlencoded"`
	FormData   []pmKV `json:"formdata"`
	GraphQL    *struct {
		Query     string          `json:"query"`
		Variables json.RawMessage `json:"variables"`
	} `json:"graphql"`
	Options struct {
		Raw struct {
			Language string `json:"language"`
		} `json:"raw"`
	} `json:"options"`
}

type pmEnvironment struct {
	Name   string `json:"name"`
	Values []pmKV `json:"values"`
}

// PostmanOptions configures a Postman import.
type PostmanOptions struct {
	// Environment is the optional content of a Postman environment export.
	Environment []byte
	// EnvName overrides the Kest environment name in the generated snippet.
	EnvName string
}

// pmAuth is a resolved Postman auth definition.
type pmAuth struct {
	Type   string
	Params map[string]string
}

type postmanImporter struct {
	res        *Result
	coll       pmCollection
	baseVar    string // Postman variable used as base URL (original name)
	baseOrigin string // literal origin used as base URL
	authVars   map[string]bool
}

// ImportPostman converts a Postman collection into flow files.
func ImportPostman(data []byte, opts PostmanOptions) (*Result, error) {
	var coll pmCollection
	if err := json.Unmarshal(data, &coll); err != nil {
		return nil, fmt.Errorf("not a valid Postman collection JSON: %w", err)
	}
	if len(coll.Requests) > 0 && len(coll.Item) == 0 {
		return nil, fmt.Errorf("Postman collection v1 is not supported; re-export it from Postman as Collection v2.1")
	}
	if coll.Info.Schema != "" && !strings.Contains(coll.Info.Schema, "v2.0") && !strings.Contains(coll.Info.Schema, "v2.1") {
		return nil, fmt.Errorf("unsupported Postman schema %q (expected Collection v2.0 or v2.1)", coll.Info.Schema)
	}
	if coll.Info.Name == "" && len(coll.Item) == 0 {
		return nil, fmt.Errorf("input does not look like a Postman collection (missing info/item)")
	}

	name := coll.Info.Name
	if name == "" {
		name = "Postman collection"
	}
	p := &postmanImporter{
		res:      &Result{SourceKind: "postman", SourceName: name},
		coll:     coll,
		authVars: map[string]bool{},
	}

	var env pmEnvironment
	if len(opts.Environment) > 0 {
		if err := json.Unmarshal(opts.Environment, &env); err != nil {
			return nil, fmt.Errorf("not a valid Postman environment JSON: %w", err)
		}
	}
	p.res.Env.Name = opts.EnvName
	if p.res.Env.Name == "" {
		p.res.Env.Name = VarName(env.Name)
		if env.Name == "" {
			p.res.Env.Name = "postman"
		}
	}

	p.detectBase(env)
	p.buildFiles()
	p.buildEnv(env)
	p.res.finalizeEnv()
	return p.res, nil
}

func (p *postmanImporter) buildFiles() {
	collAuth := parseAuth(p.coll.Auth)
	collNotes := p.eventNotes(p.coll.Event, "collection")
	if len(collNotes) > 0 {
		p.res.warn(p.coll.Info.Name, "collection-level scripts were not translated (kept as notes)")
	}

	usedFiles := map[string]bool{}
	var rootSteps []pmItem
	var folders []pmItem
	for _, it := range p.coll.Item {
		if isFolder(it) {
			folders = append(folders, it)
		} else {
			rootSteps = append(rootSteps, it)
		}
	}

	source := fmt.Sprintf("Imported from Postman collection %q with `kest import postman`.", p.coll.Info.Name)
	newFile := func(name string, desc json.RawMessage) FlowFile {
		slug := Slug(name)
		if slug == "" {
			slug = "collection"
		}
		slug = uniqueName(slug, usedFiles)
		return FlowFile{
			FileName:    slug + ".flow.md",
			ID:          slug,
			Name:        name,
			Description: pmText(desc),
			Source:      source,
			Tags:        []string{"postman", "imported"},
			Notes:       append([]Note{}, collNotes...),
		}
	}

	if len(rootSteps) > 0 || len(folders) == 0 {
		f := newFile(p.coll.Info.Name, p.coll.Info.Description)
		ids := map[string]bool{}
		sec := Section{}
		for _, it := range rootSteps {
			if st, ok := p.convertRequest(it, collAuth, p.coll.Info.Name, ids); ok {
				sec.Steps = append(sec.Steps, st)
			}
		}
		f.Sections = append(f.Sections, sec)
		p.res.Files = append(p.res.Files, f)
	}

	for _, folder := range folders {
		f := newFile(folder.Name, folder.Description)
		auth := collAuth
		if a := parseAuth(folder.Auth); a != nil {
			auth = a
		}
		f.Notes = append(f.Notes, p.eventNotes(folder.Event, "folder "+folder.Name)...)
		ids := map[string]bool{}
		p.walkFolder(&f, folder.Item, nil, auth, folder.Name, ids)
		p.res.Files = append(p.res.Files, f)
	}
}

func (p *postmanImporter) walkFolder(f *FlowFile, items []pmItem, trail []string, auth *pmAuth, location string, ids map[string]bool) {
	sec := Section{Title: strings.Join(trail, " / ")}
	var sub []pmItem
	for _, it := range items {
		if isFolder(it) {
			sub = append(sub, it)
			continue
		}
		if st, ok := p.convertRequest(it, auth, location, ids); ok {
			sec.Steps = append(sec.Steps, st)
		}
	}
	if len(sec.Steps) > 0 || sec.Title == "" {
		f.Sections = append(f.Sections, sec)
	}
	for _, folder := range sub {
		a := auth
		if fa := parseAuth(folder.Auth); fa != nil {
			a = fa
		}
		nextTrail := append(append([]string{}, trail...), folder.Name)
		loc := location + " / " + folder.Name
		start := len(f.Sections)
		p.walkFolder(f, folder.Item, nextTrail, a, loc, ids)
		notes := p.eventNotes(folder.Event, "folder "+folder.Name)
		if len(notes) > 0 {
			if start < len(f.Sections) {
				f.Sections[start].Notes = append(notes, f.Sections[start].Notes...)
				if f.Sections[start].Description == "" {
					f.Sections[start].Description = pmText(folder.Description)
				}
			} else {
				f.Notes = append(f.Notes, notes...)
			}
		} else if start < len(f.Sections) && f.Sections[start].Description == "" {
			f.Sections[start].Description = pmText(folder.Description)
		}
	}
}

func isFolder(it pmItem) bool {
	return len(it.Request) == 0 || string(it.Request) == "null"
}

func (p *postmanImporter) eventNotes(events []pmEvent, scope string) []Note {
	var notes []Note
	for _, ev := range events {
		code := strings.TrimSpace(strings.Join(scriptLines(ev.Script.Exec), "\n"))
		if code == "" || ev.Disabled {
			continue
		}
		kind := "pre-request script"
		if ev.Listen == "test" {
			kind = "test script"
		}
		notes = append(notes, Note{
			Title:   fmt.Sprintf("Postman %s on %s was not translated; it applied to every request in this scope.", kind, scope),
			Lang:    "javascript",
			Content: code,
		})
	}
	return notes
}

func (p *postmanImporter) convertRequest(it pmItem, inherited *pmAuth, location string, ids map[string]bool) (Step, bool) {
	loc := location + " / " + it.Name
	var req pmRequest
	trimmed := bytes.TrimSpace(it.Request)
	if len(trimmed) > 0 && trimmed[0] == '"' {
		// v2.0 allows a request to be just a URL string.
		var u string
		_ = json.Unmarshal(trimmed, &u)
		req.Method = "GET"
		req.URL, _ = json.Marshal(u)
	} else if err := json.Unmarshal(trimmed, &req); err != nil {
		p.res.warn(loc, "request could not be parsed and was skipped: %v", err)
		return Step{}, false
	}

	method := strings.ToUpper(strings.TrimSpace(req.Method))
	if method == "" {
		method = "GET"
	}
	name := strings.TrimSpace(it.Name)
	if name == "" {
		name = method + " request"
	}
	st := Step{
		ID:          uniqueName(Slug(name), ids),
		Name:        name,
		Description: pmText(it.Description),
		Method:      method,
	}
	if st.Description == "" {
		st.Description = pmText(req.Description)
	}
	rename := func(s string) string {
		return renameVars(s, func(v string) {
			p.res.warn(loc, "Postman dynamic variable {{%s}} has no Kest equivalent; replace it manually", v)
		})
	}

	// URL and query parameters.
	rawURL, queries, pathVars := parsePMURL(req.URL)
	for _, pv := range pathVars {
		if v := pmValue(pv.Value); v != "" {
			if _, exists := p.res.Env.Variables[VarName(pv.Key)]; !exists {
				p.res.Env.setVar(VarName(pv.Key), v)
			}
		}
	}
	st.URL = p.relativeURL(rename(rawURL), loc)
	for _, q := range queries {
		st.Queries = append(st.Queries, KV{Name: rename(q.Name), Value: rename(q.Value)})
	}

	// Headers.
	hasAuthHeader := false
	hasContentType := false
	for _, h := range parsePMHeaders(req.Header) {
		name := strings.TrimSpace(h.Name)
		if name == "" {
			continue
		}
		value := rename(h.Value)
		if sanitized, v := sanitizeHeader(name, value); v != "" {
			value = sanitized
			p.res.Env.addSecret(v)
			p.res.warn(loc, "literal credential in header %q was replaced with {{%s}}; pass it with --var %s=...", name, v, v)
		}
		if strings.EqualFold(name, "Authorization") {
			hasAuthHeader = true
		}
		if strings.EqualFold(name, "Content-Type") {
			hasContentType = true
		}
		st.Headers = append(st.Headers, KV{Name: name, Value: value})
	}

	// Auth.
	auth := inherited
	if a := parseAuth(req.Auth); a != nil {
		auth = a
	}
	if auth != nil && !hasAuthHeader {
		p.applyAuth(&st, auth, loc)
	}

	// Body.
	if req.Body != nil && !req.Body.Disabled {
		body, contentType := p.convertBody(req.Body, loc, &st, rename)
		if body != "" && pickFence(body) == "" {
			st.Notes = append(st.Notes, Note{Title: "Request body contains both ``` and ~~~ fences and could not be embedded.", Lang: "text", Content: body})
			p.res.warn(loc, "request body could not be embedded (kept as a note)")
			body = ""
		}
		st.Body = body
		if body != "" && contentType != "" && !hasContentType {
			st.Headers = append(st.Headers, KV{Name: "Content-Type", Value: contentType})
		}
	}

	// Scripts.
	hasTestScript := false
	for _, ev := range it.Event {
		lines := scriptLines(ev.Script.Exec)
		code := strings.TrimSpace(strings.Join(lines, "\n"))
		if code == "" || ev.Disabled {
			continue
		}
		switch ev.Listen {
		case "test":
			hasTestScript = true
			tr := translateTestScript(lines)
			st.Asserts = appendUnique(st.Asserts, tr.Asserts...)
			st.Captures = appendUnique(st.Captures, tr.Captures...)
			if tr.Untranslated {
				title := "Postman test script was only partially translated; review the remaining checks."
				if len(tr.Asserts) == 0 && len(tr.Captures) == 0 {
					title = "Postman test script was not translated."
				}
				st.Notes = append(st.Notes, Note{Title: title, Lang: "javascript", Content: code})
				p.res.warn(loc, "test script not fully translated (kept as a note)")
			}
		default:
			st.Notes = append(st.Notes, Note{Title: "Postman pre-request script was not translated. Consider an `@type exec` step.", Lang: "javascript", Content: code})
			p.res.warn(loc, "pre-request script not translated (kept as a note)")
		}
	}
	if len(st.Asserts) == 0 && !hasTestScript {
		// Match curl/OpenAPI imports so untested requests still check for success.
		// Requests whose test script could not be translated stay assertion-free
		// rather than get a guessed check; the script is kept as a note.
		st.Asserts = []string{"status >= 200", "status < 300"}
	}
	return st, true
}

// relativeURL strips the detected base URL so flows stay environment-agnostic.
func (p *postmanImporter) relativeURL(u, loc string) string {
	if p.baseVar != "" {
		prefix := "{{" + VarName(p.baseVar) + "}}"
		if strings.HasPrefix(u, prefix) {
			return ensureLeadingSlash(strings.TrimPrefix(u, prefix))
		}
	}
	if p.baseOrigin != "" && strings.HasPrefix(u, p.baseOrigin) {
		rest := strings.TrimPrefix(u, p.baseOrigin)
		if rest == "" || strings.HasPrefix(rest, "/") {
			return ensureLeadingSlash(rest)
		}
	}
	if strings.TrimSpace(u) == "" {
		p.res.warn(loc, "request has no URL")
		return "/"
	}
	if strings.HasPrefix(u, "{{") {
		// Kept as-is: Kest interpolates first and applies base_url only when
		// the result is still relative, so {{api_root}}/users works whether
		// api_root is an absolute URL or a path prefix.
		return u
	}
	if !strings.HasPrefix(u, "http://") && !strings.HasPrefix(u, "https://") && !strings.HasPrefix(u, "/") {
		return "http://" + u
	}
	return u
}

func ensureLeadingSlash(s string) string {
	if !strings.HasPrefix(s, "/") {
		return "/" + s
	}
	return s
}

var leadingVarRe = regexp.MustCompile(`^\{\{\s*([^{}|]+?)\s*\}\}`)
var originRe = regexp.MustCompile(`^(https?://[^/?#{}]+)`)

// detectBase picks the most common URL prefix (a {{variable}} or a literal origin) as base URL.
func (p *postmanImporter) detectBase(env pmEnvironment) {
	counts := map[string]int{}
	var walk func(items []pmItem)
	walk = func(items []pmItem) {
		for _, it := range items {
			if isFolder(it) {
				walk(it.Item)
				continue
			}
			var req pmRequest
			trimmed := bytes.TrimSpace(it.Request)
			if len(trimmed) > 0 && trimmed[0] == '"' {
				req.URL = trimmed
			} else if json.Unmarshal(trimmed, &req) != nil {
				continue
			}
			raw, _, _ := parsePMURL(req.URL)
			if m := leadingVarRe.FindStringSubmatch(raw); m != nil {
				counts["var:"+m[1]]++
			} else if m := originRe.FindStringSubmatch(raw); m != nil {
				counts["origin:"+m[1]]++
			}
		}
	}
	walk(p.coll.Item)

	best, bestN := "", 0
	keys := make([]string, 0, len(counts))
	for k := range counts {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	for _, k := range keys {
		if counts[k] > bestN {
			best, bestN = k, counts[k]
		}
	}
	switch {
	case strings.HasPrefix(best, "var:"):
		p.baseVar = strings.TrimPrefix(best, "var:")
		value := ""
		for _, v := range env.Values {
			if v.Key == p.baseVar && kvEnabled(v) {
				value = pmValue(v.Value)
			}
		}
		if value == "" {
			for _, v := range p.coll.Variable {
				if v.Key == p.baseVar && !v.Disabled {
					value = pmValue(v.Value)
				}
			}
		}
		p.res.Env.BaseURL = strings.TrimRight(value, "/")
		if p.res.Env.BaseURL == "" || strings.Contains(p.res.Env.BaseURL, "{{") {
			p.res.warn("environment", "base URL variable {{%s}} has no concrete value; set base_url in .kest/config.yaml", p.baseVar)
			p.res.Env.BaseURL = ""
		}
	case strings.HasPrefix(best, "origin:"):
		p.baseOrigin = strings.TrimPrefix(best, "origin:")
		p.res.Env.BaseURL = p.baseOrigin
	}
}

func (p *postmanImporter) buildEnv(env pmEnvironment) {
	add := func(kv pmKV, fromEnvFile bool) {
		if kv.Key == "" || !kvEnabled(kv) {
			return
		}
		if p.baseVar != "" && kv.Key == p.baseVar {
			return
		}
		name := VarName(kv.Key)
		if kv.Type == "secret" || looksSecret(kv.Key) || p.authVars[name] || p.res.Env.isSecret(name) {
			p.res.Env.addSecret(name)
			return
		}
		value := renameVars(pmValue(kv.Value), nil)
		if !fromEnvFile {
			if _, exists := p.res.Env.Variables[name]; exists {
				return
			}
		}
		p.res.Env.setVar(name, value)
	}
	for _, v := range p.coll.Variable {
		add(v, false)
	}
	for _, v := range env.Values {
		add(v, true)
	}
}

func kvEnabled(kv pmKV) bool {
	if kv.Disabled {
		return false
	}
	if kv.Enabled != nil && !*kv.Enabled {
		return false
	}
	return true
}

// applyAuth maps Postman auth to request headers that reference variables.
func (p *postmanImporter) applyAuth(st *Step, auth *pmAuth, loc string) {
	// credVar returns a variable reference for a credential field, never a literal secret.
	credVar := func(raw, fallback string) string {
		if name, ok := isPureVar(raw); ok && !strings.HasPrefix(name, "$") {
			v := VarName(name)
			p.authVars[v] = true
			p.res.Env.addSecret(v)
			return v
		}
		if strings.TrimSpace(raw) != "" {
			p.res.warn(loc, "literal %s credential in Postman auth was not copied; pass it with --var %s=...", auth.Type, fallback)
		}
		p.authVars[fallback] = true
		p.res.Env.addSecret(fallback)
		return fallback
	}
	switch auth.Type {
	case "noauth", "":
		return
	case "bearer":
		v := credVar(auth.Params["token"], "token")
		st.Headers = append(st.Headers, KV{Name: "Authorization", Value: "Bearer {{" + v + "}}"})
	case "basic":
		user := auth.Params["username"]
		pass := auth.Params["password"]
		userVar, passVar := "basic_username", "basic_password"
		if n, ok := isPureVar(user); ok {
			userVar = VarName(n)
		} else if user != "" {
			p.res.Env.setVar(userVar, user)
		} else {
			p.res.Env.addRequired(userVar)
		}
		if n, ok := isPureVar(pass); ok {
			passVar = VarName(n)
		} else {
			p.res.warn("auth", "basic auth password was not copied; pass it with --var %s=...", passVar)
		}
		p.authVars[userVar] = true
		p.authVars[passVar] = true
		p.res.Env.addSecret(passVar)
		st.Headers = append(st.Headers, KV{Name: "Authorization", Value: "Basic {{$basicAuth(" + userVar + ", " + passVar + ")}}"})
	case "apikey":
		key := auth.Params["key"]
		if key == "" {
			key = "X-API-Key"
		}
		v := credVar(auth.Params["value"], "api_key")
		if strings.EqualFold(auth.Params["in"], "query") {
			st.Queries = append(st.Queries, KV{Name: renameVars(key, nil), Value: "{{" + v + "}}"})
		} else {
			st.Headers = append(st.Headers, KV{Name: renameVars(key, nil), Value: "{{" + v + "}}"})
		}
	default:
		p.res.warn(loc, "Postman auth type %q is not supported; add the credentials manually", auth.Type)
		st.Notes = append(st.Notes, Note{Title: fmt.Sprintf("Postman auth type %q was not translated. Add the required headers manually.", auth.Type)})
	}
}

func (p *postmanImporter) convertBody(b *pmBody, loc string, st *Step, rename func(string) string) (string, string) {
	switch b.Mode {
	case "raw":
		body := rename(b.Raw)
		if strings.TrimSpace(body) == "" {
			return "", ""
		}
		switch strings.ToLower(b.Options.Raw.Language) {
		case "json":
			return body, "application/json"
		case "xml":
			return body, "application/xml"
		case "html":
			return body, "text/html"
		case "javascript":
			return body, "application/javascript"
		case "text":
			return body, "text/plain"
		}
		t := strings.TrimSpace(body)
		if strings.HasPrefix(t, "{") || strings.HasPrefix(t, "[") {
			return body, "application/json"
		}
		return body, ""
	case "urlencoded":
		var parts []string
		for _, kv := range b.URLEncoded {
			if !kvEnabled(kv) {
				continue
			}
			parts = append(parts, encodeFormValue(rename(kv.Key))+"="+encodeFormValue(rename(pmValue(kv.Value))))
		}
		return strings.Join(parts, "&"), "application/x-www-form-urlencoded"
	case "graphql":
		if b.GraphQL == nil {
			return "", ""
		}
		payload := map[string]any{"query": b.GraphQL.Query}
		vars := bytes.TrimSpace(b.GraphQL.Variables)
		if len(vars) > 0 && string(vars) != "null" {
			var s string
			if json.Unmarshal(vars, &s) == nil {
				vars = []byte(strings.TrimSpace(s))
			}
			var parsed any
			if len(vars) > 0 && json.Unmarshal(vars, &parsed) == nil {
				payload["variables"] = parsed
			}
		}
		out, _ := marshalIndent(payload)
		return rename(out), "application/json"
	case "formdata":
		var lines []string
		for _, kv := range b.FormData {
			if !kvEnabled(kv) {
				continue
			}
			if kv.Type == "file" {
				lines = append(lines, fmt.Sprintf("%s=@%s", kv.Key, pmValue(kv.Src)))
			} else {
				lines = append(lines, fmt.Sprintf("%s=%s", kv.Key, pmValue(kv.Value)))
			}
		}
		st.Notes = append(st.Notes, Note{Title: "multipart/form-data body was not translated (flow steps do not support multipart yet). Fields:", Lang: "text", Content: strings.Join(lines, "\n")})
		p.res.warn(loc, "multipart/form-data body not translated (kept as a note)")
		return "", ""
	case "file":
		st.Notes = append(st.Notes, Note{Title: "Binary file body was not translated."})
		p.res.warn(loc, "binary file body not translated")
		return "", ""
	case "":
		return "", ""
	default:
		p.res.warn(loc, "body mode %q not supported", b.Mode)
		return "", ""
	}
}

func marshalIndent(v any) (string, error) {
	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)
	enc.SetEscapeHTML(false)
	enc.SetIndent("", "  ")
	if err := enc.Encode(v); err != nil {
		return "", err
	}
	return strings.TrimRight(buf.String(), "\n"), nil
}

// parsePMURL returns the URL without query, the enabled query params and path variables.
func parsePMURL(raw json.RawMessage) (string, []KV, []pmKV) {
	raw = bytes.TrimSpace(raw)
	if len(raw) == 0 || string(raw) == "null" {
		return "", nil, nil
	}
	var u pmURL
	if raw[0] == '"' {
		_ = json.Unmarshal(raw, &u.Raw)
	} else if err := json.Unmarshal(raw, &u); err != nil {
		return "", nil, nil
	}

	full := u.Raw
	if full == "" {
		host := strings.Join(stringList(u.Host), ".")
		path := strings.Join(stringList(u.Path), "/")
		if u.Protocol != "" {
			full = u.Protocol + "://"
		}
		full += host
		if u.Port != "" {
			full += ":" + u.Port
		}
		if path != "" {
			full += "/" + path
		}
	}
	base, rawQuery, _ := strings.Cut(full, "?")
	if i := strings.Index(base, "#"); i >= 0 {
		base = base[:i]
	}

	var queries []KV
	if u.Query != nil {
		for _, q := range u.Query {
			if !kvEnabled(q) || q.Key == "" {
				continue
			}
			queries = append(queries, KV{Name: q.Key, Value: pmValue(q.Value)})
		}
	} else if rawQuery != "" {
		for _, part := range strings.Split(rawQuery, "&") {
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
			queries = append(queries, KV{Name: k, Value: v})
		}
	}

	// Path variables (:id) become {{id}}.
	segments := strings.Split(base, "/")
	for i, seg := range segments {
		if strings.HasPrefix(seg, ":") && len(seg) > 1 && i > 0 {
			segments[i] = "{{" + seg[1:] + "}}"
		}
	}
	base = strings.Join(segments, "/")
	return base, queries, u.Variable
}

func parsePMHeaders(raw json.RawMessage) []KV {
	raw = bytes.TrimSpace(raw)
	if len(raw) == 0 || string(raw) == "null" {
		return nil
	}
	if raw[0] == '"' {
		// v2.0 allows headers as a single "Key: Value\n" string.
		var s string
		_ = json.Unmarshal(raw, &s)
		var out []KV
		for _, line := range strings.Split(s, "\n") {
			k, v, ok := strings.Cut(line, ":")
			if ok && strings.TrimSpace(k) != "" {
				out = append(out, KV{Name: strings.TrimSpace(k), Value: strings.TrimSpace(v)})
			}
		}
		return out
	}
	var list []pmKV
	if err := json.Unmarshal(raw, &list); err != nil {
		return nil
	}
	var out []KV
	for _, h := range list {
		if !kvEnabled(h) {
			continue
		}
		out = append(out, KV{Name: h.Key, Value: pmValue(h.Value)})
	}
	return out
}

// parseAuth handles both v2.1 ([{key,value}]) and v2.0 ({key: value}) auth parameter shapes.
func parseAuth(raw json.RawMessage) *pmAuth {
	raw = bytes.TrimSpace(raw)
	if len(raw) == 0 || string(raw) == "null" {
		return nil
	}
	var generic map[string]json.RawMessage
	if err := json.Unmarshal(raw, &generic); err != nil {
		return nil
	}
	var typ string
	_ = json.Unmarshal(generic["type"], &typ)
	if typ == "" {
		return nil
	}
	a := &pmAuth{Type: typ, Params: map[string]string{}}
	params := bytes.TrimSpace(generic[typ])
	if len(params) == 0 {
		return a
	}
	if params[0] == '[' {
		var list []pmKV
		if json.Unmarshal(params, &list) == nil {
			for _, kv := range list {
				a.Params[kv.Key] = pmValue(kv.Value)
			}
		}
	} else {
		var m map[string]json.RawMessage
		if json.Unmarshal(params, &m) == nil {
			for k, v := range m {
				a.Params[k] = pmValue(v)
			}
		}
	}
	return a
}

// pmValue converts a raw JSON scalar to string.
func pmValue(raw json.RawMessage) string {
	raw = bytes.TrimSpace(raw)
	if len(raw) == 0 || string(raw) == "null" {
		return ""
	}
	var s string
	if json.Unmarshal(raw, &s) == nil {
		return s
	}
	return string(raw)
}

// pmText extracts a description that may be a string or {content: "..."}.
func pmText(raw json.RawMessage) string {
	raw = bytes.TrimSpace(raw)
	if len(raw) == 0 || string(raw) == "null" {
		return ""
	}
	var s string
	if json.Unmarshal(raw, &s) == nil {
		return strings.TrimSpace(s)
	}
	var obj struct {
		Content string `json:"content"`
	}
	if json.Unmarshal(raw, &obj) == nil {
		return strings.TrimSpace(obj.Content)
	}
	return ""
}

func stringList(raw json.RawMessage) []string {
	raw = bytes.TrimSpace(raw)
	if len(raw) == 0 || string(raw) == "null" {
		return nil
	}
	var s string
	if json.Unmarshal(raw, &s) == nil {
		return []string{s}
	}
	var list []string
	_ = json.Unmarshal(raw, &list)
	return list
}

func scriptLines(raw json.RawMessage) []string {
	return stringList(raw)
}
