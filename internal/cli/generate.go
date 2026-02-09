package cli

import (
	"context"
	"fmt"
	"os"
	"sort"
	"strings"

	"github.com/getkin/kin-openapi/openapi3"
	"github.com/spf13/cobra"
)

var (
	genFromOpenAPI string
	genOutFile     string
)

var generateCmd = &cobra.Command{
	Use:   "generate",
	Short: "Generate a .kest scenario file from external sources",
	RunE: func(cmd *cobra.Command, args []string) error {
		if genFromOpenAPI != "" {
			return generateFromOpenAPI(genFromOpenAPI, genOutFile)
		}
		return fmt.Errorf("please specify a source file (e.g., -f swagger.json)")
	},
}

func init() {
	generateCmd.Flags().StringVarP(&genFromOpenAPI, "file", "f", "", "OpenAPI/Swagger spec file path")
	generateCmd.Flags().StringVarP(&genOutFile, "output", "o", "api.flow.md", "Output file path (.flow.md or .kest)")
	rootCmd.AddCommand(generateCmd)
}

func generateFromOpenAPI(specPath, outPath string) error {
	ctx := context.Background()
	loader := openapi3.NewLoader()
	doc, err := loader.LoadFromFile(specPath)
	if err != nil {
		return fmt.Errorf("failed to load OpenAPI spec: %v", err)
	}

	err = doc.Validate(ctx)
	if err != nil {
		fmt.Printf("Warning: OpenAPI spec validation failed: %v\n", err)
	}

	file, err := os.Create(outPath)
	if err != nil {
		return err
	}
	defer file.Close()

	fmt.Fprintf(file, "# Generated from %s\n", specPath)
	fmt.Fprintf(file, "# Project: %s\n\n", doc.Info.Title)

	// Sort paths for stable output
	paths := make([]string, 0, len(doc.Paths.Map()))
	for p := range doc.Paths.Map() {
		paths = append(paths, p)
	}
	sort.Strings(paths)

	for _, p := range paths {
		item := doc.Paths.Find(p)
		methods := []string{"get", "post", "put", "delete", "patch"}
		for _, m := range methods {
			op := getOperationByMethod(item, m)
			if op == nil {
				continue
			}

			fmt.Fprintf(file, "# %s\n", op.Summary)
			line := fmt.Sprintf("%s %s", strings.ToUpper(m), p)

			// Add basic assertions based on response schema
			line += " -a \"status=200\""

			// If it's a POST/PUT, add a placeholder for data
			if m == "post" || m == "put" {
				line += " -d '{}'"
			}

			fmt.Fprintf(file, "%s\n\n", line)
		}
	}

	fmt.Printf("Successfully generated scenario file: %s\n", outPath)
	return nil
}

func getOperationByMethod(item *openapi3.PathItem, method string) *openapi3.Operation {
	switch strings.ToLower(method) {
	case "get":
		return item.Get
	case "post":
		return item.Post
	case "put":
		return item.Put
	case "delete":
		return item.Delete
	case "patch":
		return item.Patch
	}
	return nil
}
