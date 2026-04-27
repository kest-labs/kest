package router

import (
	"fmt"
	"net/http"
	"regexp"
	"strings"

	"github.com/gin-gonic/gin"
)

// Handler is an alias for gin.HandlerFunc
type Handler = gin.HandlerFunc

// Middleware is an alias for gin.HandlerFunc
type Middleware = gin.HandlerFunc

// Route represents a single route definition
type Route struct {
	method      string
	path        string
	handler     Handler
	name        string
	middleware  []Middleware
	router      *Router
	constraints map[string]string
}

// Name sets the route name for URL generation
func (r *Route) Name(name string) *Route {
	r.name = name
	if r.router != nil {
		r.router.namedRoutes[name] = r
	}
	return r
}

// Middleware adds middleware to this specific route
func (r *Route) Middleware(middleware ...Middleware) *Route {
	r.middleware = append(r.middleware, middleware...)
	return r
}

// Router wraps gin.Engine/RouterGroup with a fluent API
type Router struct {
	engine           *gin.Engine
	group            *gin.RouterGroup
	prefix           string
	middleware       []Middleware
	namedRoutes      map[string]*Route
	parent           *Router
	middlewareGroups map[string][]Middleware
	middlewareAlias  map[string]Middleware
	globalPatterns   map[string]string
}

// New creates a new Router wrapping a gin.Engine
func New(engine *gin.Engine) *Router {
	return &Router{
		engine:           engine,
		group:            &engine.RouterGroup,
		namedRoutes:      make(map[string]*Route),
		middlewareGroups: make(map[string][]Middleware),
		middlewareAlias:  make(map[string]Middleware),
		globalPatterns:   make(map[string]string),
	}
}

// GinGroup returns the underlying gin.RouterGroup
func (r *Router) GinGroup() *gin.RouterGroup {
	return r.group
}

// Group creates a new route group with shared attributes
func (r *Router) Group(prefix string, fn func(*Router)) *Router {
	child := &Router{
		engine:           r.engine,
		group:            r.group.Group(prefix),
		prefix:           r.prefix + prefix,
		middleware:       append([]Middleware{}, r.middleware...),
		namedRoutes:      r.namedRoutes,
		parent:           r,
		middlewareGroups: r.middlewareGroups,
		middlewareAlias:  r.middlewareAlias,
		globalPatterns:   r.globalPatterns,
	}
	fn(child)
	return r
}

// Prefix creates a group with only prefix (no callback)
func (r *Router) Prefix(prefix string) *Router {
	return &Router{
		engine:           r.engine,
		group:            r.group.Group(prefix),
		prefix:           r.prefix + prefix,
		middleware:       append([]Middleware{}, r.middleware...),
		namedRoutes:      r.namedRoutes,
		parent:           r,
		middlewareGroups: r.middlewareGroups,
		middlewareAlias:  r.middlewareAlias,
		globalPatterns:   r.globalPatterns,
	}
}

// Middleware adds middleware to all routes in this group
func (r *Router) Middleware(middleware ...Middleware) *Router {
	r.middleware = append(r.middleware, middleware...)
	// Apply to gin group
	r.group.Use(middleware...)
	return r
}

// Use is an alias for Middleware (gin-style)
func (r *Router) Use(middleware ...Middleware) *Router {
	return r.Middleware(middleware...)
}

// GET registers a GET route
func (r *Router) GET(path string, handler Handler) *Route {
	return r.addRoute(http.MethodGet, path, handler)
}

// POST registers a POST route
func (r *Router) POST(path string, handler Handler) *Route {
	return r.addRoute(http.MethodPost, path, handler)
}

// PUT registers a PUT route
func (r *Router) PUT(path string, handler Handler) *Route {
	return r.addRoute(http.MethodPut, path, handler)
}

// PATCH registers a PATCH route
func (r *Router) PATCH(path string, handler Handler) *Route {
	return r.addRoute(http.MethodPatch, path, handler)
}

// DELETE registers a DELETE route
func (r *Router) DELETE(path string, handler Handler) *Route {
	return r.addRoute(http.MethodDelete, path, handler)
}

// OPTIONS registers an OPTIONS route
func (r *Router) OPTIONS(path string, handler Handler) *Route {
	return r.addRoute(http.MethodOptions, path, handler)
}

// HEAD registers a HEAD route
func (r *Router) HEAD(path string, handler Handler) *Route {
	return r.addRoute(http.MethodHead, path, handler)
}

// Any registers a route for all HTTP methods
func (r *Router) Any(path string, handler Handler) *Route {
	route := r.addRoute("ANY", path, handler)
	r.group.Any(path, handler)
	return route
}

// Match registers a route for specific HTTP methods
func (r *Router) Match(methods []string, path string, handler Handler) *Route {
	route := &Route{
		method:  strings.Join(methods, "|"),
		path:    r.prefix + path,
		handler: handler,
		router:  r,
	}
	for _, method := range methods {
		r.group.Handle(method, path, handler)
	}
	return route
}

// addRoute adds a route to the router
func (r *Router) addRoute(method, path string, handler Handler) *Route {
	route := &Route{
		method:      method,
		path:        r.prefix + path,
		handler:     handler,
		router:      r,
		constraints: make(map[string]string),
	}
	// Register with a wrapper that will apply constraints
	r.group.Handle(method, path, route.wrapHandler())
	return route
}

// wrapHandler wraps the handler with constraint middleware
func (rt *Route) wrapHandler() Handler {
	return func(c *gin.Context) {
		// Apply constraints
		for param, pattern := range rt.constraints {
			value := c.Param(param)
			if value != "" {
				re := regexp.MustCompile(pattern)
				if !re.MatchString(value) {
					c.AbortWithStatusJSON(http.StatusNotFound, gin.H{
						"error":   "Not Found",
						"message": fmt.Sprintf("Invalid parameter: %s", param),
					})
					return
				}
			}
		}
		// Apply route-specific middleware
		for _, mw := range rt.middleware {
			mw(c)
			if c.IsAborted() {
				return
			}
		}
		// Call actual handler
		rt.handler(c)
	}
}

// ResourceController defines the interface for RESTful resource controllers
type ResourceController interface {
	Index(c *gin.Context)
	Show(c *gin.Context)
	Store(c *gin.Context)
	Update(c *gin.Context)
	Destroy(c *gin.Context)
}

// ResourceOptions configures which actions to include/exclude
type ResourceOptions struct {
	Only   []string
	Except []string
	Names  map[string]string
	Param  string
}

// Resource registers RESTful resource routes
// Generates: GET /, GET /:id, POST /, PUT /:id, DELETE /:id
func (r *Router) Resource(name string, controller ResourceController, opts ...ResourceOptions) *Router {
	opt := ResourceOptions{Param: "id"}
	if len(opts) > 0 {
		opt = opts[0]
		if opt.Param == "" {
			opt.Param = "id"
		}
	}

	actions := map[string]struct {
		method  string
		path    string
		handler Handler
	}{
		"index":   {http.MethodGet, "", controller.Index},
		"store":   {http.MethodPost, "", controller.Store},
		"show":    {http.MethodGet, "/:" + opt.Param, controller.Show},
		"update":  {http.MethodPut, "/:" + opt.Param, controller.Update},
		"destroy": {http.MethodDelete, "/:" + opt.Param, controller.Destroy},
	}

	// Filter actions based on Only/Except
	allowed := make(map[string]bool)
	if len(opt.Only) > 0 {
		for _, a := range opt.Only {
			allowed[a] = true
		}
	} else {
		for a := range actions {
			allowed[a] = true
		}
	}
	for _, a := range opt.Except {
		delete(allowed, a)
	}

	// Register routes
	basePath := "/" + strings.Trim(name, "/")
	for actionName, action := range actions {
		if !allowed[actionName] {
			continue
		}
		fullPath := basePath + action.path
		routeName := name + "." + actionName
		if customName, ok := opt.Names[actionName]; ok {
			routeName = customName
		}
		r.addRoute(action.method, fullPath, action.handler).Name(routeName)
	}

	return r
}

// APIResource registers API resource routes (without create/edit)
func (r *Router) APIResource(name string, controller ResourceController, opts ...ResourceOptions) *Router {
	opt := ResourceOptions{
		Only: []string{"index", "show", "store", "update", "destroy"},
	}
	if len(opts) > 0 {
		opt = opts[0]
		if len(opt.Only) == 0 {
			opt.Only = []string{"index", "show", "store", "update", "destroy"}
		}
	}
	return r.Resource(name, controller, opt)
}

// Redirect registers a redirect route
func (r *Router) Redirect(from, to string, code ...int) *Route {
	status := http.StatusFound
	if len(code) > 0 {
		status = code[0]
	}
	return r.GET(from, func(c *gin.Context) {
		c.Redirect(status, to)
	})
}

// PermanentRedirect registers a 301 redirect route
func (r *Router) PermanentRedirect(from, to string) *Route {
	return r.Redirect(from, to, http.StatusMovedPermanently)
}

// Route returns a named route by name
func (r *Router) Route(name string) (*Route, bool) {
	route, ok := r.namedRoutes[name]
	return route, ok
}

// URL generates a URL for a named route
func (r *Router) URL(name string, params ...string) string {
	route, ok := r.namedRoutes[name]
	if !ok {
		return ""
	}
	path := route.path
	for i := 0; i < len(params)-1; i += 2 {
		placeholder := ":" + params[i]
		path = strings.Replace(path, placeholder, params[i+1], 1)
	}
	return path
}

// Fallback registers a fallback route for 404
func (r *Router) Fallback(handler Handler) {
	r.engine.NoRoute(handler)
}

// Static serves static files
func (r *Router) Static(relativePath, root string) {
	r.group.Static(relativePath, root)
}

// StaticFile serves a single static file
func (r *Router) StaticFile(relativePath, filepath string) {
	r.group.StaticFile(relativePath, filepath)
}

// Routes returns all named routes for debugging
func (r *Router) Routes() map[string]string {
	routes := make(map[string]string)
	for name, route := range r.namedRoutes {
		routes[name] = fmt.Sprintf("%s %s", route.method, route.path)
	}
	return routes
}

// ============================================
// Middleware Groups & Aliases
// ============================================

// MiddlewareGroup registers a named middleware group
func (r *Router) MiddlewareGroup(name string, middleware ...Middleware) *Router {
	r.middlewareGroups[name] = middleware
	return r
}

// AliasMiddleware registers a middleware alias
func (r *Router) AliasMiddleware(alias string, middleware Middleware) *Router {
	r.middlewareAlias[alias] = middleware
	return r
}

// WithMiddleware applies middleware by name (group or alias)
func (r *Router) WithMiddleware(names ...string) *Router {
	var middlewares []Middleware
	for _, name := range names {
		if group, ok := r.middlewareGroups[name]; ok {
			middlewares = append(middlewares, group...)
		} else if alias, ok := r.middlewareAlias[name]; ok {
			middlewares = append(middlewares, alias)
		}
	}
	if len(middlewares) > 0 {
		r.group.Use(middlewares...)
	}
	return r
}

// ============================================
// Parameter Constraints
// ============================================

// Pattern sets a global pattern for a route parameter
func (r *Router) Pattern(param, pattern string) *Router {
	r.globalPatterns[param] = pattern
	return r
}

// Where adds a constraint to a route parameter
func (rt *Route) Where(param, pattern string) *Route {
	rt.constraints[param] = pattern
	return rt
}

// WhereNumber constrains parameter to numbers only
func (rt *Route) WhereNumber(params ...string) *Route {
	for _, param := range params {
		rt.Where(param, `^\d+$`)
	}
	return rt
}

// WhereAlpha constrains parameter to letters only
func (rt *Route) WhereAlpha(params ...string) *Route {
	for _, param := range params {
		rt.Where(param, `^[a-zA-Z]+$`)
	}
	return rt
}

// WhereAlphaNumeric constrains parameter to alphanumeric
func (rt *Route) WhereAlphaNumeric(params ...string) *Route {
	for _, param := range params {
		rt.Where(param, `^[a-zA-Z0-9]+$`)
	}
	return rt
}

// WhereUUID constrains parameter to UUID format
func (rt *Route) WhereUUID(params ...string) *Route {
	for _, param := range params {
		rt.Where(param, `^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)
	}
	return rt
}

// WhereUUIDOrNumber constrains parameter to UUID format or legacy numeric IDs
func (rt *Route) WhereUUIDOrNumber(params ...string) *Route {
	for _, param := range params {
		rt.Where(param, `^(\d+|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$`)
	}
	return rt
}

// WhereIn constrains parameter to specific values
func (rt *Route) WhereIn(param string, values ...string) *Route {
	pattern := "^(" + strings.Join(values, "|") + ")$"
	return rt.Where(param, pattern)
}
