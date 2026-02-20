package main

type FlowMeta struct {
	ID             string
	Name           string
	Version        string
	Env            string
	Tags           []string
	DefaultHeaders map[string]string // Flow-level default headers
}

type FlowStep struct {
	ID          string
	Name        string
	Type        string
	Retry       int
	RetryWait   int
	MaxDuration int
	OnFail      string
	LineNum     int
	Raw         string
	Request     RequestOptions
	Exec        ExecOptions
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
	Meta  FlowMeta
	Steps []FlowStep
	Edges []FlowEdge
}
