package parser

import (
	"bufio"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

// ParseModuleRoutes parses route definitions from internal/modules/**/routes.go files.
// It supports both fluent router style and gin RouterGroup style used in this repository.
func ParseModuleRoutes(modulesDir string, prefix string) ([]Route, error) {
	var allRoutes []Route

	err := filepath.Walk(modulesDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() || info.Name() != "routes.go" {
			return nil
		}

		routes, parseErr := parseModuleRoutesFile(path, prefix)
		if parseErr != nil {
			return parseErr
		}
		allRoutes = append(allRoutes, routes...)
		return nil
	})

	return allRoutes, err
}

func parseModuleRoutesFile(filename string, apiPrefix string) ([]Route, error) {
	file, err := os.Open(filename)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	module := filepath.Base(filepath.Dir(filename))
	var routes []Route

	// Maintain inferred prefix for route variables.
	varPrefix := map[string]string{
		"r":      "",
		"router": "",
		"rg":     "",
	}

	groupWithFuncPattern := regexp.MustCompile(`(\w+)\.Group\s*\(\s*"([^"]*)"\s*,\s*func\s*\(\s*(\w+)`)
	groupAssignPattern := regexp.MustCompile(`(\w+)\s*:=\s*(\w+)\.Group\s*\(\s*"([^"]*)"\s*\)`)
	routePattern := regexp.MustCompile(`(\w+)\.(GET|POST|PUT|DELETE|PATCH)\s*\(\s*"([^"]*)"`)
	handlerPattern := regexp.MustCompile(`,\s*([A-Za-z_][\w]*)\.([A-Za-z_][\w]*)`)
	namePattern := regexp.MustCompile(`\.Name\s*\(\s*"([^"]+)"\s*\)`)
	withMiddlewarePattern := regexp.MustCompile(`WithMiddleware\s*\(\s*"([^"]+)"\s*\)`)

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := scanner.Text()

		// projects := r.Group("/projects/:id")
		if matches := groupAssignPattern.FindStringSubmatch(line); len(matches) == 4 {
			child := matches[1]
			parent := matches[2]
			segment := matches[3]
			varPrefix[child] = normalizePath(varPrefix[parent] + segment)
		}

		// r.Group("/projects/:id", func(projects *router.Router) {
		if matches := groupWithFuncPattern.FindStringSubmatch(line); len(matches) == 4 {
			parent := matches[1]
			segment := matches[2]
			child := matches[3]
			varPrefix[child] = normalizePath(varPrefix[parent] + segment)
		}

		// projects.GET("/:sid", handler.GetSpec)
		if matches := routePattern.FindStringSubmatch(line); len(matches) == 4 {
			groupVar := matches[1]
			method := matches[2]
			routePath := matches[3]

			fullPath := normalizePath(apiPrefix + varPrefix[groupVar] + routePath)
			r := Route{
				Method: method,
				Path:   fullPath,
				Module: module,
			}

			if name := namePattern.FindStringSubmatch(line); len(name) == 2 {
				r.Name = name[1]
			}

			if handler := handlerPattern.FindStringSubmatch(line); len(handler) == 3 {
				r.Handler = handler[1] + "." + handler[2]
			}

			if strings.Contains(line, "WithMiddleware(\"auth\")") {
				r.IsPublic = false
				r.Middlewares = append(r.Middlewares, "auth")
			} else {
				r.IsPublic = true
			}

			if middleware := withMiddlewarePattern.FindStringSubmatch(line); len(middleware) == 2 {
				if middleware[1] == "auth" {
					r.IsPublic = false
				}
				r.Middlewares = append(r.Middlewares, middleware[1])
			}

			routes = append(routes, r)
		}
	}

	return routes, scanner.Err()
}

func normalizePath(path string) string {
	if path == "" {
		return "/"
	}
	path = strings.ReplaceAll(path, "//", "/")
	if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}
	if len(path) > 1 && strings.HasSuffix(path, "/") {
		path = strings.TrimSuffix(path, "/")
	}
	return path
}

// RouteGroup represents a route group with its prefix
type RouteGroup struct {
	Prefix     string
	RoutesFile string
}

// ParseRouterSetup parses routes/router.go to find route groups and their prefixes
func ParseRouterSetup(routerFile string) ([]RouteGroup, error) {
	file, err := os.Open(routerFile)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	var groups []RouteGroup
	scanner := bufio.NewScanner(file)

	// Pattern: r.Group("/v1", func(api *router.Router) {
	groupPattern := regexp.MustCompile(`r\.Group\s*\(\s*"([^"]*)"`)
	// Pattern: v1.Register(api) or somepackage.Register(api)
	registerPattern := regexp.MustCompile(`(\w+)\.Register\s*\(`)

	var currentPrefix string
	inGroup := false
	braceCount := 0

	for scanner.Scan() {
		line := scanner.Text()

		// Check for group start
		if matches := groupPattern.FindStringSubmatch(line); len(matches) > 1 {
			currentPrefix = matches[1]
			inGroup = true
			braceCount = strings.Count(line, "{") - strings.Count(line, "}")
			continue
		}

		if inGroup {
			braceCount += strings.Count(line, "{") - strings.Count(line, "}")

			// Check for Register call
			if matches := registerPattern.FindStringSubmatch(line); len(matches) > 1 {
				packageName := matches[1]
				groups = append(groups, RouteGroup{
					Prefix:     currentPrefix,
					RoutesFile: packageName,
				})
			}

			// Check for group end
			if braceCount <= 0 {
				inGroup = false
				currentPrefix = ""
			}
		}
	}

	return groups, scanner.Err()
}

// ParseAllRoutes parses all routes from the project
func ParseAllRoutes(routesDir string) ([]Route, error) {
	routerFile := filepath.Join(routesDir, "router.go")

	// First, parse the main router to get group prefixes
	groups, err := ParseRouterSetup(routerFile)
	if err != nil {
		// Fallback: if router.go doesn't exist, parse routes directly without prefix
		groups = []RouteGroup{{Prefix: "", RoutesFile: "v1"}}
	}

	var allRoutes []Route

	for _, group := range groups {
		// Find the register.go file for this group
		registerFile := filepath.Join(routesDir, group.RoutesFile, "register.go")
		if _, err := os.Stat(registerFile); os.IsNotExist(err) {
			continue
		}

		routes, err := ParseRoutesFromFile(registerFile, group.Prefix)
		if err != nil {
			return nil, err
		}
		allRoutes = append(allRoutes, routes...)
	}

	return allRoutes, nil
}

// ParseRoutes parses route definitions from a Go file (legacy, for backward compatibility)
func ParseRoutes(filename string) ([]Route, error) {
	// Try to detect prefix from parent directory structure
	dir := filepath.Dir(filename)
	routesDir := filepath.Dir(dir)
	routerFile := filepath.Join(routesDir, "router.go")

	prefix := ""
	if groups, err := ParseRouterSetup(routerFile); err == nil {
		// Find matching group
		baseName := filepath.Base(dir)
		for _, g := range groups {
			if g.RoutesFile == baseName {
				prefix = g.Prefix
				break
			}
		}
	}

	return ParseRoutesFromFile(filename, prefix)
}

// ParseRoutesFromFile parses route definitions from a Go file with given prefix
func ParseRoutesFromFile(filename string, prefix string) ([]Route, error) {
	file, err := os.Open(filename)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	var routes []Route
	var currentMiddlewares []string
	inAuthGroup := false

	scanner := bufio.NewScanner(file)

	// Regex patterns
	routePattern := regexp.MustCompile(`r\.(GET|POST|PUT|DELETE|PATCH)\s*\(\s*"([^"]+)"`)
	authRoutePattern := regexp.MustCompile(`auth\.(GET|POST|PUT|DELETE|PATCH)\s*\(\s*"([^"]+)"`)
	namePattern := regexp.MustCompile(`\.Name\s*\(\s*"([^"]+)"`)
	handlerPattern := regexp.MustCompile(`(\w+Handler)\.(\w+)`)
	groupStartPattern := regexp.MustCompile(`r\.Group\s*\(\s*""`)
	withMiddlewarePattern := regexp.MustCompile(`WithMiddleware\s*\(\s*"([^"]+)"`)
	groupEndPattern := regexp.MustCompile(`^\s*\}\s*\)`)

	for scanner.Scan() {
		line := scanner.Text()

		// Check for group start
		if groupStartPattern.MatchString(line) {
			inAuthGroup = true
			currentMiddlewares = []string{}
			continue
		}

		// Check for middleware in group
		if inAuthGroup {
			if matches := withMiddlewarePattern.FindStringSubmatch(line); len(matches) > 1 {
				currentMiddlewares = append(currentMiddlewares, matches[1])
				continue
			}
		}

		// Check for group end
		if groupEndPattern.MatchString(line) && inAuthGroup {
			inAuthGroup = false
			currentMiddlewares = []string{}
			continue
		}

		// Parse route definitions
		var method, path string
		var isAuthRoute bool

		if matches := authRoutePattern.FindStringSubmatch(line); len(matches) > 2 {
			method = matches[1]
			path = matches[2]
			isAuthRoute = true
		} else if matches := routePattern.FindStringSubmatch(line); len(matches) > 2 {
			method = matches[1]
			path = matches[2]
			isAuthRoute = inAuthGroup
		} else {
			continue
		}

		// Build full path with prefix
		fullPath := prefix + path

		route := Route{
			Method:   method,
			Path:     fullPath,
			IsPublic: !isAuthRoute,
		}

		// Extract route name
		if matches := namePattern.FindStringSubmatch(line); len(matches) > 1 {
			route.Name = matches[1]
		}

		// Extract handler
		if matches := handlerPattern.FindStringSubmatch(line); len(matches) > 2 {
			route.Handler = matches[1] + "." + matches[2]
			// Extract module from handler name
			route.Module = extractModuleFromHandler(matches[1])
		}

		// Set middlewares
		if isAuthRoute {
			route.Middlewares = append([]string{"auth"}, currentMiddlewares...)
		}

		routes = append(routes, route)
	}

	return routes, scanner.Err()
}

// extractModuleFromHandler extracts module name from handler name
// e.g., "userHandler" -> "user", "apiKeyHandler" -> "apikey"
func extractModuleFromHandler(handler string) string {
	handler = strings.TrimSuffix(handler, "Handler")
	return strings.ToLower(handler)
}
