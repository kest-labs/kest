package main

// runSettings snapshots the package-level run flags. The run pipeline reads
// these globals deep in its call path, so programmatic callers (the MCP
// server, tests) set them for one invocation and restore them afterwards.
type runSettings struct {
	parallel      bool
	jobs          int
	verbose       bool
	debugVars     bool
	vars          []string
	execTimeout   int
	failFast      bool
	strict        bool
	env           string
	baseURL       string
	profile       string
	sync          bool
	reportJSON    string
	reportJUnit   string
	html          bool
	open          bool
	workspaceFlow string
	runnerType    string
	selection     runSelection
}

func captureRunSettings() runSettings {
	return runSettings{
		parallel:      runParallel,
		jobs:          runJobs,
		verbose:       runVerbose,
		debugVars:     runDebugVars,
		vars:          append([]string(nil), runVars...),
		execTimeout:   execTimeout,
		failFast:      runFailFast,
		strict:        runStrict,
		env:           runEnv,
		baseURL:       runBaseURL,
		profile:       runProfile,
		sync:          runSync,
		reportJSON:    runReportJSON,
		reportJUnit:   runReportJUnit,
		html:          runHTML,
		open:          runOpen,
		workspaceFlow: runWorkspaceFlow,
		runnerType:    runRunnerType,
		selection:     runSel.clone(),
	}
}

func (s runSettings) apply() {
	runParallel = s.parallel
	runJobs = s.jobs
	runVerbose = s.verbose
	runDebugVars = s.debugVars
	runVars = append([]string(nil), s.vars...)
	execTimeout = s.execTimeout
	runFailFast = s.failFast
	runStrict = s.strict
	runEnv = s.env
	runBaseURL = s.baseURL
	runProfile = s.profile
	runSync = s.sync
	runReportJSON = s.reportJSON
	runReportJUnit = s.reportJUnit
	runHTML = s.html
	runOpen = s.open
	runWorkspaceFlow = s.workspaceFlow
	runRunnerType = s.runnerType
	runSel = s.selection.clone()
}

// defaultRunSettings mirrors the flag defaults of `kest run`.
func defaultRunSettings() runSettings {
	return runSettings{jobs: 4, execTimeout: 30}
}
