# ── Stage 1: build ──────────────────────────────────────────────
FROM golang:1.22-alpine AS builder

RUN apk add --no-cache git ca-certificates

WORKDIR /app

# Copy module definition first.
# go mod tidy downloads deps AND writes go.sum inside the container,
# so no local go.sum is required in the repo.
COPY go.mod ./
RUN go mod download 2>/dev/null; true

# Copy source and build.
# go mod tidy re-resolves anything missing after go mod download.
COPY . .
RUN go mod tidy && \
    CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -ldflags="-w -s" -o /gateway ./cmd/server

# ── Stage 2: run ────────────────────────────────────────────────
FROM alpine:3.19

RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app
COPY --from=builder /gateway ./gateway

EXPOSE 8080

CMD ["./gateway"]
