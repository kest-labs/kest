// Package main provides a CLI tool to list all registered routes.
// Usage: go run cmd/tools/routes/main.go
package main

import (
	"flag"
	"fmt"
	"strings"

	"github.com/kest-labs/kest/api/cmd/tools/apidoc/parser"
)

func main() {
	format := flag.String("format", "table", "Output format: table, json, or markdown")
	routesFile := flag.String("routes", "routes/v1/register.go", "Routes file to parse")
	filter := flag.String("filter", "", "Filter routes by path or name")
	flag.Parse()

	// Parse routes from source code
	routes, err := parser.ParseRoutes(*routesFile)
	if err != nil {
		fmt.Printf("Error parsing routes: %v\n", err)
		return
	}

	// Filter if specified
	if *filter != "" {
		var filtered []parser.Route
		for _, route := range routes {
			if strings.Contains(strings.ToLower(route.Path), strings.ToLower(*filter)) ||
				strings.Contains(strings.ToLower(route.Name), strings.ToLower(*filter)) ||
				strings.Contains(strings.ToLower(route.Module), strings.ToLower(*filter)) {
				filtered = append(filtered, route)
			}
		}
		routes = filtered
	}

	switch *format {
	case "json":
		printJSON(routes)
	case "markdown":
		printMarkdown(routes)
	default:
		printTable(routes)
	}
}

func printTable(routes []parser.Route) {
	fmt.Println()
	fmt.Println("📍 Registered Routes")
	fmt.Println("====================")
	fmt.Println()
	fmt.Printf("%-8s %-35s %-28s %s\n", "Method", "Path", "Name", "Auth")
	fmt.Println(strings.Repeat("-", 85))

	for _, route := range routes {
		auth := "🔓 Public"
		if !route.IsPublic {
			auth = "🔒 Auth"
		}
		fmt.Printf("%-8s %-35s %-28s %s\n",
			route.Method,
			truncate(route.Path, 35),
			truncate(route.Name, 28),
			auth,
		)
	}

	fmt.Println()
	fmt.Printf("Total: %d routes\n", len(routes))
}

func printJSON(routes []parser.Route) {
	fmt.Println("[")
	for i, route := range routes {
		comma := ","
		if i == len(routes)-1 {
			comma = ""
		}
		fmt.Printf(`  {"method": "%s", "path": "%s", "name": "%s", "public": %v}%s`+"\n",
			route.Method, route.Path, route.Name, route.IsPublic, comma)
	}
	fmt.Println("]")
}

func printMarkdown(routes []parser.Route) {
	fmt.Println("# Route List")
	fmt.Println()
	fmt.Println("| Method | Path | Name | Auth |")
	fmt.Println("|--------|------|------|------|")

	for _, route := range routes {
		auth := "🔓"
		if !route.IsPublic {
			auth = "🔒"
		}
		fmt.Printf("| `%s` | `%s` | `%s` | %s |\n",
			route.Method,
			route.Path,
			route.Name,
			auth,
		)
	}

	fmt.Printf("\nTotal: %d routes\n", len(routes))
}

func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-3] + "..."
}
