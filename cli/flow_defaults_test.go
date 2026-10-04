package main

import (
	"strings"
	"testing"
)

const defaultsFlow = "# Defaults\n\n" +
	"```flow\n@flow id=defaults\n@name Defaults\n" +
	"@default-header X-Trace: abc\n" +
	"@default-header Accept: application/json\n" +
	"@default-assert status == 200\n" +
	"@default-assert body.ok == true\n" +
	"@auto-content-type json\n```\n\n" +
	// plain step: gets everything, JSON body gets Content-Type
	"```step\n@id plain\nPOST /a\n\n{\"a\": 1}\n```\n\n" +
	// own Content-Type and Accept win over defaults
	"```step\n@id own\nPOST /b\nContent-Type: text/plain\nAccept: text/csv\n\n{\"a\": 1}\n```\n\n" +
	// opted out: no headers, no assertions, no content type
	"```step\n@id bare\n@no-defaults\nPOST /c\n\n{\"a\": 1}\n```\n\n" +
	// asserts the same subject as a default (status): that default is skipped
	"```step\n@id created\nPOST /created\n\n{\"a\": 1}\n\n[Asserts]\nstatus == 201\n```\n\n" +
	// not JSON: no Content-Type
	"```step\n@id form\nPOST /d\n\na=1&b=2\n```\n"

func TestFlowDefaultsParse(t *testing.T) {
	doc, _ := ParseFlowDocument(defaultsFlow)
	if len(doc.Meta.DefaultHeaderLines) != 2 || len(doc.Meta.DefaultAsserts) != 2 || !doc.Meta.AutoContentType {
		t.Fatalf("meta not parsed: %+v", doc.Meta)
	}
	byID := map[string]FlowStep{}
	for _, s := range doc.Steps {
		byID[s.ID] = s
	}
	plain := byID["plain"]
	if got := strings.Join(plain.Request.Headers, "|"); got != "X-Trace: abc|Accept: application/json" {
		t.Errorf("plain headers = %q", got)
	}
	if got := strings.Join(plain.Request.Asserts, "|"); got != "status == 200|body.ok == true" {
		t.Errorf("plain asserts = %q", got)
	}
	own := byID["own"]
	if got := strings.Join(own.Request.Headers, "|"); got != "X-Trace: abc|Content-Type: text/plain|Accept: text/csv" {
		t.Errorf("own headers = %q", got)
	}
	bare := byID["bare"]
	if len(bare.Request.Headers) != 0 || len(bare.Request.Asserts) != 0 || bare.Request.AutoJSONContentType {
		t.Errorf("@no-defaults step was modified: %+v", bare.Request)
	}
	created := byID["created"]
	if got := strings.Join(created.Request.Asserts, "|"); got != "status == 201|body.ok == true" {
		t.Errorf("created asserts = %q (status default must be overridden)", got)
	}
}

func TestFlowWithoutDefaultsIsUntouched(t *testing.T) {
	doc, _ := ParseFlowDocument(strings.Replace(defaultsFlow, "@auto-content-type json\n", "", 1))
	_ = doc
	plain, _ := ParseFlowDocument("```step\n@id a\nGET /a\n```\n")
	s := plain.Steps[0]
	if len(s.Request.Headers) != 0 || len(s.Request.Asserts) != 0 || s.Request.AutoJSONContentType {
		t.Fatalf("flow without defaults changed: %+v", s.Request)
	}
}

func TestFlowDefaultsRun(t *testing.T) {
	work := isolateKest(t)
	srv := newRecordingServer(t)

	res, err := runFlowFile(t, work, "defaults.flow.md", defaultsFlow, srv.URL)
	if err != nil {
		t.Fatalf("run failed: %v", err)
	}
	reqs := srv.requests()
	if len(reqs) != 5 {
		t.Fatalf("expected 5 requests, got %v", srv.paths())
	}
	if reqs[0].Header.Get("X-Trace") != "abc" || reqs[0].Header.Get("Content-Type") != "application/json" {
		t.Errorf("plain step headers: %v", reqs[0].Header)
	}
	if reqs[1].Header.Get("Content-Type") != "text/plain" || reqs[1].Header.Get("Accept") != "text/csv" {
		t.Errorf("own step headers: %v", reqs[1].Header)
	}
	if reqs[2].Header.Get("X-Trace") != "" || reqs[2].Header.Get("Content-Type") != "" {
		t.Errorf("@no-defaults step got defaults: %v", reqs[2].Header)
	}
	if reqs[4].Header.Get("Content-Type") != "" {
		t.Errorf("non-JSON body must not get a Content-Type: %v", reqs[4].Header)
	}

	// Default assertions are visible as evaluated assertions of the step.
	var exprs []string
	for _, a := range res.Steps[0].Assertions {
		exprs = append(exprs, a.Expr)
	}
	if strings.Join(exprs, "|") != "status == 200|body.ok == true" {
		t.Errorf("assertions of first step = %v", exprs)
	}
}

func TestFlowDefaultAssertFailsStep(t *testing.T) {
	work := isolateKest(t)
	srv := newRecordingServer(t)
	flow := "```flow\n@flow id=d\n@default-assert status == 200\n```\n\n```step\n@id gone\nGET /missing\n```\n"
	_, err := runFlowFile(t, work, "d.flow.md", flow, srv.URL)
	if err == nil {
		t.Fatal("expected default status assertion to fail on 404")
	}
}

func TestAutoContentTypeRequiresOptIn(t *testing.T) {
	work := isolateKest(t)
	srv := newRecordingServer(t)
	flow := "```step\n@id a\nPOST /a\n\n{\"a\": 1}\n```\n"
	if _, err := runFlowFile(t, work, "n.flow.md", flow, srv.URL); err != nil {
		t.Fatal(err)
	}
	if ct := srv.requests()[0].Header.Get("Content-Type"); ct != "" {
		t.Fatalf("Content-Type must not be added without opt-in, got %q", ct)
	}
}
