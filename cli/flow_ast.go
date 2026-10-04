package main

type FlowMeta struct {
	ID             string
	Name           string
	Version        string
	Env            string
	Tags           []string
	DefaultHeaders map[string]string // Flow-level default headers (name -> value)

	// Authoring features declared with @ directives in the flow block.
	DefaultHeaderLines []string // "Name: value" lines from @default-header, in order
	DefaultAsserts     []string // expressions from @default-assert, in order
	AutoContentType    bool     // @auto-content-type json
	Uses               []FlowUse
}

// FlowUse is one `@use path [as alias]` include declared in the flow block.
type FlowUse struct {
	Path    string
	Alias   string
	LineNum int // line of the flow block that declared it
}

type FlowStep struct {
	ID             string
	Name           string
	Type           string
	Retry          int
	RetryWait      int
	MaxDuration    int
	WaitMs         int
	PollTimeoutMs  int
	PollIntervalMs int
	ExecTimeoutMs  int // per-step exec timeout (overrides global --exec-timeout)
	OnFail         string
	NoDefaults     bool   // @no-defaults: skip flow-level default headers/assertions
	IncludedFrom   string // set for steps pulled in by @use: the include path as written
	Namespace      string // set for included steps: the id prefix (alias or file name)
	LineNum        int
	Raw            string
	Request        RequestOptions
	Exec           ExecOptions
}

type ExecOptions struct {
	Command  string
	Captures []string
}

type FlowEdge struct {
	From    string
	To      string
	On      string
	LineNum int
}

type FlowDoc struct {
	Meta     FlowMeta
	Setup    []FlowStep
	Steps    []FlowStep
	Teardown []FlowStep
	Edges    []FlowEdge
}
