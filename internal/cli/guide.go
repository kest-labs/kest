package cli

import (
	"fmt"

	"github.com/spf13/cobra"
)

var guideCmd = &cobra.Command{
	Use:   "guide",
	Short: "Show Kest Flow (.flow.md) tutorial and best practices",
	Long:  `Learn how to use Kest Flow to document and test your APIs simultaneously using Markdown.`,
	Run: func(cmd *cobra.Command, args []string) {
		fmt.Print(guideText)
	},
}

var docGuideCmd = &cobra.Command{
	Use:   "doc",
	Short: "Show API documentation generation guide",
	Long:  `Learn how to use Kest doc to generate and align API documentation from source code.`,
	Run: func(cmd *cobra.Command, args []string) {
		fmt.Print(docGuideText)
	},
}

func init() {
	rootCmd.AddCommand(guideCmd)
	guideCmd.AddCommand(docGuideCmd)
}

const guideText = `
# Kest Flow (.flow.md) 🌊

Kest Flow is the core feature that enables "Document-as-Code" testing.
A .flow.md file is a standard Markdown document containing Kest code blocks.

## 📝 How to write a Flow

Create a file named "login.flow.md" and use code blocks like this:

` + "```" + `flow
@flow id=login-flow
@name Login Flow
` + "```" + `

` + "```" + `step
@id login
@name Login

POST /api/v1/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "password123"
}

[Captures]
token = data.access_token

[Asserts]
status == 200
duration < 500
` + "```" + `

## 🔗 Chaining Requests

Use captured variables with the {{variable_name}} syntax:

` + "```" + `step
@id profile
@name Get Profile

GET /api/v1/profile
Authorization: Bearer {{token}}

[Asserts]
status == 200
` + "```" + `

## 🔧 Exec Steps (Dynamic Variables)

Use @type exec to run shell commands and capture output:

` + "```" + `step
@id gen-sig
@name Generate HMAC
@type exec

echo -n "{{timestamp}}:{{api_key}}" | openssl dgst -sha256 -hmac "{{api_key}}" | awk '{print $NF}'

[Captures]
signature = $line.0
` + "```" + `

Capture modes: $stdout (all output), $line.N (Nth line), or a gjson path for JSON output.

## 🚀 Running & Watching

  $ kest run login.flow.md
  $ kest run login.flow.md --var api_key=secret
  $ kest run login.flow.md --exec-timeout 10 -v
  $ kest watch login.flow.md          # Auto-rerun on file change

## 🧠 AI-Powered Commands

  $ kest why                           # Diagnose last failed request
  $ kest suggest                       # AI suggests next command
  $ kest explain last                  # AI explains a recorded request
  $ kest review login.flow.md          # AI audits flow for security/coverage
  $ kest gen "test user registration"  # AI generates a flow file

## � History & Comparison

  $ kest diff 100 105                  # Compare two records
  $ kest snap /api/users               # Save response snapshot
  $ kest snap /api/users --verify      # Verify against snapshot
  $ kest chain login.flow.md           # Visualize variable flow
  $ kest mock --port 8787              # Mock server from history

## �💡 Tips

- Use "step" blocks for all new flows (recommended over legacy "kest" blocks).
- Non-code content (text, images) is ignored by Kest, perfect for documentation.
- Use "kest history" to see the results of previous runs.
- Use "--debug-vars" to see how variables are resolved.
- Exec steps default to 30s timeout. Override with --exec-timeout.
- Use "--quiet --output json" for CI/CD pipelines.
- Exit codes: 0=success, 1=assertion fail, 2=runtime error.

Keep Every Step Tested. 🦅
`

const docGuideText = `
# API Documentation Generation 📄

Kest CLI can scan your Go source code and generate high-quality API documentation automatically.

## 🚀 Basic Commands

### 📂 Scan a project
$ kest doc ./path/to/api -o ./docs

### 🧠 With AI Enhancement
Generates realistic examples, Mermaid diagrams, and permission summaries.
$ kest doc ./path/to/api -o ./docs --ai

### 🎯 Selective Scanning
Focus on a specific module to save time.
$ kest doc ./path/to/api -o ./docs -m module_name --ai

## 🌟 Superpowers (v0.6.1)

1. **Reality Seeding**: Use --ai to inject actual successful request/response data from your local Kest history into the documentation.
2. **Drift Detection**: Run with --verify in CI/CD to detect discrepancies between code and existing documentation.
3. **Interactive Portal**: Run with --serve to launch a beautiful local web portal to preview and test your APIs.
4. **Recursive Logic**: Scans Handler -> Service -> Repository to generate high-fidelity logic flow diagrams.

## 🧠 Anti-Hallucination

Kest ensures documentation perfectly matches your code:
- **No Ghost Wrapping**: Top-level arrays are not unnecessarily wrapped in objects.
- **Strict Key Adherence**: JSON keys match your source code tags exactly.
- **Deep Flow Analysis**: Sequence diagrams reflect implementation across layers.

鹰击长空，Keep Every Step Aligned. 🦅
`
