package main

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/kest-labs/kest/cli/internal/config"
	"github.com/kest-labs/kest/cli/internal/importer"
	"github.com/spf13/cobra"
)

var (
	importOutDir      string
	importForce       bool
	importWriteConfig bool
	importEnvName     string
	importPostmanEnv  string
	importCurlName    string
	importCurlAppend  bool
	importCurlAbs     bool
)

var importCmd = &cobra.Command{
	Use:   "import",
	Short: "Import Postman collections, curl commands or OpenAPI specs as .flow.md files",
	Long: `Convert existing API definitions into Kest Markdown flows (.flow.md).

Sources:
  postman   Postman Collection v2.0/v2.1 (+ optional environment export)
  curl      a curl command line (argument or stdin)
  openapi   an OpenAPI 3.x / Swagger 2.0 spec (file or URL), one smoke flow per tag

Secrets are never copied: credentials become {{variables}} you pass with --var.
Anything that cannot be translated safely is kept as a "Manual review" note in
the generated Markdown and listed in the final warning summary.`,
}

var importPostmanCmd = &cobra.Command{
	Use:   "postman <collection.json>",
	Short: "Import a Postman Collection (v2.0/v2.1)",
	Example: `  kest import postman acme.postman_collection.json
  kest import postman acme.json --env staging.postman_environment.json -o .kest/flow/acme
  kest import postman acme.json --env staging.json --write-config`,
	Args: cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		data, err := os.ReadFile(args[0])
		if err != nil {
			return err
		}
		opts := importer.PostmanOptions{EnvName: importEnvName}
		if importPostmanEnv != "" {
			envData, err := os.ReadFile(importPostmanEnv)
			if err != nil {
				return err
			}
			opts.Environment = envData
		}
		res, err := importer.ImportPostman(data, opts)
		if err != nil {
			return err
		}
		return finishImport(cmd.OutOrStdout(), cmd.ErrOrStderr(), res)
	},
}

var importOpenAPICmd = &cobra.Command{
	Use:   "openapi <spec.yaml|spec.json|url>",
	Short: "Generate smoke flows (one per tag) from an OpenAPI spec",
	Example: `  kest import openapi openapi.yaml
  kest import openapi https://petstore3.swagger.io/api/v3/openapi.json -o .kest/flow/petstore`,
	Args: cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		res, err := importer.ImportOpenAPI(args[0], importer.OpenAPIOptions{EnvName: importEnvName})
		if err != nil {
			return err
		}
		return finishImport(cmd.OutOrStdout(), cmd.ErrOrStderr(), res)
	},
}

var importCurlCmd = &cobra.Command{
	Use:   "curl [\"curl ...\"]",
	Short: "Convert a curl command into a flow step",
	Long: `Convert a curl command into a Kest flow step.

The command can be passed as a single argument, as several arguments, or on
stdin (use "-" or no argument). Without -o the step block is printed to stdout.`,
	Example: `  kest import curl "curl -X POST https://api.example.com/users -H 'Content-Type: application/json' -d '{\"name\":\"kest\"}'"
  pbpaste | kest import curl
  kest import curl -o smoke.flow.md --append "curl https://api.example.com/health"`,
	RunE: func(cmd *cobra.Command, args []string) error {
		var input string
		if len(args) == 0 || (len(args) == 1 && args[0] == "-") {
			data, err := io.ReadAll(cmd.InOrStdin())
			if err != nil {
				return err
			}
			input = string(data)
		} else if len(args) == 1 {
			input = args[0]
		} else {
			input = importer.ShellJoin(args)
		}
		res, err := importer.ImportCurl(input, importer.CurlOptions{Name: importCurlName, Absolute: importCurlAbs})
		if err != nil {
			return err
		}
		return finishCurlImport(cmd.OutOrStdout(), cmd.ErrOrStderr(), res)
	},
}

func init() {
	for _, c := range []*cobra.Command{importPostmanCmd, importOpenAPICmd} {
		c.Flags().StringVarP(&importOutDir, "out", "o", "", "Output directory (default: .kest/flow when a .kest workspace exists, else the current directory)")
		c.Flags().BoolVar(&importForce, "force", false, "Overwrite existing .flow.md files")
		c.Flags().BoolVar(&importWriteConfig, "write-config", false, "Merge base_url and non-secret variables into the workspace .kest/config.yaml")
		c.Flags().StringVar(&importEnvName, "env-name", "", "Kest environment name for the generated config")
	}
	importPostmanCmd.Flags().StringVar(&importPostmanEnv, "env", "", "Postman environment export (.json)")

	importCurlCmd.Flags().StringVarP(&importOutDir, "out", "o", "", "Write a .flow.md file instead of printing the step")
	importCurlCmd.Flags().BoolVar(&importCurlAppend, "append", false, "Append the step to an existing --out file")
	importCurlCmd.Flags().BoolVar(&importForce, "force", false, "Overwrite an existing --out file")
	importCurlCmd.Flags().StringVar(&importCurlName, "name", "", "Step name (default: METHOD /path)")
	importCurlCmd.Flags().BoolVar(&importCurlAbs, "absolute", false, "Keep the absolute URL instead of a path relative to base_url")

	// Let `kest import curl curl -X POST ...` pass curl flags through untouched.
	importCurlCmd.Flags().SetInterspersed(false)

	importCmd.AddCommand(importPostmanCmd, importOpenAPICmd, importCurlCmd)
	rootCmd.AddCommand(importCmd)
}

func defaultImportDir() string {
	if info, err := os.Stat(".kest"); err == nil && info.IsDir() {
		return filepath.Join(".kest", "flow")
	}
	return "."
}

// finishImport writes the generated files and prints the summary.
func finishImport(stdout, stderr io.Writer, res *importer.Result) error {
	dir := importOutDir
	if dir == "" {
		dir = defaultImportDir()
	}
	written, err := writeImportFiles(dir, res.Files, importForce)
	if err != nil {
		return err
	}

	fmt.Fprintf(stdout, "Imported %d request(s) from %s %q into %d flow file(s):\n", res.RequestCount(), res.SourceKind, res.SourceName, len(written))
	for i, path := range written {
		fmt.Fprintf(stdout, "  %s (%d steps)\n", path, res.Files[i].StepCount())
	}

	if importWriteConfig {
		path, err := mergeImportEnv(res.Env)
		if err != nil {
			return fmt.Errorf("files were written, but updating the workspace config failed: %w", err)
		}
		fmt.Fprintf(stdout, "\nUpdated environment %q in %s (switch with: kest env use %s)\n", res.Env.Name, path, res.Env.Name)
		printSecretsHint(stdout, res.Env)
	} else {
		fmt.Fprintf(stdout, "\nAdd this environment to .kest/config.yaml (or re-run with --write-config):\n\n")
		fmt.Fprint(stdout, importer.RenderEnvSnippet(res.Env))
		printSecretsHint(stdout, res.Env)
	}

	printImportWarnings(stderr, res.Warnings)
	fmt.Fprintf(stdout, "\nNext: kest run %s\n", dir)
	return nil
}

func finishCurlImport(stdout, stderr io.Writer, res *importer.Result) error {
	if importOutDir == "" {
		step := res.Files[0].Sections[0].Steps[0]
		fmt.Fprint(stdout, importer.RenderStep(step))
		if res.Env.BaseURL != "" {
			fmt.Fprintf(stderr, "\nbase_url: %s  (set it in .kest/config.yaml or run with --base-url)\n", res.Env.BaseURL)
		}
		printSecretsHint(stderr, res.Env)
		printImportWarnings(stderr, res.Warnings)
		return nil
	}

	path := importOutDir
	if !strings.HasSuffix(path, ".md") {
		return fmt.Errorf("--out for curl must be a .flow.md file, got %q", path)
	}
	existing, err := os.ReadFile(path)
	switch {
	case err == nil && importCurlAppend:
		step := res.Files[0].Sections[0].Steps[0]
		step.ID = importer.UniqueStepID(string(existing), step.ID)
		content := strings.TrimRight(string(existing), "\n") + "\n\n### " + step.Name + "\n\n" + importer.RenderStep(step)
		if err := os.WriteFile(path, []byte(content), 0644); err != nil {
			return err
		}
		fmt.Fprintf(stdout, "Appended step %q to %s\n", step.ID, path)
	case err == nil && !importForce:
		return fmt.Errorf("%s already exists (use --append or --force)", path)
	case err != nil && !os.IsNotExist(err):
		return err
	default:
		if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
			return err
		}
		if err := os.WriteFile(path, []byte(importer.Render(res.Files[0])), 0644); err != nil {
			return err
		}
		fmt.Fprintf(stdout, "Wrote %s\n", path)
	}
	if res.Env.BaseURL != "" {
		fmt.Fprintf(stdout, "base_url: %s  (set it in .kest/config.yaml or run with --base-url)\n", res.Env.BaseURL)
	}
	printSecretsHint(stdout, res.Env)
	printImportWarnings(stderr, res.Warnings)
	return nil
}

func writeImportFiles(dir string, files []importer.FlowFile, force bool) ([]string, error) {
	var paths []string
	for _, f := range files {
		path := filepath.Join(dir, f.FileName)
		if _, err := os.Stat(path); err == nil && !force {
			return nil, fmt.Errorf("%s already exists (use --force to overwrite or -o to pick another directory)", path)
		}
		paths = append(paths, path)
	}
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, err
	}
	for i, f := range files {
		if err := os.WriteFile(paths[i], []byte(importer.Render(f)), 0644); err != nil {
			return nil, err
		}
	}
	return paths, nil
}

// mergeImportEnv adds base_url and non-secret variables to the workspace
// config without overwriting values that already exist.
func mergeImportEnv(env importer.Env) (string, error) {
	configPath, err := config.ResolveConfigPath()
	if err != nil {
		return "", err
	}
	if home, herr := os.UserHomeDir(); herr == nil && configPath == filepath.Join(home, ".kest", "config.yaml") {
		return "", fmt.Errorf("no .kest workspace found; run `kest init` first")
	}
	conf, err := config.LoadConfig()
	if err != nil {
		return "", err
	}
	if conf.Environments == nil {
		conf.Environments = map[string]config.Environment{}
	}
	name := env.Name
	if name == "" {
		name = "imported"
	}
	target := conf.Environments[name]
	if target.BaseURL == "" {
		target.BaseURL = env.BaseURL
	}
	if target.Variables == nil {
		target.Variables = map[string]string{}
	}
	for k, v := range env.Variables {
		if _, exists := target.Variables[k]; !exists {
			target.Variables[k] = v
		}
	}
	conf.Environments[name] = target
	if conf.ActiveEnv == "" {
		conf.ActiveEnv = name
	}
	if err := config.SaveToPath(conf, configPath); err != nil {
		return "", err
	}
	return configPath, nil
}

func printSecretsHint(w io.Writer, env importer.Env) {
	if len(env.Secrets) == 0 {
		return
	}
	var flags []string
	for _, s := range env.Secrets {
		flags = append(flags, "--var "+s+"=...")
	}
	fmt.Fprintf(w, "\nSecrets were not copied. Provide them at run time:\n  kest run <flow> %s\n", strings.Join(flags, " "))
}

func printImportWarnings(w io.Writer, warnings []importer.Warning) {
	if len(warnings) == 0 {
		return
	}
	sorted := append([]importer.Warning{}, warnings...)
	sort.SliceStable(sorted, func(i, j int) bool { return sorted[i].Location < sorted[j].Location })
	fmt.Fprintf(w, "\n⚠️  %d item(s) need manual review (details are kept as \"Manual review\" notes in the output):\n", len(sorted))
	for _, warn := range sorted {
		fmt.Fprintf(w, "  - %s\n", warn.String())
	}
}
