package gin

import (
	"context"
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/kest-labs/kest/cli/internal/scanner"
)

type GinScanner struct{}

func NewScanner() *GinScanner {
	return &GinScanner{}
}

func (s *GinScanner) Name() string {
	return "gin"
}

func (s *GinScanner) Detect(ctx context.Context, path string) bool {
	// Basic detection: check if internal/modules exists (specific to kest-api structure for now)
	_, err := os.Stat(filepath.Join(path, "internal", "modules"))
	return err == nil
}

func (s *GinScanner) Scan(ctx context.Context, rootPath string) ([]*scanner.ModuleInfo, error) {
	var modules []*scanner.ModuleInfo

	modulesPath := filepath.Join(rootPath, "internal", "modules")
	entries, err := os.ReadDir(modulesPath)
	if err != nil {
		return nil, err
	}

	for _, entry := range entries {
		if entry.IsDir() {
			moduleName := entry.Name()
			path := filepath.Join(modulesPath, moduleName)
			modInfo, err := s.scanModule(path, moduleName)
			if err != nil {
				fmt.Printf("⚠️  Skipping module %s: %v\n", moduleName, err)
				continue
			}
			if modInfo != nil && len(modInfo.Endpoints) > 0 {
				modules = append(modules, modInfo)
			}
		}
	}

	return modules, err
}

func (s *GinScanner) scanModule(modulePath, moduleName string) (*scanner.ModuleInfo, error) {
	routesFile := filepath.Join(modulePath, "routes.go")
	if _, err := os.Stat(routesFile); os.IsNotExist(err) {
		return nil, nil // Not a standard module with routes.go
	}

	modInfo := &scanner.ModuleInfo{
		Name: moduleName,
		DTOs: make(map[string]*scanner.DTOInfo),
	}

	fset := token.NewFileSet()
	node, err := parser.ParseFile(fset, routesFile, nil, parser.ParseComments)
	if err != nil {
		return nil, err
	}

	prefixes := make(map[string]string)
	prefixes["r"] = ""
	groupMiddlewares := make(map[string][]string)

	ast.Inspect(node, func(n ast.Node) bool {
		if call, ok := n.(*ast.CallExpr); ok {
			if sel, ok := call.Fun.(*ast.SelectorExpr); ok {
				if sel.Sel.Name == "Group" {
					if len(call.Args) >= 2 {
						prefix := ""
						if pathLit, ok := call.Args[0].(*ast.BasicLit); ok {
							prefix = strings.Trim(pathLit.Value, "\"")
						}
						if fn, ok := call.Args[1].(*ast.FuncLit); ok {
							if len(fn.Type.Params.List) > 0 && len(fn.Type.Params.List[0].Names) > 0 {
								childRouter := fn.Type.Params.List[0].Names[0].Name
								parentRouter := "r"
								if parentID, ok := sel.X.(*ast.Ident); ok {
									parentRouter = parentID.Name
								}
								prefixes[childRouter] = prefixes[parentRouter] + prefix
								// Inherit middlewares from parent group
								groupMiddlewares[childRouter] = append([]string{}, groupMiddlewares[parentRouter]...)
							}
						}
					}
				} else if sel.Sel.Name == "WithMiddleware" {
					if id, ok := sel.X.(*ast.Ident); ok {
						routerVar := id.Name
						for _, arg := range call.Args {
							if lit, ok := arg.(*ast.BasicLit); ok {
								groupMiddlewares[routerVar] = append(groupMiddlewares[routerVar], strings.Trim(lit.Value, "\""))
							}
						}
					}
				}
			}
		}

		call, ok := n.(*ast.CallExpr)
		if !ok {
			return true
		}
		sel, ok := call.Fun.(*ast.SelectorExpr)
		if !ok {
			return true
		}
		method := strings.ToUpper(sel.Sel.Name)
		if !isHTTPMethod(method) {
			return true
		}

		routerVar := "r"
		if id, ok := sel.X.(*ast.Ident); ok {
			routerVar = id.Name
		}
		if len(call.Args) < 1 {
			return true
		}
		path := "/"
		if pathLit, ok := call.Args[0].(*ast.BasicLit); ok {
			path = strings.Trim(pathLit.Value, "\"")
		}

		handlerName := "unknown"
		for i := 1; i < len(call.Args); i++ {
			arg := call.Args[i]
			if sel, ok := arg.(*ast.SelectorExpr); ok {
				handlerName = sel.Sel.Name
				break
			} else if id, ok := arg.(*ast.Ident); ok {
				handlerName = id.Name
				break
			}
		}

		fullPath := prefixes[routerVar] + path
		if !strings.HasPrefix(fullPath, "/") {
			fullPath = "/" + fullPath
		}
		fullPath = strings.ReplaceAll(fullPath, "//", "/")

		endpoint := scanner.APIEndpoint{
			Method:      method,
			Path:        fullPath,
			Handler:     handlerName,
			Middlewares: append([]string{}, groupMiddlewares[routerVar]...),
		}

		// Look for .Middleware(...) chained call
		// Note: Simplistic AST check for chained calls
		parent := n
		for {
			if pCall, ok := parent.(*ast.CallExpr); ok {
				pSel, ok := pCall.Fun.(*ast.SelectorExpr)
				if ok && pSel.Sel.Name == "Middleware" {
					for _, arg := range pCall.Args {
						if lit, ok := arg.(*ast.BasicLit); ok {
							endpoint.Middlewares = append(endpoint.Middlewares, strings.Trim(lit.Value, "\""))
						} else if call, ok := arg.(*ast.CallExpr); ok {
							// Handle middleware.RequireProjectRole(...)
							if sel, ok := call.Fun.(*ast.SelectorExpr); ok {
								mName := sel.Sel.Name
								for _, subArg := range call.Args {
									if subSel, ok := subArg.(*ast.SelectorExpr); ok {
										mName += ":" + subSel.Sel.Name
									}
								}
								endpoint.Middlewares = append(endpoint.Middlewares, mName)
							}
						}
					}
					parent = pSel.X
					continue
				}
			}
			break
		}

		modInfo.Endpoints = append(modInfo.Endpoints, endpoint)
		return true
	})

	// Scan all .go files in the module directory for handler code/comments
	entries, _ := os.ReadDir(modulePath)
	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(entry.Name(), ".go") &&
			entry.Name() != "routes.go" && !strings.HasSuffix(entry.Name(), "_test.go") {
			s.enrichEndpointsWithComments(modInfo, filepath.Join(modulePath, entry.Name()))
		}
	}

	// Proactively scan dto.go to capture ALL DTOs (not just handler-referenced ones)
	dtoFile := filepath.Join(modulePath, "dto.go")
	if _, err := os.Stat(dtoFile); err == nil {
		s.scanAllDTOs(modInfo, dtoFile)
	}

	// 💡 RECURSIVE LOGIC ANALYSIS: Trace implementation across layers
	s.enrichEndpointsWithDeepLogic(modInfo, modulePath)

	return modInfo, nil
}

func (s *GinScanner) enrichEndpointsWithDeepLogic(mod *scanner.ModuleInfo, modulePath string) {
	serviceFile := filepath.Join(modulePath, "service.go")
	repoFile := filepath.Join(modulePath, "repository.go")

	serviceSources := make(map[string]string)
	repoSources := make(map[string]string)

	if _, err := os.Stat(serviceFile); err == nil {
		serviceSources = s.parseFileFunctions(serviceFile)
	}
	if _, err := os.Stat(repoFile); err == nil {
		repoSources = s.parseFileFunctions(repoFile)
	}

	for i := range mod.Endpoints {
		ep := &mod.Endpoints[i]
		// Trace Handler -> Service
		s.traceCalls(ep, serviceSources, "service.", "Service")
		// Trace Service -> Repo (if service logic was added)
		s.traceCalls(ep, repoSources, "repo.", "Repository")
	}
}

func (s *GinScanner) parseFileFunctions(filePath string) map[string]string {
	fset := token.NewFileSet()
	node, err := parser.ParseFile(fset, filePath, nil, parser.ParseComments)
	if err != nil {
		return nil
	}
	content, _ := os.ReadFile(filePath)
	sources := make(map[string]string)

	ast.Inspect(node, func(n ast.Node) bool {
		fn, ok := n.(*ast.FuncDecl)
		if !ok {
			return true
		}
		start := fset.Position(fn.Pos()).Offset
		end := fset.Position(fn.End()).Offset
		if start < len(content) && end <= len(content) {
			sources[fn.Name.Name] = string(content[start:end])
		}
		return true
	})
	return sources
}

func (s *GinScanner) traceCalls(ep *scanner.APIEndpoint, sources map[string]string, prefix, label string) {
	lines := strings.Split(ep.Code, "\n")
	for _, line := range lines {
		if strings.Contains(line, prefix) {
			re := regexp.MustCompile(regexp.QuoteMeta(prefix) + `([A-Z][a-zA-Z0-9]+)`)
			matches := re.FindStringSubmatch(line)
			if len(matches) > 1 {
				methodName := matches[1]
				if src, ok := sources[methodName]; ok {
					if !strings.Contains(ep.Code, "// Linked "+label+" Logic ("+methodName+")") {
						ep.Code += "\n\n// Linked " + label + " Logic (" + methodName + "):\n" + src
					}
				}
			}
		}
	}
}

func (s *GinScanner) enrichEndpointsWithComments(mod *scanner.ModuleInfo, handlerFile string) {
	fset := token.NewFileSet()
	node, err := parser.ParseFile(fset, handlerFile, nil, parser.ParseComments)
	if err != nil {
		return
	}
	content, _ := os.ReadFile(handlerFile)
	comments := make(map[string]string)
	sources := make(map[string]string)
	proxies := make(map[string]string)
	dtoNames := make(map[string]bool)
	handlerRequests := make(map[string]string)
	handlerResponses := make(map[string]string)
	handlerErrors := make(map[string][]scanner.EndpointError)

	ast.Inspect(node, func(n ast.Node) bool {
		fn, ok := n.(*ast.FuncDecl)
		if !ok {
			return true
		}
		name := fn.Name.Name
		if fn.Doc != nil {
			comments[name] = strings.TrimSpace(fn.Doc.Text())
		}
		start := fset.Position(fn.Pos()).Offset
		end := fset.Position(fn.End()).Offset
		if start < len(content) && end <= len(content) {
			sources[name] = string(content[start:end])
		}

		// Detect DTO usage more precisely and Error calls
		reqType := ""
		respType := ""

		ast.Inspect(fn.Body, func(bn ast.Node) bool {
			if call, ok := bn.(*ast.CallExpr); ok {
				if sel, ok := call.Fun.(*ast.SelectorExpr); ok {
					// 1. Detect JSON binding: c.ShouldBindJSON(&req)
					if strings.Contains(sel.Sel.Name, "Bind") && len(call.Args) > 0 {
						if unary, ok := call.Args[0].(*ast.UnaryExpr); ok && unary.Op == token.AND {
							if id, ok := unary.X.(*ast.Ident); ok {
								dtoNames[id.Name] = true
							}
						}
					}
					// 2. Detect JSON response: c.JSON(200, resp)
					if sel.Sel.Name == "JSON" && len(call.Args) >= 2 {
						if id, ok := call.Args[1].(*ast.Ident); ok {
							dtoNames[id.Name] = true
						}
					}
					// 3. Detect Error responses: response.Error(c, code, msg)
					if sel.Sel.Name == "Error" && len(call.Args) >= 2 {
						// Try to extract status code
						code := 0
						if id, ok := call.Args[1].(*ast.SelectorExpr); ok {
							// e.g. http.StatusBadRequest
							codeStr := id.Sel.Name
							if strings.Contains(codeStr, "Status") {
								// We could map these, but for now just note it
							}
						} else if lit, ok := call.Args[1].(*ast.BasicLit); ok {
							fmt.Sscanf(lit.Value, "%d", &code)
						}

						handlerErrors[name] = append(handlerErrors[name], scanner.EndpointError{
							Code: code,
						})
					}
				}
			}

			// 3. Fallback: Search for any local var decl with *Request or *Response suffix
			if spec, ok := bn.(*ast.ValueSpec); ok {
				typeName := s.getExprType(spec.Type)
				if strings.Contains(typeName, "Request") {
					reqType = typeName
					// Strip prefixes for tracking
					clean := strings.TrimLeft(typeName, "[]*")
					dtoNames[clean] = true
				}
				if strings.Contains(typeName, "Response") {
					respType = typeName
					// Strip prefixes for tracking
					clean := strings.TrimLeft(typeName, "[]*")
					dtoNames[clean] = true
				}
			}
			return true
		})

		// Track which types this handler uses
		if reqType != "" {
			handlerRequests[name] = reqType
		}
		if respType != "" {
			handlerResponses[name] = respType
		}

		if fn.Body != nil && len(fn.Body.List) == 1 {
			if expr, ok := fn.Body.List[0].(*ast.ExprStmt); ok {
				if call, ok := expr.X.(*ast.CallExpr); ok {
					if sel, ok := call.Fun.(*ast.SelectorExpr); ok {
						proxies[name] = sel.Sel.Name
					}
				}
			}
		}
		return true
	})

	for i := range mod.Endpoints {
		ep := &mod.Endpoints[i]
		// Handle the case where the handler name is already qualified (e.g., student.Create)
		// We only want the base name for lookup in the current file
		name := ep.Handler
		if strings.Contains(name, ".") {
			parts := strings.Split(name, ".")
			name = parts[len(parts)-1]
		}

		desc := comments[name]
		code := sources[name]
		reqType := handlerRequests[name]
		respType := handlerResponses[name]
		errs := handlerErrors[name]

		if (desc == "" || strings.HasPrefix(desc, "Convenience")) && proxies[name] != "" {
			target := proxies[name]
			if targetDesc := comments[target]; targetDesc != "" {
				desc = targetDesc
			}
			if code == "" {
				code = sources[target]
			}
			if reqType == "" {
				reqType = handlerRequests[target]
			}
			if respType == "" {
				respType = handlerResponses[target]
			}
			if len(errs) == 0 {
				errs = handlerErrors[target]
			}
		}

		if desc != "" {
			ep.Description = cleanComment(desc)
		}
		if code != "" {
			ep.Code = code
		}
		if reqType != "" {
			ep.RequestType = reqType
		}
		if respType != "" {
			ep.ResponseType = respType
		}
		if len(errs) > 0 {
			ep.Errors = errs
		}
	}

	// Scan DTOs if they exist in this file as well
	if len(dtoNames) > 0 {
		s.scanDTOs(mod, handlerFile, dtoNames)
	}
}

func mapHTTPStatus(status string) int {
	switch status {
	case "StatusOK":
		return 200
	case "StatusCreated":
		return 201
	case "StatusNoContent":
		return 204
	case "StatusBadRequest":
		return 400
	case "StatusUnauthorized":
		return 401
	case "StatusForbidden":
		return 403
	case "StatusNotFound":
		return 404
	case "StatusInternalServerError":
		return 500
	default:
		return 0
	}
}

// scanAllDTOs scans ALL struct types in a dto.go file and adds them to the module's DTOs map.
// Unlike scanDTOs, this does not filter by target names — it captures everything.
func (s *GinScanner) scanAllDTOs(mod *scanner.ModuleInfo, dtoFile string) {
	allNames := make(map[string]bool)

	// First pass: collect all struct type names
	fset := token.NewFileSet()
	node, err := parser.ParseFile(fset, dtoFile, nil, parser.ParseComments)
	if err != nil {
		return
	}
	ast.Inspect(node, func(n ast.Node) bool {
		ts, ok := n.(*ast.TypeSpec)
		if !ok || ts.Type == nil {
			return true
		}
		if _, ok := ts.Type.(*ast.StructType); ok {
			allNames[ts.Name.Name] = true
		}
		return true
	})

	// Second pass: reuse existing scanDTOs with all names
	s.scanDTOs(mod, dtoFile, allNames)
}

func (s *GinScanner) scanDTOs(mod *scanner.ModuleInfo, dtoFile string, targetNames map[string]bool) {
	fset := token.NewFileSet()
	node, err := parser.ParseFile(fset, dtoFile, nil, parser.ParseComments)
	if err != nil {
		return
	}
	content, _ := os.ReadFile(dtoFile)
	ast.Inspect(node, func(n ast.Node) bool {
		ts, ok := n.(*ast.TypeSpec)
		if !ok || ts.Type == nil {
			return true
		}
		st, ok := ts.Type.(*ast.StructType)
		if !ok {
			return true
		}

		if targetNames[ts.Name.Name] {
			dto := scanner.DTOInfo{
				Name: ts.Name.Name,
			}
			start := fset.Position(ts.Pos()).Offset
			end := fset.Position(ts.End()).Offset
			if start < len(content) && end <= len(content) {
				dto.Code = string(content[start:end])
			}

			// Parse fields
			for _, field := range st.Fields.List {
				if len(field.Names) == 0 {
					continue
				}
				fieldName := field.Names[0].Name
				fieldType := s.getExprType(field.Type)

				tag := ""
				if field.Tag != nil {
					tag = strings.Trim(field.Tag.Value, "`")
				}

				jsonName := fieldName
				validation := ""

				// Simple tag parsing
				if tag != "" {
					// Parse json:"name"
					if jsonIdx := strings.Index(tag, "json:\""); jsonIdx != -1 {
						val := tag[jsonIdx+6:]
						if endIdx := strings.Index(val, "\""); endIdx != -1 {
							jsonPart := val[:endIdx]
							if commaIdx := strings.Index(jsonPart, ","); commaIdx != -1 {
								jsonName = jsonPart[:commaIdx]
							} else {
								jsonName = jsonPart
							}
						}
					}
					// Parse binding:"..."
					if bindIdx := strings.Index(tag, "binding:\""); bindIdx != -1 {
						val := tag[bindIdx+9:]
						if endIdx := strings.Index(val, "\""); endIdx != -1 {
							validation = val[:endIdx]
						}
					}
				}

				comment := ""
				if field.Comment != nil {
					comment = strings.TrimSpace(field.Comment.Text())
				}

				dto.Fields = append(dto.Fields, scanner.DTOField{
					Name:       fieldName,
					JSONName:   jsonName,
					Type:       fieldType,
					Validation: validation,
					Tag:        tag,
					Comment:    comment,
				})
			}
			mod.DTOs[ts.Name.Name] = &dto
		}
		return true
	})
}

func (s *GinScanner) getExprType(expr ast.Expr) string {
	switch t := expr.(type) {
	case *ast.Ident:
		return t.Name
	case *ast.StarExpr:
		return "*" + s.getExprType(t.X)
	case *ast.ArrayType:
		return "[]" + s.getExprType(t.Elt)
	case *ast.MapType:
		return "map[" + s.getExprType(t.Key) + "]" + s.getExprType(t.Value)
	case *ast.SelectorExpr:
		return s.getExprType(t.X) + "." + t.Sel.Name
	case *ast.InterfaceType:
		return "interface{}"
	default:
		return fmt.Sprintf("%T", expr)
	}
}

func isHTTPMethod(m string) bool {
	switch m {
	case "GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD":
		return true
	}
	return false
}

func cleanComment(c string) string {
	if c == "" {
		return ""
	}
	firstLine := strings.Split(strings.TrimSpace(c), "\n")[0]
	if strings.Contains(firstLine, " handles ") {
		parts := strings.Split(firstLine, " ")
		pathIndex := -1
		for i, p := range parts {
			if strings.HasPrefix(p, "/") || strings.HasPrefix(p, "http") {
				pathIndex = i
				break
			}
		}
		if pathIndex != -1 && pathIndex < len(parts)-1 {
			desc := strings.Join(parts[pathIndex+1:], " ")
			desc = strings.TrimLeft(desc, "- ")
			if desc != "" {
				return desc
			}
		}
	}
	re := regexp.MustCompile(`(?i)^[a-z0-9]+\s+handles\s+[a-z]+\s+\S+\s*`)
	firstLine = re.ReplaceAllString(firstLine, "")
	return strings.TrimSpace(firstLine)
}
