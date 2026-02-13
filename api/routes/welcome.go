package routes

import (
	"fmt"
	"runtime"

	"github.com/kest-labs/kest/api/internal/infra/config"
	"github.com/gin-gonic/gin"
)

// RegisterWelcome registers the welcome page route
func RegisterWelcome(r *gin.Engine) {
	r.GET("/", func(c *gin.Context) {
		// Get config
		appName := "Eogo"
		appEnv := "local"
		if config.GlobalConfig != nil {
			appName = config.GlobalConfig.App.Name
			appEnv = config.GlobalConfig.App.Env
		}

		html := fmt.Sprintf(`<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<title>%s</title>
	<link rel="preconnect" href="https://fonts.googleapis.com">
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
	<link href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600&display=swap" rel="stylesheet">
	<style>
		* { margin: 0; padding: 0; box-sizing: border-box; }
		html { line-height: 1.5; -webkit-text-size-adjust: 100%%; font-family: 'Figtree', ui-sans-serif, system-ui, sans-serif; }
		body { background: #f8fafc; min-height: 100vh; }
		a { color: inherit; text-decoration: none; }
		code { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 13px; }
		
		.container { max-width: 1024px; margin: 0 auto; padding: 48px 24px; }
		
		.header { text-align: center; margin-bottom: 40px; }
		.logo { display: inline-flex; align-items: center; gap: 12px; margin-bottom: 8px; }
		.logo svg { width: 48px; height: 48px; }
		.logo-text { font-size: 32px; font-weight: 600; color: #1e293b; letter-spacing: -0.5px; }
		.version { background: #f43f5e; color: white; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px; }
		.subtitle { color: #64748b; font-size: 15px; }
		
		.section { margin-bottom: 32px; }
		.section-title { font-size: 13px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 16px; }
		
		.grid { display: grid; grid-template-columns: 1fr; gap: 12px; }
		@media (min-width: 768px) { .grid { grid-template-columns: 1fr 1fr; } }
		@media (min-width: 900px) { .grid-3 { grid-template-columns: 1fr 1fr 1fr; } }
		
		.card { background: white; border-radius: 12px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); transition: box-shadow 0.15s; }
		.card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
		.card-header { display: flex; align-items: flex-start; gap: 14px; }
		.card-icon { flex-shrink: 0; width: 36px; height: 36px; background: linear-gradient(135deg, #f43f5e 0%%, #fb7185 100%%); border-radius: 8px; display: flex; align-items: center; justify-content: center; }
		.card-icon svg { width: 18px; height: 18px; color: white; }
		.card-icon.blue { background: linear-gradient(135deg, #3b82f6, #60a5fa); }
		.card-icon.green { background: linear-gradient(135deg, #10b981, #34d399); }
		.card-icon.purple { background: linear-gradient(135deg, #8b5cf6, #a78bfa); }
		.card-icon.orange { background: linear-gradient(135deg, #f97316, #fb923c); }
		.card-icon.cyan { background: linear-gradient(135deg, #06b6d4, #22d3ee); }
		.card-content { flex: 1; }
		.card-title { font-size: 15px; font-weight: 600; color: #1e293b; margin-bottom: 2px; }
		.card-title:hover { color: #f43f5e; }
		.card-desc { font-size: 13px; color: #64748b; line-height: 1.5; }
		
		.features { display: flex; flex-wrap: wrap; gap: 8px; }
		.feature { background: #f1f5f9; color: #475569; font-size: 12px; font-weight: 500; padding: 4px 10px; border-radius: 6px; }
		
		.footer { margin-top: 40px; text-align: center; padding-top: 24px; border-top: 1px solid #e2e8f0; }
		.footer-info { display: flex; justify-content: center; gap: 24px; flex-wrap: wrap; font-size: 13px; color: #64748b; }
		.footer-info span { color: #1e293b; font-weight: 500; }
		.footer-links { margin-top: 12px; display: flex; justify-content: center; gap: 16px; font-size: 13px; }
		.footer-links a { color: #64748b; }
		.footer-links a:hover { color: #f43f5e; }
	</style>
</head>
<body>
	<div class="container">
		<div class="header">
			<div class="logo">
				<svg viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="10" fill="url(#g)"/><path d="M14 16h20v4H18v4h12v4H18v4h16v4H14V16z" fill="white"/><defs><linearGradient id="g" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse"><stop stop-color="#f43f5e"/><stop offset="1" stop-color="#fb7185"/></linearGradient></defs></svg>
				<span class="logo-text">%s</span>
				<span class="version">v1.0</span>
			</div>
			<p class="subtitle">The Go framework for building modern APIs (Hot Reload Verified)</p>
		</div>
		
		<div class="section">
			<div class="section-title">Quick Links</div>
			<div class="grid">
				<a href="https://github.com/kest-labs/kest/api" target="_blank" class="card">
					<div class="card-header">
						<div class="card-icon"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg></div>
						<div class="card-content"><h2 class="card-title">Documentation</h2><p class="card-desc">Comprehensive guides and API reference</p></div>
					</div>
				</a>
				<a href="/swagger/index.html" class="card">
					<div class="card-header">
						<div class="card-icon blue"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg></div>
						<div class="card-content"><h2 class="card-title">API Browser</h2><p class="card-desc">Explore endpoints with Swagger UI</p></div>
					</div>
				</a>
				<a href="/v1/health" class="card">
					<div class="card-header">
						<div class="card-icon green"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg></div>
						<div class="card-content"><h2 class="card-title">Health Check</h2><p class="card-desc">Monitor application status</p></div>
					</div>
				</a>
				<div class="card">
					<div class="card-header">
						<div class="card-icon purple"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg></div>
						<div class="card-content"><h2 class="card-title">CLI Tools</h2><p class="card-desc">Run <code>./zgo --help</code></p></div>
					</div>
				</div>
			</div>
		</div>
		
		<div class="section">
			<div class="section-title">Framework Features</div>
			<div class="grid grid-3">
				<div class="card">
					<div class="card-header">
						<div class="card-icon orange"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg></div>
						<div class="card-content"><div class="card-title">High Performance</div><p class="card-desc">Built on Gin with optimized routing</p></div>
					</div>
				</div>
				<div class="card">
					<div class="card-header">
						<div class="card-icon green"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg></div>
						<div class="card-content"><div class="card-title">JWT Authentication</div><p class="card-desc">Secure token-based auth</p></div>
					</div>
				</div>
				<div class="card">
					<div class="card-header">
						<div class="card-icon blue"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg></div>
						<div class="card-content"><div class="card-title">RBAC Permissions</div><p class="card-desc">Role-based access control</p></div>
					</div>
				</div>
				<div class="card">
					<div class="card-header">
						<div class="card-icon purple"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"/></svg></div>
						<div class="card-content"><div class="card-title">GORM Database</div><p class="card-desc">PostgreSQL, MySQL, SQLite</p></div>
					</div>
				</div>
				<div class="card">
					<div class="card-header">
						<div class="card-icon"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2"/></svg></div>
						<div class="card-content"><div class="card-title">Redis Cache</div><p class="card-desc">Caching and session store</p></div>
					</div>
				</div>
				<div class="card">
					<div class="card-header">
						<div class="card-icon cyan"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg></div>
						<div class="card-content"><div class="card-title">Email & Queue</div><p class="card-desc">Async jobs and notifications</p></div>
					</div>
				</div>
			</div>
		</div>
		
		<div class="section">
			<div class="section-title">Middleware</div>
			<div class="features">
				<span class="feature">CORS</span>
				<span class="feature">JWT Auth</span>
				<span class="feature">Rate Limit</span>
				<span class="feature">Timeout</span>
				<span class="feature">Body Limit</span>
				<span class="feature">Request ID</span>
				<span class="feature">Compress</span>
				<span class="feature">Helmet</span>
				<span class="feature">Real IP</span>
				<span class="feature">Key Auth</span>
				<span class="feature">Recovery</span>
				<span class="feature">Logger</span>
			</div>
		</div>
		
		<div class="section">
			<div class="section-title">Packages</div>
			<div class="features">
				<span class="feature">pkg/hash</span>
				<span class="feature">pkg/errors</span>
				<span class="feature">pkg/response</span>
				<span class="feature">pkg/validation</span>
				<span class="feature">pkg/pagination</span>
				<span class="feature">pkg/encryption</span>
				<span class="feature">pkg/support</span>
				<span class="feature">pkg/resource</span>
			</div>
		</div>
		
		<div class="footer">
			<div class="footer-info">
				<div>Go <span>%s</span></div>
				<div>Eogo <span>v1.0.0</span></div>
				<div>Environment <span>%s</span></div>
			</div>
			<div class="footer-links">
				<a href="https://github.com/kest-labs/kest/api" target="_blank">GitHub</a>
				<a href="/v1/health">API v1</a>
			</div>
		</div>
	</div>
</body>
</html>`, appName, appName, runtime.Version(), appEnv)

		c.Data(200, "text/html; charset=utf-8", []byte(html))
	})
}
