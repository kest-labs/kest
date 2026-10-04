package main

import (
	"os"
)

// loadFlowDocument reads and parses a flow file. It returns the legacy blocks
// for files that use the old format. Every code path that needs a fully
// resolved document (run, lint, flow-plan) goes through here.
func loadFlowDocument(path string) (FlowDoc, []KestBlock, error) {
	content, err := os.ReadFile(path)
	if err != nil {
		return FlowDoc{}, nil, err
	}
	doc, legacy := ParseFlowDocument(string(content))
	doc, err = ExpandFlowIncludes(doc, path)
	if err != nil {
		return doc, legacy, err
	}
	return doc, legacy, nil
}
