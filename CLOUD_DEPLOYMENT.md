# ☁️ Kest Cloud Platform Deployment Guide

## Overview

Kest API can be deployed to cloud platforms like **Render**, **Zeabur**, **Railway**, **Fly.io**, etc. using the `Dockerfile.api` (API-only version).

---

## 🎯 Architecture for Cloud Deployment

```
┌─────────────────┐
│  Frontend (SPA) │  ← Vercel/Netlify/Cloudflare Pages
└────────┬────────┘
         │ HTTPS
         ▼
┌─────────────────┐
│   Kest API      │  ← Render/Zeabur (Dockerfile.api)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   PostgreSQL    │  ← Managed Database (Render/Supabase/Neon)
└─────────────────┘
```

**Why separate frontend and backend?**
- ✅ Frontend on CDN = faster global access
- ✅ API scales independently
- ✅ Cheaper (static hosting is free/cheap)
- ✅ Easier CI/CD (deploy frontend without rebuilding API)

---

## 📦 Files for Cloud Deployment

| File | Purpose |
|------|---------|
| `Dockerfile.api` | API-only Docker image (no frontend embed) |
| `render.yaml` | Render.com Blueprint (Infrastructure as Code) |
| `zeabur.yaml` | Zeabur configuration |
| `.env.example` | Environment variables template |

---

## 🚀 Deployment Options

### Option 1: Render.com (Recommended)

**Pros**: Free tier, managed PostgreSQL, auto-deploy from Git

#### Step 1: Push to GitHub
```bash
git add .
git commit -m "Add cloud deployment configs"
git push origin main
```

#### Step 2: Deploy via Blueprint
1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **"New" → "Blueprint"**
3. Connect your GitHub repo
4. Render will auto-detect `render.yaml` and create:
   - ✅ Web Service (API)
   - ✅ PostgreSQL Database
   - ✅ Environment variables

#### Step 3: Add ClickHouse (Optional)
ClickHouse is not available on Render free tier. Options:
- Use external ClickHouse (ClickHouse Cloud)
- Disable error tracking: set `LOG_CH_ENABLED=false`

#### Step 4: Verify
```bash
curl https://your-app.onrender.com/v1/health
# Expected: {"status":"ok","version":"v1"}
```

---

### Option 2: Zeabur

**Pros**: Better for China users, supports ClickHouse

#### Step 1: Install Zeabur CLI
```bash
npm install -g @zeabur/cli
```

#### Step 2: Login and Deploy
```bash
zeabur login
zeabur deploy
```

#### Step 3: Add Services in Dashboard
1. Go to [Zeabur Dashboard](https://dash.zeabur.com)
2. Add PostgreSQL service
3. Add ClickHouse service (optional)
4. Link environment variables

---

### Option 3: Railway

**Pros**: Simple, good free tier

#### Deploy via CLI
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

#### Add Database
```bash
railway add postgresql
```

---

## 🔐 Required Environment Variables

### Minimal (API Only)
```bash
PORT=8025                    # Auto-injected by most platforms
GIN_MODE=release
DB_HOST=<provided-by-platform>
DB_PORT=5432
DB_NAME=kest
DB_USER=kest_user
DB_PASSWORD=<secure-password>
JWT_SECRET=<min-32-chars-random-string>
```

### Full (with ClickHouse)
```bash
# Add these for error tracking
LOG_CH_ENABLED=true
LOG_CH_ENDPOINT=<clickhouse-host>:9000
LOG_CH_DATABASE=trac
LOG_CH_USERNAME=trac_user
LOG_CH_PASSWORD=<secure-password>
```

### Generate Secure Secrets
```bash
# JWT Secret (32+ characters)
openssl rand -base64 32

# Or use online generator
# https://generate-secret.vercel.app/32
```

---

## 🌐 Frontend Deployment (Separate)

### Deploy to Vercel (Recommended for Next.js/Vite)

```bash
cd web
npm install -g vercel
vercel
```

### Environment Variables for Frontend
```bash
VITE_API_URL=https://your-api.onrender.com
```

### Update API CORS
In your cloud platform dashboard, set:
```bash
ALLOWED_ORIGINS=https://your-frontend.vercel.app
```

---

## 📊 Cost Estimation

### Free Tier Deployment
| Service | Provider | Cost |
|---------|----------|------|
| API | Render | Free (750 hrs/month) |
| Database | Render PostgreSQL | Free (90 days) |
| Frontend | Vercel | Free |
| **Total** | | **$0/month** |

### Production (Paid)
| Service | Provider | Cost |
|---------|----------|------|
| API | Render Starter | $7/month |
| Database | Render PostgreSQL | $7/month |
| ClickHouse | ClickHouse Cloud | $10/month |
| Frontend | Vercel Pro | $20/month |
| **Total** | | **~$44/month** |

---

## 🔍 Troubleshooting

### Build Fails: "go: no matching versions"
**Solution**: Ensure `api/go.mod` specifies Go 1.24
```go
go 1.24.0
```

### Database Connection Timeout
**Solution**: Check if database is in same region as API
```bash
# In Render dashboard, both should be in same region (e.g., Oregon)
```

### Health Check Fails
**Solution**: Verify health endpoint is accessible
```bash
curl https://your-app.onrender.com/v1/health -v
```

### CORS Errors in Frontend
**Solution**: Add frontend URL to `ALLOWED_ORIGINS`
```bash
ALLOWED_ORIGINS=https://your-frontend.vercel.app,https://www.your-frontend.vercel.app
```

---

## 🎯 Production Checklist

- [ ] Use strong `JWT_SECRET` (32+ characters)
- [ ] Enable HTTPS (automatic on Render/Vercel)
- [ ] Set `GIN_MODE=release`
- [ ] Configure proper `ALLOWED_ORIGINS`
- [ ] Enable database backups
- [ ] Set up monitoring (Render has built-in metrics)
- [ ] Configure custom domain (optional)
- [ ] Add health check alerts

---

## 📚 Platform-Specific Docs

- [Render Docker Deployment](https://render.com/docs/deploy-docker)
- [Zeabur Deployment Guide](https://zeabur.com/docs/deploy/dockerfile)
- [Railway Docker Guide](https://docs.railway.app/deploy/dockerfiles)
- [Fly.io Dockerfile](https://fly.io/docs/languages-and-frameworks/dockerfile/)

---

## 🆘 Support

- GitHub Issues: https://github.com/kest-labs/kest/issues
- Discord: https://kest.dev/discord
- Email: support@kest.dev
