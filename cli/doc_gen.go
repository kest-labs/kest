package main

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/kest-labs/kest/cli/internal/ai"
	"github.com/kest-labs/kest/cli/internal/config"
	"github.com/kest-labs/kest/cli/internal/scanner"
	"github.com/kest-labs/kest/cli/internal/scanner/gin"
	"github.com/kest-labs/kest/cli/internal/storage"
	"github.com/spf13/cobra"
)

var (
	docOutputDir string
	useAI        bool
	listOnly     bool
	verifyOnly   bool
	serveOnly    bool
	onlyModules  []string
	docLang      string
)

var docCmd = &cobra.Command{
	Use:     "doc [path]",
	Aliases: []string{"scan"},
	Short:   "Scan project and generate API documentation",
	Long: `Scan a project (Gin, FastAPI, etc.) to automatically generate 
elegant Markdown API documentation.`,
	Example: `  # Scan current directory
  kest doc .

  # List detected modules without generating documentation
  kest doc . --list

  # Generate documentation only for specific modules
  kest doc . --module category,project

  # Scan with AI-powered descriptions and examples
  kest doc . --ai`,
	Args: cobra.MaximumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		path := "."
		if len(args) > 0 {
			path = args[0]
		}
		return runDocGen(path, docOutputDir, useAI, listOnly, verifyOnly, serveOnly, onlyModules, docLang)
	},
}

func init() {
	docCmd.Flags().StringVarP(&docOutputDir, "output", "o", "docs/api", "Output directory for generated documentation")
	docCmd.Flags().BoolVar(&useAI, "ai", false, "Use AI to enhance documentation with summaries and examples")
	docCmd.Flags().BoolVarP(&listOnly, "list", "l", false, "List detected modules/endpoints without generating documentation")
	docCmd.Flags().BoolVar(&verifyOnly, "verify", false, "Verify if the current code matches the existing documentation (Drift Detection)")
	docCmd.Flags().BoolVar(&serveOnly, "serve", false, "Start a local web server to preview documentation")
	docCmd.Flags().StringSliceVarP(&onlyModules, "module", "m", nil, "Generate documentation only for specified modules (comma separated)")
	docCmd.Flags().StringVar(&docLang, "lang", "en", "Language for generated documentation (en, zh)")
	rootCmd.AddCommand(docCmd)
}

func runDocGen(rootPath, outputDir string, useAI, listOnly, verifyOnly, serveOnly bool, onlyModules []string, lang string) error {
	fmt.Printf("🔍 Scanning project at: %s\n", rootPath)

	ctx := context.Background()
	conf := loadConfigWarn()

	// 1. Framework Detection & Scanning
	ginScanner := gin.NewScanner()
	if !ginScanner.Detect(ctx, rootPath) {
		return fmt.Errorf("could not detect any supported framework at %s", rootPath)
	}

	modules, err := ginScanner.Scan(ctx, rootPath)
	if err != nil {
		return err
	}

	// 2. Filter modules if specified
	if len(onlyModules) > 0 {
		filterMap := make(map[string]bool)
		for _, m := range onlyModules {
			filterMap[strings.ToLower(m)] = true
		}

		var filtered []*scanner.ModuleInfo
		for _, m := range modules {
			if filterMap[strings.ToLower(m.Name)] {
				filtered = append(filtered, m)
			}
		}
		modules = filtered
	}

	// 3. Handle List-Only mode
	if listOnly {
		fmt.Printf("\n📦 Detected %d modules:\n", len(modules))
		fmt.Printf("| %-20s | %-10s | %-30s |\n", "Module", "Endpoints", "Preview")
		fmt.Printf("| %-20s | %-10s | %-30s |\n", strings.Repeat("-", 20), strings.Repeat("-", 10), strings.Repeat("-", 30))
		for _, m := range modules {
			preview := ""
			if len(m.Endpoints) > 0 {
				preview = fmt.Sprintf("%s %s", m.Endpoints[0].Method, m.Endpoints[0].Path)
			}
			fmt.Printf("| %-20s | %-10d | %-30s |\n", m.Name, len(m.Endpoints), preview)
		}
		return nil
	}

	// 4. Handle Verify-Only mode (Drift Detection)
	if verifyOnly {
		return runVerify(modules, outputDir)
	}

	// 5. Handle Serve mode
	if serveOnly {
		return runServe(outputDir)
	}

	// 6. Generate Markdown
	if err := os.MkdirAll(outputDir, 0755); err != nil {
		return err
	}

	// Load previous generation state for deduplication
	stateFile := filepath.Join(outputDir, ".doc-state.json")
	prevState := loadDocState(stateFile)
	newState := make(map[string]string)
	generated := 0
	skipped := 0

	modulesPath := filepath.Join(rootPath, "internal", "modules")

	for _, mod := range modules {
		// Compute hash of all source files in the module directory
		modDir := filepath.Join(modulesPath, mod.Name)
		currentHash := hashModuleDir(modDir)
		newState[mod.Name] = currentHash

		// Skip if unchanged
		if prevHash, ok := prevState[mod.Name]; ok && prevHash == currentHash {
			skipped++
			fmt.Printf("⏭️  Skipping %s (unchanged)\n", mod.Name)
			continue
		}

		if useAI {
			projectName := filepath.Base(rootPath)
			fmt.Printf("🧠 Enhancing module %s with AI (Project: %s, Lang: %s)...\n", mod.Name, projectName, lang)
			enhanceModuleWithAI(mod, projectName, lang, conf)
		}
		if err := generateModuleDoc(mod, outputDir, lang); err != nil {
			fmt.Printf("❌ Failed to generate doc for %s: %v\n", mod.Name, err)
		} else {
			generated++
		}
	}

	// Save new state
	saveDocState(stateFile, newState)

	if skipped > 0 {
		fmt.Printf("\n✨ Generated %d modules, skipped %d unchanged modules in %s\n", generated, skipped, outputDir)
	} else {
		fmt.Printf("\n✨ Successfully generated documentation for %d modules in %s\n", generated, outputDir)
	}
	return nil
}

func runServe(dir string) error {
	absDir, _ := filepath.Abs(dir)
	if _, err := os.Stat(absDir); os.IsNotExist(err) {
		return fmt.Errorf("directory %s does not exist. Run 'kest doc' first", dir)
	}

	indexHTML := `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Kest Live Portal - API Documentation</title>
    <!-- Premium Fonts -->
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&family=JetBrains+Mono&display=swap" rel="stylesheet">
    <!-- Zero-MD for Markdown rendering -->
    <script type="module" src="https://cdn.jsdelivr.net/npm/zero-md@2.5.4/dist/zero-md.min.js"></script>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body { font-family: 'Inter', sans-serif; background-color: #020617; color: #f8fafc; }
        .sidebar { background: rgba(15, 23, 42, 0.8); backdrop-filter: blur(12px); border-right: 1px solid rgba(255,255,255,0.05); }
        .glass { background: rgba(30, 41, 59, 0.4); backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.05); }
        code { font-family: 'JetBrains Mono', monospace; }
        zero-md::part(markdown-body) {
            background: transparent !important;
            color: #e2e8f0 !important;
            line-height: 1.6;
        }
        zero-md::part(markdown-body) h1, 
        zero-md::part(markdown-body) h2,
        zero-md::part(markdown-body) h3,
        zero-md::part(markdown-body) h4 { 
            color: #f8fafc !important; 
            border-bottom: 1px solid #1e293b; 
            padding-bottom: 0.5rem;
            margin-top: 2rem;
        }
        zero-md::part(markdown-body) p, 
        zero-md::part(markdown-body) li { 
            color: #94a3b8 !important; 
        }
        zero-md::part(markdown-body) strong { 
            color: #f8fafc !important; 
            font-weight: 800;
        }
        zero-md::part(markdown-body) code { 
            background: #1e293b !important; 
            padding: 0.2rem 0.4rem; 
            border-radius: 4px; 
            color: #38bdf8 !important; 
        }
        zero-md::part(markdown-body) pre { 
            background: #0f172a !important; 
            border: 1px solid #1e293b; 
            border-radius: 12px; 
            padding: 1.5rem !important;
        }
        zero-md::part(markdown-body) table { 
            border-collapse: collapse;
            width: 100%;
            margin: 2rem 0;
            background: rgba(30, 41, 59, 0.4);
            border-radius: 12px;
            overflow: hidden;
            border: 1px solid #1e293b;
        }
        zero-md::part(markdown-body) th { 
            background: #1e293b !important; 
            color: #f8fafc !important; 
            text-align: left;
            padding: 1rem !important;
        }
        zero-md::part(markdown-body) td {
            padding: 1rem !important;
            border-top: 1px solid #1e293b;
            color: #cbd5e1 !important;
        }
        zero-md::part(markdown-body) blockquote { 
            border-left: 4px solid #3b82f6; 
            background: rgba(59, 130, 246, 0.1) !important; 
            padding: 1.5rem !important; 
            border-radius: 8px; 
            color: #93c5fd !important;
            margin: 2rem 0;
        }
        zero-md::part(markdown-body) kbd {
            background: #334155;
            border: 1px solid #475569;
            border-radius: 4px;
            padding: 2px 6px;
            font-family: inherit;
            color: #f8fafc;
        }
    </style>
</head>
<body class="flex min-h-screen">
    <!-- Sidebar -->
    <div class="sidebar w-72 flex-shrink-0 p-8 hidden md:block overflow-y-auto h-screen sticky top-0">
        <div class="flex items-center gap-3 mb-10">
            <div class="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
                <svg class="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M13,10V3L4,16H11V23L20,10H13Z"/></svg>
            </div>
            <h1 class="font-extrabold text-xl tracking-tighter">KEST <span class="text-blue-500">DOCS</span></h1>
        </div>
        
        <nav class="space-y-1">
            <p class="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-4">Modules</p>
            <div id="file-list">
                <!-- Injected via JavaScript -->
            </div>
        </nav>
    </div>

    <!-- Main Content -->
    <main class="flex-1 p-6 md:p-12 max-w-5xl mx-auto">
        <div id="content-area" class="opacity-0 transition-opacity duration-500">
            <zero-md id="viewer" src=""></zero-md>
        </div>
    </main>

    <script>
        async function loadFiles() {
            const response = await fetch('/_list');
            const files = await response.json();
            const list = document.getElementById('file-list');
            
            files.filter(f => f.endsWith('.md')).forEach(file => {
                const name = file.replace('.md', '');
                const btn = document.createElement('button');
                btn.className = "w-full text-left px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800/50 transition-all flex items-center gap-3 mb-1";
                btn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>' +
                                '<span class="capitalize">' + name + '</span>';
                btn.onclick = () => showFile(file, btn);
                list.appendChild(btn);
            });

            if (files.length > 0) {
                const firstMD = files.find(f => f.endsWith('.md'));
                showFile(firstMD, list.firstChild);
            }
        }

        function showFile(file, btn) {
            document.querySelectorAll('#file-list button').forEach(b => b.classList.remove('bg-blue-600/10', 'text-blue-400', 'border-l-2', 'border-blue-500'));
            btn.classList.add('bg-blue-600/10', 'text-blue-400', 'border-l-2', 'border-blue-500');
            
            const viewer = document.getElementById('viewer');
            const area = document.getElementById('content-area');
            area.style.opacity = '0';
            setTimeout(() => {
                viewer.src = file;
                area.style.opacity = '1';
            }, 300);
        }

        loadFiles();
    </script>
</body>
</html>
`

	port := ":8081"
	fmt.Printf("🌐 Starting Kest Live Portal at http://localhost%s\n", port)
	fmt.Printf("📂 Serving documentation from %s\n", absDir)
	fmt.Println("🦅 Keep Every Step Visualized.")

	// API to list files
	http.HandleFunc("/_list", func(w http.ResponseWriter, r *http.Request) {
		infos, _ := os.ReadDir(absDir)
		var files []string
		for _, info := range infos {
			if !info.IsDir() {
				files = append(files, info.Name())
			}
		}
		json.NewEncoder(w).Encode(files)
	})

	// Serve the beautiful index.html for the root
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/" || r.URL.Path == "/index.html" {
			w.Header().Set("Content-Type", "text/html")
			fmt.Fprint(w, indexHTML)
			return
		}
		http.FileServer(http.Dir(absDir)).ServeHTTP(w, r)
	})

	return http.ListenAndServe(port, nil)
}

func runVerify(modules []*scanner.ModuleInfo, outputDir string) error {
	fmt.Printf("🛡️  Verifying documentation drift in: %s\n", outputDir)
	driftCount := 0

	for _, mod := range modules {
		docFile := filepath.Join(outputDir, mod.Name+".md")
		if _, err := os.Stat(docFile); os.IsNotExist(err) {
			fmt.Printf("⚠️  Drift Detected: Module %s has no documentation file!\n", mod.Name)
			driftCount++
			continue
		}

		content, err := os.ReadFile(docFile)
		if err != nil {
			fmt.Printf("❌ Error reading %s: %v\n", mod.Name, err)
			continue
		}

		// Simple verification: check if all paths/methods are present in the text
		missing := false
		for _, ep := range mod.Endpoints {
			searchStr := fmt.Sprintf("<kbd>%s</kbd> `%s`", ep.Method, ep.Path)
			if !strings.Contains(string(content), searchStr) {
				fmt.Printf("⚠️  Drift Detected: Endpoint %s %s is missing from %s.md\n", ep.Method, ep.Path, mod.Name)
				missing = true
			}
		}

		if missing {
			driftCount++
		} else {
			fmt.Printf("✅ Module %s: OK (Contracts matched)\n", mod.Name)
		}
	}

	if driftCount > 0 {
		return fmt.Errorf("\n❌ Drift Detection Failed: found %d discrepancies. Run 'kest doc' to resync", driftCount)
	}

	fmt.Println("\n✨ Documentation is up-to-date. No drift detected.")
	return nil
}

type AIResponse struct {
	Summary    string          `json:"summary"`
	Request    json.RawMessage `json:"request_example"`
	Response   json.RawMessage `json:"response_example"`
	Permission string          `json:"permission"`
	Flow       string          `json:"flow"`
}

func enhanceModuleWithAI(mod *scanner.ModuleInfo, projectName, lang string, conf *config.Config) {
	langName := "English"
	if lang == "zh" {
		langName = "Chinese"
	}
	client := ai.NewClient(conf.AIKey, conf.AIBaseURL, conf.AIModel)
	store, _ := storage.NewStore() // Open local database for Reality Seeding
	defer func() {
		if store != nil {
			store.Close()
		}
	}()

	// 1. Generate Module-level Purpose (The PM/Business view)
	modPurposePrompt := `You are a Product Manager and API Architect.
Analyze the following Go API module and write a concise "Module Purpose" section.
Include:
- Business value: What problem does this module solve?
- Role: Is it a core module or a support module?
Keep it under 3 paragraphs, professional and clear.
OUTPUT MUST BE IN %s.

Module Name: %s
Endpoints:`

	for _, ep := range mod.Endpoints {
		modPurposePrompt += fmt.Sprintf("\n- %s %s: %s", ep.Method, ep.Path, ep.Description)
	}

	purpose, err := client.Chat(fmt.Sprintf(modPurposePrompt, langName, mod.Name), "")
	if err == nil {
		mod.Description = purpose
	}

	// 2. Enhance endpoints
	systemPrompt := fmt.Sprintf(`You are a STRICT API Auditor and Documentation Engineer.
Your goal is to generate 100%% technically accurate documentation snippets based ONLY on the provided source code, schemas, and REAL WORLD EXAMPLES.

REALITY SEEDING RULE:
If a "REAL WORLD EXAMPLE (GOLDEN TRUTH)" is provided, prioritize its structure and values for your "request_example" and "response_example". This is data that actually happened in production/testing.

SECURITY AUTO-AUDIT RULE:
Analyze the "Middlewares" and "Handler Code". If a sensitive operation (Create/Update/Delete) lacks proper authentication or authorization checks, start the "permission" description with "⚠️ SECURITY RISK:".

ANTI-HALLUCINATION RULES:
1. STRICT SCHEMA ADHERENCE: You MUST ONLY use field names provided in the "STRICT JSON SCHEMA" section. Do NOT invent, rename, or approximate keys.
2. NO GHOST WRAPPING: Do NOT wrap responses in keys like {"data":...}, {"message":...}, or {"items":...} UNLESS you see these keys explicitly defined in the provided DTO source or real world example.
3. ARRAY CONSISTENCY: If the ResponseType is a list/slice (starts with []), your "response_example" MUST be a JSON array [...].
4. REALISTIC VALUES: Use values from the Real World Example if available.
5. FLOW FIDELITY: The Mermaid diagram must accurately reflect the specific calls and logic in the provided Handler Code.
6. LANGUAGE: All descriptions (summary, permission) MUST be in %s.

Return strictly JSON:
{{
  "summary": "Business-centric outcome/purpose of this endpoint",
  "request_example": {{}},
  "response_example": {{}},
  "permission": "Clear description of access requirements (JWT/Roles)",
  "flow": "sequenceDiagram\n..."
}}`, langName)

	var wg sync.WaitGroup
	for i := range mod.Endpoints {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			ep := &mod.Endpoints[idx]

			// 💡 REALITY SEEDING: Search for real record
			var realRecord *storage.Record
			if store != nil {
				realRecord, _ = store.GetLatestSuccessfulRecord(ep.Method, ep.Path, projectName)
			}

			userPrompt := fmt.Sprintf("Module: %s\nEndpoint: %s %s\nMiddlewares: %v\nHandler Code:\n%s\n\n",
				mod.Name, ep.Method, ep.Path, ep.Middlewares, ep.Code)

			if realRecord != nil {
				userPrompt += "### REAL WORLD EXAMPLE (GOLDEN TRUTH - OBSERVED TRAFFIC):\n"
				userPrompt += fmt.Sprintf("- Request Body: %s\n", realRecord.RequestBody)
				userPrompt += fmt.Sprintf("- Response Body: %s\n\n", realRecord.ResponseBody)
			}

			if ep.RequestType != "" || ep.ResponseType != "" {
				userPrompt += "### STRICT JSON SCHEMAS FOR ALIGNMENT:\n"
				if ep.RequestType != "" {
					isSlice := strings.HasPrefix(ep.RequestType, "[]")
					userPrompt += fmt.Sprintf("- Request Type: %s (Is Slice: %v)\n", ep.RequestType, isSlice)
					if dto, ok := mod.DTOs[cleanTypeForAI(ep.RequestType)]; ok {
						userPrompt += "  Allowed Keys (STRICT):\n"
						for _, f := range dto.Fields {
							userPrompt += fmt.Sprintf("  * %s (%s) validation:%s\n", f.JSONName, f.Type, f.Validation)
						}
					}
				}
				if ep.ResponseType != "" {
					isSlice := strings.HasPrefix(ep.ResponseType, "[]")
					userPrompt += fmt.Sprintf("- Response Type: %s (Is Slice: %v)\n", ep.ResponseType, isSlice)
					if dto, ok := mod.DTOs[cleanTypeForAI(ep.ResponseType)]; ok {
						userPrompt += "  Allowed Keys (STRICT):\n"
						for _, f := range dto.Fields {
							userPrompt += fmt.Sprintf("  * %s (%s)\n", f.JSONName, f.Type)
						}
					}
				}
				userPrompt += "\n"
			}

			if len(mod.DTOs) > 0 {
				userPrompt += "### DTO SOURCE CODE (FACTUAL REFERENCE):\n"
				for _, dto := range mod.DTOs {
					userPrompt += fmt.Sprintf("Type %s:\n%s\n", dto.Name, dto.Code)
				}
			}

			resp, err := client.Chat(systemPrompt, userPrompt)
			if err != nil {
				fmt.Printf("    ⚠️ [%s] %s: Error from AI: %v\n", ep.Method, ep.Path, err)
				return
			}

			var aiResp AIResponse
			cleanJSON := cleanJSONResponse(resp)
			if err := json.Unmarshal([]byte(cleanJSON), &aiResp); err != nil {
				fmt.Printf("    ⚠️ [%s] %s: Error parsing AI JSON: %v.\n", ep.Method, ep.Path, err)
				return
			}

			ep.Description = aiResp.Summary
			ep.RequestExample = string(aiResp.Request)
			ep.ResponseExample = string(aiResp.Response)
			ep.PermissionDesc = aiResp.Permission
			ep.FlowDiagram = aiResp.Flow
			fmt.Printf("  ✅ [%s] %s\n", ep.Method, ep.Path)
		}(i)
	}
	wg.Wait()
}

func cleanJSONResponse(s string) string {
	s = strings.TrimSpace(s)
	if strings.HasPrefix(s, "```") {
		lines := strings.Split(s, "\n")
		if len(lines) >= 2 {
			s = strings.Join(lines[1:len(lines)-1], "\n")
		}
	}
	return strings.TrimSpace(s)
}

func generateModuleDoc(mod *scanner.ModuleInfo, outputDir string, lang string) error {
	filename := filepath.Join(outputDir, mod.Name+".md")
	f, err := os.Create(filename)
	if err != nil {
		return err
	}
	defer f.Close()

	isZh := lang == "zh"
	l := docLabels(isZh)

	fmt.Fprintf(f, "# %s %s\n\n", strings.Title(mod.Name), l.moduleAPI)
	fmt.Fprintf(f, "> 💡 %s\n", l.autoSync)
	fmt.Fprintf(f, "> 📅 %s: %s\n\n", l.generatedAt, time.Now().Format("2006-01-02 15:04:05"))

	// Module Purpose
	if mod.Description != "" {
		fmt.Fprintf(f, "## 🎯 %s\n\n%s\n\n", l.modulePurpose, mod.Description)
	}

	// Overview table
	fmt.Fprintf(f, "## 📌 %s\n\n", l.overview)
	fmt.Fprintf(f, "%s `%s` %s:\n\n", l.theModule, mod.Name, l.providesEndpoints)
	fmt.Fprintf(f, "| %s | %s | %s | %s |\n", l.method, l.path, l.description, l.auth)
	fmt.Fprintf(f, "| :--- | :--- | :--- | :--- |\n")
	for _, ep := range mod.Endpoints {
		authLabel := "🔓 " + l.public
		if hasAuthMiddleware(ep.Middlewares) {
			authLabel = "🔒 " + l.authRequired
		}
		desc := ep.Description
		if desc == "" {
			desc = autoDescription(ep.Handler, ep.Method, mod.Name, isZh)
		}
		fmt.Fprintf(f, "| <kbd>%s</kbd> | `%s` | %s | %s |\n", ep.Method, ep.Path, desc, authLabel)
	}
	fmt.Fprintf(f, "\n---\n\n")

	// Endpoint details
	for _, ep := range mod.Endpoints {
		desc := ep.Description
		if desc == "" {
			desc = autoDescription(ep.Handler, ep.Method, mod.Name, isZh)
		}
		fmt.Fprintf(f, "## %s\n\n", desc)

		fmt.Fprintf(f, "**%s:**\n", l.endpoint)
		fmt.Fprintf(f, "<kbd>%s</kbd> `%s`\n\n", ep.Method, ep.Path)

		// Middlewares / Roles
		if len(ep.Middlewares) > 0 {
			fmt.Fprintf(f, "**%s:** `%s`\n\n", l.middlewares, strings.Join(ep.Middlewares, "`, `"))
		}

		// Permissions
		if ep.PermissionDesc != "" {
			fmt.Fprintf(f, "### 🛡️ %s\n\n%s\n\n", l.permissions, ep.PermissionDesc)
		} else {
			isMutation := ep.Method == "POST" || ep.Method == "PUT" || ep.Method == "PATCH" || ep.Method == "DELETE"
			hasAuth := hasAuthMiddleware(ep.Middlewares)
			if isMutation && !hasAuth {
				fmt.Fprintf(f, "### 🛡️ %s\n\n> ⚠️ **%s**: %s\n\n", l.permissions, l.securityAlert, l.unprotectedWarning)
			}
		}

		// Flow diagram (AI only)
		if ep.FlowDiagram != "" {
			fmt.Fprintf(f, "### 🗺️ %s\n\n```mermaid\n%s\n```\n\n", l.logicFlow, ep.FlowDiagram)
		}

		// Path parameters
		pathParams := extractPathParams(ep.Path)
		if len(pathParams) > 0 {
			fmt.Fprintf(f, "### 🔗 %s\n\n", l.pathParams)
			fmt.Fprintf(f, "| %s | %s | %s |\n", l.paramName, l.fieldType, l.fieldDesc)
			fmt.Fprintf(f, "| :--- | :--- | :--- |\n")
			for _, p := range pathParams {
				paramDesc := autoParamDesc(p, isZh)
				fmt.Fprintf(f, "| `%s` | `integer` | %s |\n", p, paramDesc)
			}
			fmt.Fprintf(f, "\n")
		}

		// Request Schema — try explicit type first, then auto-match from DTOs
		reqDTO := findRequestDTOForEndpoint(ep, mod.DTOs)
		if reqDTO != nil && len(reqDTO.Fields) > 0 {
			typeName := ep.RequestType
			if typeName == "" {
				typeName = reqDTO.Name
			}
			fmt.Fprintf(f, "### 📥 %s: `%s`\n\n", l.request, typeName)
			fmt.Fprintf(f, "| %s | %s | %s | %s |\n", l.jsonField, l.fieldType, l.validation, l.fieldDesc)
			fmt.Fprintf(f, "| :--- | :--- | :--- | :--- |\n")
			for _, field := range reqDTO.Fields {
				validDesc := field.Validation
				if validDesc == "" {
					validDesc = "-"
				}
				comment := field.Comment
				if comment == "" {
					comment = autoFieldDesc(field.JSONName, field.Type, isZh)
				}
				fmt.Fprintf(f, "| `%s` | `%s` | `%s` | %s |\n", field.JSONName, field.Type, validDesc, comment)
			}
			fmt.Fprintf(f, "\n")

			// Auto-generate JSON example
			if ep.RequestExample == "" {
				example := generateJSONExampleFromDTO(reqDTO)
				fmt.Fprintf(f, "**%s:**\n", l.requestExample)
				fmt.Fprintf(f, "```json\n%s\n```\n\n", example)
			}
		}

		if ep.RequestExample != "" {
			fmt.Fprintf(f, "**%s:**\n", l.requestExample)
			fmt.Fprintf(f, "```json\n%s\n```\n\n", ep.RequestExample)
		}

		// Response Schema
		respDTO := findResponseDTOForEndpoint(ep, mod.DTOs)
		if respDTO != nil && len(respDTO.Fields) > 0 {
			typeName := ep.ResponseType
			if typeName == "" {
				typeName = respDTO.Name
			}
			fmt.Fprintf(f, "### 📤 %s: `%s`\n\n", l.response, typeName)
			fmt.Fprintf(f, "| %s | %s | %s |\n", l.jsonField, l.fieldType, l.fieldDesc)
			fmt.Fprintf(f, "| :--- | :--- | :--- |\n")
			for _, field := range respDTO.Fields {
				comment := field.Comment
				if comment == "" {
					comment = autoFieldDesc(field.JSONName, field.Type, isZh)
				}
				fmt.Fprintf(f, "| `%s` | `%s` | %s |\n", field.JSONName, field.Type, comment)
			}
			fmt.Fprintf(f, "\n")

			if ep.ResponseExample == "" {
				example := generateJSONExampleFromDTO(respDTO)
				fmt.Fprintf(f, "**%s:**\n", l.responseExample)
				fmt.Fprintf(f, "```json\n%s\n```\n\n", example)
			}
		}

		if ep.ResponseExample != "" {
			fmt.Fprintf(f, "**%s:**\n", l.responseExample)
			fmt.Fprintf(f, "```json\n%s\n```\n\n", ep.ResponseExample)
		}

		// Error Responses
		if len(ep.Errors) > 0 {
			fmt.Fprintf(f, "### ❌ %s\n\n", l.errorResponses)
			fmt.Fprintf(f, "| %s | %s |\n", l.statusCode, l.description)
			fmt.Fprintf(f, "| :--- | :--- |\n")
			for _, err := range ep.Errors {
				statusText := getStatusText(err.Code, isZh)
				fmt.Fprintf(f, "| `%d` | %s |\n", err.Code, statusText)
			}
			fmt.Fprintf(f, "\n")
		}

		fmt.Fprintf(f, "**%s:** `%s`\n\n", l.handlerImpl, ep.Handler)
		fmt.Fprintf(f, "---\n\n")
	}

	// DTO Reference section
	if len(mod.DTOs) > 0 {
		fmt.Fprintf(f, "## 📋 %s\n\n", l.dtoReference)
		// Sort DTO names for deterministic output
		var dtoNames []string
		for name := range mod.DTOs {
			dtoNames = append(dtoNames, name)
		}
		sort.Strings(dtoNames)

		for _, name := range dtoNames {
			dto := mod.DTOs[name]
			if len(dto.Fields) == 0 {
				continue
			}
			fmt.Fprintf(f, "### `%s`\n\n", name)
			fmt.Fprintf(f, "| %s | %s | %s | %s |\n", l.jsonField, l.fieldType, l.validation, l.fieldDesc)
			fmt.Fprintf(f, "| :--- | :--- | :--- | :--- |\n")
			for _, field := range dto.Fields {
				validDesc := field.Validation
				if validDesc == "" {
					validDesc = "-"
				}
				comment := field.Comment
				if comment == "" {
					comment = autoFieldDesc(field.JSONName, field.Type, isZh)
				}
				fmt.Fprintf(f, "| `%s` | `%s` | `%s` | %s |\n", field.JSONName, field.Type, validDesc, comment)
			}
			fmt.Fprintf(f, "\n")
		}
	}

	fmt.Printf("  ✅ %s\n", mod.Name)
	return nil
}

// --- Auto-matching and enrichment helpers ---

// extractPathParams extracts :param names from a route path
func extractPathParams(path string) []string {
	var params []string
	for _, part := range strings.Split(path, "/") {
		if strings.HasPrefix(part, ":") {
			params = append(params, strings.TrimPrefix(part, ":"))
		}
	}
	return params
}

// autoParamDesc generates a description for a path parameter
func autoParamDesc(param string, isZh bool) string {
	switch param {
	case "id":
		return "Resource ID"
	case "project_id":
		return "Project ID"
	case "organization_id":
		return "Organization ID"
	case "fingerprint":
		return "Issue fingerprint"
	case "payment_no":
		return "Payment number"
	default:
		return "Resource identifier"
	}
}

// autoDescription generates a human-readable description from handler name
func autoDescription(handler, method, moduleName string, isZh bool) string {
	name := handler
	if strings.Contains(name, ".") {
		parts := strings.Split(name, ".")
		name = parts[len(parts)-1]
	}

	return autoDescEn(name, method, moduleName)
}

func autoDescEn(action, method, mod string) string {
	switch action {
	case "Create", "Store":
		return "Create " + mod
	case "List", "Index":
		return "List " + mod + "s"
	case "Get", "Show":
		return "Get " + mod + " details"
	case "Update":
		return "Update " + mod
	case "Delete", "Destroy":
		return "Delete " + mod
	default:
		return camelToWords(action)
	}
}

func camelToWords(s string) string {
	var result strings.Builder
	for i, r := range s {
		if i > 0 && r >= 'A' && r <= 'Z' {
			result.WriteRune(' ')
		}
		result.WriteRune(r)
	}
	return result.String()
}

// findRequestDTOForEndpoint tries to find a matching request DTO for an endpoint
func findRequestDTOForEndpoint(ep scanner.APIEndpoint, dtos map[string]*scanner.DTOInfo) *scanner.DTOInfo {
	if ep.Method != "POST" && ep.Method != "PUT" && ep.Method != "PATCH" {
		return nil
	}

	// 1. Explicit type from scanner
	if ep.RequestType != "" {
		clean := cleanTypeForAI(ep.RequestType)
		if dto, ok := dtos[clean]; ok {
			return dto
		}
	}

	// 2. Auto-match by handler name convention
	handler := ep.Handler
	if strings.Contains(handler, ".") {
		parts := strings.Split(handler, ".")
		handler = parts[len(parts)-1]
	}

	// Try common patterns
	patterns := []string{
		handler + "Request",
		strings.Title(handler) + "Request",
	}

	for _, p := range patterns {
		if dto, ok := dtos[p]; ok {
			return dto
		}
	}

	// Try module-prefixed patterns (e.g., UserRegisterRequest for Register handler)
	for name, dto := range dtos {
		nameLower := strings.ToLower(name)
		if strings.Contains(nameLower, "request") && strings.Contains(nameLower, strings.ToLower(handler)) {
			return dto
		}
	}

	return nil
}

// findResponseDTOForEndpoint tries to find a matching response DTO for an endpoint
func findResponseDTOForEndpoint(ep scanner.APIEndpoint, dtos map[string]*scanner.DTOInfo) *scanner.DTOInfo {
	// 1. Explicit type from scanner
	if ep.ResponseType != "" {
		clean := cleanTypeForAI(ep.ResponseType)
		if dto, ok := dtos[clean]; ok {
			return dto
		}
	}

	// 2. Auto-match by handler name convention
	handler := ep.Handler
	if strings.Contains(handler, ".") {
		parts := strings.Split(handler, ".")
		handler = parts[len(parts)-1]
	}

	for name, dto := range dtos {
		nameLower := strings.ToLower(name)
		if strings.Contains(nameLower, "response") && strings.Contains(nameLower, strings.ToLower(handler)) {
			return dto
		}
	}

	return nil
}

// generateJSONExampleFromDTO creates a JSON example from DTO fields
func generateJSONExampleFromDTO(dto *scanner.DTOInfo) string {
	example := make(map[string]interface{})
	for _, field := range dto.Fields {
		if field.JSONName == "" || field.JSONName == "-" {
			continue
		}
		example[field.JSONName] = exampleValueForField(field)
	}
	data, _ := json.MarshalIndent(example, "", "  ")
	return string(data)
}

func exampleValueForField(field scanner.DTOField) interface{} {
	nameLower := strings.ToLower(field.JSONName)
	switch field.Type {
	case "string":
		switch {
		case strings.Contains(nameLower, "email"):
			return "user@example.com"
		case strings.Contains(nameLower, "password"):
			return "********"
		case strings.Contains(nameLower, "phone"):
			return "13800138000"
		case strings.Contains(nameLower, "name") || strings.Contains(nameLower, "nickname"):
			return "John Doe"
		case strings.Contains(nameLower, "url") || strings.Contains(nameLower, "avatar") || strings.Contains(nameLower, "qr"):
			return "https://example.com/image.jpg"
		case strings.Contains(nameLower, "bio"):
			return "A short bio"
		case strings.Contains(nameLower, "reason"):
			return "Reason description"
		case strings.Contains(nameLower, "token"):
			return "eyJhbGciOiJIUzI1NiIs..."
		case strings.Contains(nameLower, "account"):
			return "account_name"
		case strings.Contains(nameLower, "campus"):
			return "Campus name"
		default:
			return "string"
		}
	case "int", "int64", "uint", "uint64", "int32":
		return 1
	case "float64", "float32":
		return 99.9
	case "bool":
		return true
	case "*bool":
		return true
	case "[]string":
		return []string{"item1", "item2"}
	case "[]int":
		return []int{1, 2, 3}
	default:
		if strings.HasPrefix(field.Type, "[]") {
			return []interface{}{}
		}
		if strings.HasPrefix(field.Type, "*") {
			return nil
		}
		return "object"
	}
}

// autoFieldDesc generates a description for a field based on its name
func autoFieldDesc(jsonName, fieldType string, isZh bool) string {
	nameLower := strings.ToLower(jsonName)
	switch {
	case nameLower == "username":
		return "Username"
	case nameLower == "password":
		return "Password"
	case nameLower == "old_password":
		return "Old password"
	case nameLower == "new_password":
		return "New password"
	case nameLower == "email":
		return "Email address"
	case nameLower == "phone":
		return "Phone number"
	case nameLower == "nickname":
		return "Nickname"
	case nameLower == "avatar":
		return "Avatar URL"
	case nameLower == "bio":
		return "Bio"
	case nameLower == "access_token":
		return "Access token"
	case nameLower == "is_accepting":
		return "Accepting status"
	case nameLower == "subjects":
		return "Subject list"
	case nameLower == "grade_levels":
		return "Grade levels"
	case nameLower == "course_types":
		return "Course types"
	case nameLower == "approval_status":
		return "Approval status"
	case nameLower == "reject_reason":
		return "Rejection reason"
	case nameLower == "wechat_qr_url":
		return "WeChat QR code URL"
	case nameLower == "ext_campus_name":
		return "Campus name"
	case nameLower == "ext_campus_account":
		return "Campus account"
	case strings.Contains(nameLower, "name"):
		return "Name"
	case strings.Contains(nameLower, "id"):
		return "ID"
	case strings.Contains(nameLower, "status"):
		return "Status"
	case strings.Contains(nameLower, "time") || strings.Contains(nameLower, "date") || strings.Contains(nameLower, "at"):
		return "Timestamp"
	case strings.Contains(nameLower, "count") || strings.Contains(nameLower, "total"):
		return "Count/Total"
	case strings.Contains(nameLower, "amount") || strings.Contains(nameLower, "price") || strings.Contains(nameLower, "fee"):
		return "Amount"
	default:
		return "-"
	}
}

// docLabelSet holds all localized labels for doc generation
type docLabelSet struct {
	moduleAPI          string
	autoSync           string
	generatedAt        string
	modulePurpose      string
	overview           string
	theModule          string
	providesEndpoints  string
	method             string
	path               string
	description        string
	auth               string
	public             string
	authRequired       string
	endpoint           string
	middlewares        string
	permissions        string
	securityAlert      string
	unprotectedWarning string
	logicFlow          string
	request            string
	response           string
	jsonField          string
	fieldType          string
	validation         string
	fieldDesc          string
	requestExample     string
	responseExample    string
	errorResponses     string
	statusCode         string
	handlerImpl        string
	pathParams         string
	paramName          string
	dtoReference       string
}

func docLabels(isZh bool) docLabelSet {
	// Always return English labels regardless of isZh flag
	return docLabelSet{
		moduleAPI:          "Module API",
		autoSync:           "This documentation is automatically synchronized with the source code.",
		generatedAt:        "Generated at",
		modulePurpose:      "Module Purpose",
		overview:           "Overview",
		theModule:          "The",
		providesEndpoints:  "module provides the following API endpoints",
		method:             "Method",
		path:               "Path",
		description:        "Description",
		auth:               "Auth",
		public:             "Public",
		authRequired:       "Required",
		endpoint:           "Endpoint",
		middlewares:        "Middlewares",
		permissions:        "Permissions",
		securityAlert:      "SECURITY ALERT",
		unprotectedWarning: "This mutation endpoint appears to be UNPROTECTED (no auth middleware detected).",
		logicFlow:          "Logic Flow",
		request:            "Request",
		response:           "Response",
		jsonField:          "JSON Field",
		fieldType:          "Type",
		validation:         "Required/Validation",
		fieldDesc:          "Description",
		requestExample:     "Request Example",
		responseExample:    "Response Example",
		errorResponses:     "Error Responses",
		statusCode:         "Status Code",
		handlerImpl:        "Handler Implementation",
		pathParams:         "Path Parameters",
		paramName:          "Parameter",
		dtoReference:       "Data Structures Reference",
	}
}

func hasAuthMiddleware(middlewares []string) bool {
	for _, m := range middlewares {
		if strings.Contains(strings.ToLower(m), "auth") {
			return true
		}
	}
	return false
}

func getStatusText(code int, isZh bool) string {
	switch code {
	case 400:
		return "Bad Request: The request was invalid or could not be understood."
	case 401:
		return "Unauthorized: Authentication is required or has failed."
	case 403:
		return "Forbidden: The client does not have access rights to the content."
	case 404:
		return "Not Found: The server could not find the requested resource."
	case 500:
		return "Internal Server Error: The server encountered an unexpected condition."
	default:
		return "Error response generated by the server."
	}
}

func cleanTypeForAI(t string) string {
	t = strings.TrimPrefix(t, "[]")
	t = strings.TrimPrefix(t, "*")
	t = strings.TrimPrefix(t, "*")
	return t
}

// --- Deduplication: source file hashing ---

// docState tracks module hashes for deduplication
type docState struct {
	GeneratedAt string            `json:"generated_at"`
	Modules     map[string]string `json:"modules"`
}

func loadDocState(filename string) map[string]string {
	data, err := os.ReadFile(filename)
	if err != nil {
		return make(map[string]string)
	}
	var state docState
	if err := json.Unmarshal(data, &state); err != nil {
		return make(map[string]string)
	}
	if state.Modules == nil {
		return make(map[string]string)
	}
	return state.Modules
}

func saveDocState(filename string, modules map[string]string) {
	state := docState{
		GeneratedAt: time.Now().Format("2006-01-02 15:04:05"),
		Modules:     modules,
	}
	data, err := json.MarshalIndent(state, "", "  ")
	if err != nil {
		return
	}
	os.WriteFile(filename, data, 0644)
}

// hashModuleDir computes a SHA-256 hash of all .go files in a module directory.
// This is used to detect whether source files have changed since the last doc generation.
func hashModuleDir(dir string) string {
	h := sha256.New()

	entries, err := os.ReadDir(dir)
	if err != nil {
		return ""
	}

	// Sort entries for deterministic hashing
	var names []string
	for _, e := range entries {
		if !e.IsDir() && strings.HasSuffix(e.Name(), ".go") {
			names = append(names, e.Name())
		}
	}
	sort.Strings(names)

	for _, name := range names {
		f, err := os.Open(filepath.Join(dir, name))
		if err != nil {
			continue
		}
		io.WriteString(h, name+"\n")
		io.Copy(h, f)
		f.Close()
	}

	return hex.EncodeToString(h.Sum(nil))
}
