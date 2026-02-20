# ===========================================
# Kest API - Production Dockerfile (API Only)
# For cloud platforms: Render, Zeabur, Railway, etc.
# ===========================================

# Stage 1: Download Go dependencies (cache layer)
FROM golang:1.24-alpine AS go-deps
RUN apk add --no-cache git ca-certificates
WORKDIR /build
COPY api/go.mod api/go.sum ./
RUN go mod download

# Stage 2: Build Go binary
FROM go-deps AS builder
WORKDIR /build
COPY api/ ./
RUN CGO_ENABLED=0 GOOS=linux go build \
    -ldflags="-s -w" \
    -o kest-api \
    ./cmd/api/main.go

# Stage 3: Runtime (minimal)
FROM alpine:latest

LABEL maintainer="Kest Labs <team@kest.dev>"

RUN apk --no-cache add ca-certificates tzdata curl

ENV TZ=Asia/Shanghai

RUN addgroup -S appgroup && adduser -S appuser -G appgroup
RUN mkdir -p /app/config /app/logs /app/storage
WORKDIR /app

COPY --from=builder /build/kest-api .

RUN chown -R appuser:appgroup /app

USER appuser

# Port from environment variable (Render/Zeabur auto-inject PORT)
EXPOSE ${PORT:-8025}

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:${PORT:-8025}/v1/health || exit 1

CMD ["./kest-api"]
