package importer

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/getkin/kin-openapi/openapi2"
	"github.com/getkin/kin-openapi/openapi2conv"
	"github.com/getkin/kin-openapi/openapi3"
	"github.com/oasdiff/yaml"
)

// OpenAPIOptions configures an OpenAPI import.
type OpenAPIOptions struct {
	EnvName string
}

var openAPIMethodOrder = []string{"GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS", "TRACE"}

// ImportOpenAPI loads an OpenAPI 3.x (or Swagger 2.0) spec from a file path or
// http(s) URL and generates one smoke flow per tag.
func ImportOpenAPI(source string, opts OpenAPIOptions) (*Result, error) {
	doc, err := loadOpenAPI(source)
	if err != nil {
		return nil, err
	}
	return importOpenAPIDoc(doc, opts)
}

// ImportOpenAPIData is like ImportOpenAPI but takes the spec content directly.
func ImportOpenAPIData(data []byte, opts OpenAPIOptions) (*Result, error) {
	doc, err := loadOpenAPIData(data, nil)
	if err != nil {
		return nil, err
	}
	return importOpenAPIDoc(doc, opts)
}

func loadOpenAPI(source string) (*openapi3.T, error) {
	loader := openapi3.NewLoader()
	loader.IsExternalRefsAllowed = true
	if strings.HasPrefix(source, "http://") || strings.HasPrefix(source, "https://") {
		u, err := url.Parse(source)
		if err != nil {
			return nil, err
		}
		data, err := openapi3.ReadFromHTTP(&http.Client{Timeout: 30 * time.Second})(loader, u)
		if err != nil {
			return nil, fmt.Errorf("failed to fetch OpenAPI spec: %w", err)
		}
		return loadOpenAPIData(data, u)
	}
	data, err := os.ReadFile(source)
	if err != nil {
		return nil, err
	}
	abs := &url.URL{Path: source}
	return loadOpenAPIData(data, abs)
}

func loadOpenAPIData(data []byte, location *url.URL) (*openapi3.T, error) {
	var probe struct {
		Swagger string `json:"swagger"`
		OpenAPI string `json:"openapi"`
	}
	jsonData := data
	if t := bytes.TrimSpace(data); len(t) == 0 || t[0] != '{' {
		converted, err := yaml.YAMLToJSON(data)
		if err != nil {
			return nil, fmt.Errorf("spec is neither JSON nor YAML: %w", err)
		}
		jsonData = converted
	}
	if err := json.Unmarshal(jsonData, &probe); err != nil {
		return nil, fmt.Errorf("failed to parse spec: %w", err)
	}

	loader := openapi3.NewLoader()
	loader.IsExternalRefsAllowed = true
	if strings.HasPrefix(probe.Swagger, "2") {
		var doc2 openapi2.T
		if err := json.Unmarshal(jsonData, &doc2); err != nil {
			return nil, fmt.Errorf("failed to parse Swagger 2.0 spec: %w", err)
		}
		doc3, err := openapi2conv.ToV3(&doc2)
		if err != nil {
			return nil, fmt.Errorf("failed to convert Swagger 2.0 spec: %w", err)
		}
		return doc3, nil
	}
	if probe.OpenAPI == "" {
		return nil, fmt.Errorf("not an OpenAPI document (missing \"openapi\" or \"swagger\" version field)")
	}
	var (
		doc *openapi3.T
		err error
	)
	if location != nil {
		doc, err = loader.LoadFromDataWithPath(data, location)
	} else {
		doc, err = loader.LoadFromData(data)
	}
	if err != nil {
		return nil, fmt.Errorf("failed to load OpenAPI spec: %w", err)
	}
	return doc, nil
}

var bracePathRe = regexp.MustCompile(`\{[^{}]+\}`)

type openAPIOp struct {
	path   string
	method string
	item   *openapi3.PathItem
	op     *openapi3.Operation
}

func importOpenAPIDoc(doc *openapi3.T, opts OpenAPIOptions) (*Result, error) {
	title := "API"
	if doc.Info != nil && doc.Info.Title != "" {
		title = doc.Info.Title
	}
	res := &Result{SourceKind: "openapi", SourceName: title}
	res.Env.Name = opts.EnvName
	if res.Env.Name == "" {
		res.Env.Name = "dev"
	}
	if err := doc.Validate(context.Background()); err != nil {
		res.warn("spec", "OpenAPI validation reported: %v", err)
	}
	if len(doc.Servers) > 0 && doc.Servers[0] != nil {
		res.Env.BaseURL = strings.TrimRight(serverURL(doc.Servers[0]), "/")
	} else {
		res.warn("spec", "no servers defined; set base_url in .kest/config.yaml")
	}

	// Group operations by first tag.
	groups := map[string][]openAPIOp{}
	var tagOrder []string
	if doc.Paths != nil {
		paths := doc.Paths.Map()
		keys := make([]string, 0, len(paths))
		for k := range paths {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		for _, p := range keys {
			item := paths[p]
			ops := item.Operations()
			for _, m := range openAPIMethodOrder {
				op := ops[m]
				if op == nil {
					continue
				}
				tag := "default"
				if len(op.Tags) > 0 && strings.TrimSpace(op.Tags[0]) != "" {
					tag = op.Tags[0]
				}
				if _, ok := groups[tag]; !ok {
					tagOrder = append(tagOrder, tag)
				}
				groups[tag] = append(groups[tag], openAPIOp{path: p, method: m, item: item, op: op})
			}
		}
	}
	if len(groups) == 0 {
		return nil, fmt.Errorf("spec has no operations")
	}
	// Prefer the order of the top-level tags list when present.
	sort.SliceStable(tagOrder, func(i, j int) bool {
		return tagIndex(doc, tagOrder[i]) < tagIndex(doc, tagOrder[j])
	})

	usedFiles := map[string]bool{}
	for _, tag := range tagOrder {
		slug := uniqueName(Slug(tag), usedFiles)
		f := FlowFile{
			FileName: slug + ".smoke.flow.md",
			ID:       slug + "-smoke",
			Name:     title + " - " + tag + " smoke",
			Source:   fmt.Sprintf("Generated from OpenAPI spec %q with `kest import openapi`. One request per operation; adjust example values before relying on it.", title),
			Tags:     []string{"openapi", "smoke", Slug(tag)},
		}
		if t := doc.Tags.Get(tag); t != nil {
			f.Description = t.Description
		}
		ids := map[string]bool{}
		sec := Section{}
		for _, o := range groups[tag] {
			sec.Steps = append(sec.Steps, openAPIStep(doc, o, res, ids))
		}
		f.Sections = []Section{sec}
		res.Files = append(res.Files, f)
	}
	res.finalizeEnv()
	return res, nil
}

func tagIndex(doc *openapi3.T, name string) int {
	for i, t := range doc.Tags {
		if t != nil && t.Name == name {
			return i
		}
	}
	return len(doc.Tags) + 1
}

func serverURL(s *openapi3.Server) string {
	u := s.URL
	for name, v := range s.Variables {
		if v != nil {
			u = strings.ReplaceAll(u, "{"+name+"}", v.Default)
		}
	}
	return u
}

func openAPIStep(doc *openapi3.T, o openAPIOp, res *Result, ids map[string]bool) Step {
	loc := o.method + " " + o.path
	op := o.op
	name := strings.TrimSpace(op.Summary)
	if name == "" {
		name = loc
	}
	idBase := Slug(VarName(op.OperationID))
	if op.OperationID == "" {
		idBase = ""
	}
	if idBase == "" {
		idBase = Slug(strings.ToLower(o.method) + " " + o.path)
	}
	st := Step{
		ID:          uniqueName(idBase, ids),
		Name:        name,
		Description: strings.TrimSpace(op.Description),
		Method:      o.method,
	}

	// Parameters (path-level first, operation-level overrides).
	params := map[string]*openapi3.Parameter{}
	var order []string
	for _, list := range []openapi3.Parameters{o.item.Parameters, op.Parameters} {
		for _, ref := range list {
			if ref == nil || ref.Value == nil {
				continue
			}
			key := ref.Value.In + ":" + ref.Value.Name
			if _, ok := params[key]; !ok {
				order = append(order, key)
			}
			params[key] = ref.Value
		}
	}

	// Path templates {name} become Kest variables {{name}}.
	urlPath := bracePathRe.ReplaceAllStringFunc(o.path, func(m string) string {
		return "{{" + VarName(m[1:len(m)-1]) + "}}"
	})
	for _, key := range order {
		p := params[key]
		v := VarName(p.Name)
		example, hasExample := paramExample(p)
		switch p.In {
		case openapi3.ParameterInPath:
			if hasExample {
				if _, exists := res.Env.Variables[v]; !exists {
					res.Env.setVar(v, example)
				}
			}
		case openapi3.ParameterInQuery:
			if !p.Required {
				continue
			}
			if hasExample {
				st.Queries = append(st.Queries, KV{Name: p.Name, Value: example})
			} else {
				st.Queries = append(st.Queries, KV{Name: p.Name, Value: "{{" + v + "}}"})
			}
		case openapi3.ParameterInHeader:
			if !p.Required {
				continue
			}
			value := "{{" + v + "}}"
			if hasExample && !looksSecret(p.Name) {
				value = example
			} else if p.Schema != nil && p.Schema.Value != nil && p.Schema.Value.Format == "uuid" {
				value = "{{$uuid}}"
			}
			st.Headers = append(st.Headers, KV{Name: p.Name, Value: value})
		case openapi3.ParameterInCookie:
			if p.Required {
				res.warn(loc, "required cookie parameter %q not translated", p.Name)
			}
		}
	}
	st.URL = urlPath

	applyOpenAPISecurity(doc, op, &st, res)

	// Request body.
	if op.RequestBody != nil && op.RequestBody.Value != nil {
		body, ct := openAPIBody(op.RequestBody.Value, loc, res)
		if body != "" {
			if pickFence(body) == "" {
				res.warn(loc, "example body could not be embedded")
			} else {
				st.Body = body
				st.Headers = append(st.Headers, KV{Name: "Content-Type", Value: ct})
			}
		}
	}

	st.Asserts = openAPIStatusAsserts(op, loc, res)
	return st
}

func paramExample(p *openapi3.Parameter) (string, bool) {
	if p.Example != nil {
		return scalarString(p.Example), true
	}
	for _, name := range sortedKeys(p.Examples) {
		if ex := p.Examples[name]; ex != nil && ex.Value != nil && ex.Value.Value != nil {
			return scalarString(ex.Value.Value), true
		}
	}
	if p.Schema != nil && p.Schema.Value != nil {
		s := p.Schema.Value
		if s.Example != nil {
			return scalarString(s.Example), true
		}
		if s.Default != nil {
			return scalarString(s.Default), true
		}
		if len(s.Enum) > 0 {
			return scalarString(s.Enum[0]), true
		}
	}
	return "", false
}

func scalarString(v any) string {
	switch t := v.(type) {
	case string:
		return t
	case float64:
		return strconv.FormatFloat(t, 'f', -1, 64)
	case nil:
		return ""
	default:
		b, err := json.Marshal(t)
		if err != nil {
			return fmt.Sprint(t)
		}
		return string(b)
	}
}

func sortedKeys[T any](m map[string]T) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}

func applyOpenAPISecurity(doc *openapi3.T, op *openapi3.Operation, st *Step, res *Result) {
	reqs := doc.Security
	if op.Security != nil {
		reqs = *op.Security
	}
	if len(reqs) == 0 || doc.Components == nil {
		return
	}
	// Use the first alternative; an empty requirement means auth is optional.
	req := reqs[0]
	for _, name := range sortedKeys(req) {
		ref := doc.Components.SecuritySchemes[name]
		if ref == nil || ref.Value == nil {
			continue
		}
		s := ref.Value
		switch strings.ToLower(s.Type) {
		case "http":
			switch strings.ToLower(s.Scheme) {
			case "bearer":
				st.Headers = append(st.Headers, KV{Name: "Authorization", Value: "Bearer {{token}}"})
				res.Env.addSecret("token")
			case "basic":
				st.Headers = append(st.Headers, KV{Name: "Authorization", Value: "Basic {{basic_auth}}"})
				res.Env.addSecret("basic_auth")
			default:
				res.warn("security", "HTTP auth scheme %q not supported; add the header manually", s.Scheme)
			}
		case "apikey":
			v := VarName(name)
			if !strings.Contains(v, "key") && !strings.Contains(v, "token") {
				v = "api_key"
			}
			res.Env.addSecret(v)
			switch s.In {
			case "query":
				st.Queries = append(st.Queries, KV{Name: s.Name, Value: "{{" + v + "}}"})
			case "cookie":
				st.Headers = append(st.Headers, KV{Name: "Cookie", Value: s.Name + "={{" + v + "}}"})
			default:
				st.Headers = append(st.Headers, KV{Name: s.Name, Value: "{{" + v + "}}"})
			}
		case "oauth2", "openidconnect":
			st.Headers = append(st.Headers, KV{Name: "Authorization", Value: "Bearer {{token}}"})
			res.Env.addSecret("token")
			res.warn("security", "%s scheme %q mapped to a bearer token; obtain it separately and pass --var token=...", s.Type, name)
		default:
			res.warn("security", "security scheme %q of type %q not supported", name, s.Type)
		}
	}
}

func openAPIBody(rb *openapi3.RequestBody, loc string, res *Result) (string, string) {
	if len(rb.Content) == 0 {
		return "", ""
	}
	var ct string
	for _, c := range sortedKeys(rb.Content) {
		if c == "application/json" || strings.HasSuffix(c, "+json") {
			ct = c
			break
		}
	}
	if ct == "" {
		if _, ok := rb.Content["application/x-www-form-urlencoded"]; ok {
			ct = "application/x-www-form-urlencoded"
		}
	}
	if ct == "" {
		keys := sortedKeys(rb.Content)
		res.warn(loc, "request body content type %q not supported; add the body manually", keys[0])
		return "", ""
	}
	mt := rb.Content[ct]
	var example any
	switch {
	case mt.Example != nil:
		example = mt.Example
	case len(mt.Examples) > 0:
		for _, name := range sortedKeys(mt.Examples) {
			if ex := mt.Examples[name]; ex != nil && ex.Value != nil && ex.Value.Value != nil {
				example = ex.Value.Value
				break
			}
		}
	}
	if example == nil && mt.Schema != nil {
		example = exampleFromSchema(mt.Schema, 0, map[*openapi3.Schema]bool{})
	}
	if example == nil {
		example = map[string]any{}
	}
	if ct == "application/x-www-form-urlencoded" {
		obj, ok := example.(map[string]any)
		if !ok {
			return "", ""
		}
		var parts []string
		for _, k := range sortedKeys(obj) {
			parts = append(parts, url.QueryEscape(k)+"="+url.QueryEscape(scalarString(obj[k])))
		}
		return strings.Join(parts, "&"), ct
	}
	out, err := marshalIndent(example)
	if err != nil {
		res.warn(loc, "example body could not be encoded: %v", err)
		return "", ""
	}
	return out, ct
}

// exampleFromSchema builds a representative value from schema examples,
// defaults, enums and types.
func exampleFromSchema(ref *openapi3.SchemaRef, depth int, seen map[*openapi3.Schema]bool) any {
	if ref == nil || ref.Value == nil || depth > 6 {
		return nil
	}
	s := ref.Value
	if s.Example != nil {
		return s.Example
	}
	if s.Default != nil {
		return s.Default
	}
	if len(s.Enum) > 0 {
		return s.Enum[0]
	}
	if seen[s] {
		return nil
	}
	seen[s] = true
	defer delete(seen, s)

	if len(s.AllOf) > 0 {
		merged := map[string]any{}
		for _, sub := range s.AllOf {
			if obj, ok := exampleFromSchema(sub, depth+1, seen).(map[string]any); ok {
				for k, v := range obj {
					merged[k] = v
				}
			}
		}
		return merged
	}
	for _, alts := range []openapi3.SchemaRefs{s.OneOf, s.AnyOf} {
		if len(alts) > 0 {
			return exampleFromSchema(alts[0], depth+1, seen)
		}
	}

	switch {
	case s.Type.Is("object") || (s.Type == nil && len(s.Properties) > 0):
		obj := map[string]any{}
		for _, name := range sortedKeys(s.Properties) {
			prop := s.Properties[name]
			if prop != nil && prop.Value != nil && prop.Value.ReadOnly {
				continue
			}
			if v := exampleFromSchema(prop, depth+1, seen); v != nil {
				obj[name] = v
			}
		}
		return obj
	case s.Type.Is("array"):
		if item := exampleFromSchema(s.Items, depth+1, seen); item != nil {
			return []any{item}
		}
		return []any{}
	case s.Type.Is("integer"):
		return 1
	case s.Type.Is("number"):
		return 1.5
	case s.Type.Is("boolean"):
		return true
	case s.Type.Is("string"):
		switch s.Format {
		case "date-time":
			return "2024-01-01T00:00:00Z"
		case "date":
			return "2024-01-01"
		case "email":
			return "user@example.com"
		case "uuid":
			return "00000000-0000-4000-8000-000000000000"
		case "uri", "url":
			return "https://example.com"
		}
		return "string"
	}
	return nil
}

func openAPIStatusAsserts(op *openapi3.Operation, loc string, res *Result) []string {
	if op.Responses != nil {
		codes := sortedKeys(op.Responses.Map())
		for _, c := range codes {
			if len(c) == 3 && c[0] == '2' && c[1] >= '0' && c[1] <= '9' && c[2] >= '0' && c[2] <= '9' {
				return []string{"status == " + c}
			}
		}
		for _, c := range codes {
			if strings.EqualFold(c, "2XX") {
				return []string{"status >= 200", "status < 300"}
			}
		}
	}
	res.warn(loc, "no 2xx response documented; asserting status 2xx")
	return []string{"status >= 200", "status < 300"}
}
