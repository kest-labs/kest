# ===========================================
# Kest Platform - Multi-stage Dockerfile
# Build context: REPOSITORY ROOT (monorepo)
# Usage: docker build -t kest:latest .
# ===========================================

# Stage 1: Build frontend (dependency cache layer)
FROM node:20-alpine AS web-deps
WORKDIR /app/web
COPY web/package.json web/pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

FROM node:20-alpine AS web-builder
WORKDIR /app/web
COPY --from=web-deps /app/web/node_modules ./node_modules
COPY web/ .
RUN corepack enable && pnpm run build

# Stage 2: Download Go dependencies (dependency cache layer)
FROM golang:1.24-alpine AS go-deps
RUN apk add --no-cache git
WORKDIR /app
COPY api/go.mod api/go.sum ./
RUN go mod download

# Stage 3: Build Go binary (with embedded frontend)
FROM go-deps AS builder
WORKDIR /app
COPY api/ ./
COPY --from=web-builder /app/web/dist ./web/dist
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -ldflags="-s -w" -o kest-api ./cmd/server/main.go

# Stage 4: Runtime
FROM alpine:latest

LABEL maintainer="ZGO Team <team@eogo-dev.com>"

RUN apk --no-cache add ca-certificates tzdata curl

ENV TZ=Asia/Shanghai

RUN addgroup -S appgroup && adduser -S appuser -G appgroup
RUN mkdir -p /app/config /app/logs /app/storage
WORKDIR /app

COPY --from=builder /app/kest-api .

RUN chown -R appuser:appgroup /app

USER appuser

EXPOSE 8025

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8025/health || exit 1

CMD ["./kest-api"]
