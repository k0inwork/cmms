# MVP Deployment Guide

Wind-turbine CMMS/FSM/EAM Platform — from zero to running system.

---

## 1. Architecture Overview

```
┌──────────────┐       ┌───────────────────────────────────────────────────┐
│              │       │                    API Server                     │
│   PWA Client │──────▶│           (Fastify / NestJS)                     │
│  (React+Vite)│◀──────│  :3000                                           │
│              │  WS   │    ├── Prisma ORM ──────▶ PostgreSQL :5432      │
└──────────────┘       │    ├── BullMQ ──────────▶ Redis :6379           │
                       │    ├── S3 SDK ─────────▶ MinIO :9000            │
                       │    ├── Keycloak Admin ─▶ Keycloak :8080         │
                       │    └── OTel SDK ───────▶ OTel Collector :4317   │
                       └───────────────────────────────────────────────────┘
                                                       │
                                               ┌───────▼───────┐
                                               │   Grafana      │
                                               │   :3100        │
                                               └───────────────┘
```

### Service Ports

| Service | Port | Purpose |
|---------|------|---------|
| API | 3000 | REST + WebSocket API |
| PostgreSQL | 5432 | Primary database |
| Redis | 6379 | Job queue + cache |
| MinIO (API) | 9000 | S3-compatible object storage |
| MinIO (Console) | 9001 | MinIO admin UI |
| Keycloak | 8080 | Authentication / RBAC |
| OTel Collector | 4317 | Telemetry ingestion (gRPC) |
| OTel Collector | 4318 | Telemetry ingestion (HTTP) |
| Grafana | 3100 | Monitoring dashboards |

---

## 2. Prerequisites

### System Requirements (Single-Server MVP)

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 2 cores | 4 cores |
| RAM | 4 GB | 8 GB |
| Disk | 40 GB SSD | 80 GB SSD |
| OS | Ubuntu 22.04 / Debian 12 | Ubuntu 22.04 LTS |

### Software

```bash
# Docker Engine 24+
docker --version

# Docker Compose v2 (plugin)
docker compose version

# Node.js 20 LTS
node --version   # v20.x

# npm 10+
npm --version
```

Install Docker and Compose if missing:
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Log out and back in for group change
```

Install Node.js via nvm:
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
```

### Domain and TLS

For production, you need:
- A domain name pointing to the server IP (e.g., `cmms.example.com`, `api.cmms.example.com`)
- DNS A records for each subdomain

### DNS Configuration

```
# A records — point all to the server IP
cmms.example.com          A    <SERVER_IP>
api.cmms.example.com      A    <SERVER_IP>
auth.cmms.example.com     A    <SERVER_IP>
minio.cmms.example.com    A    <SERVER_IP>
grafana.cmms.example.com  A    <SERVER_IP>
```

For local development, add entries to `/etc/hosts`:
```
127.0.0.1 api.localhost auth.localhost minio.localhost grafana.localhost
```

---

## 3. Environment Variables

Create a `.env` file in the project root. **Never commit this file.**

```bash
# =============================================================================
# API Server
# =============================================================================
NODE_ENV=production                        # production | development | test
PORT=3000                                  # Required — API listen port
DATABASE_URL=postgresql://cmms:changeme@postgres:5432/cmms  # Required
JWT_SECRET=changeme-use-a-64-char-random-string             # Required
CORS_ORIGIN=https://cmms.example.com       # Required — PWA origin
LOG_LEVEL=info                             # Optional — debug | info | warn | error (default: info)
API_BASE_URL=https://api.cmms.example.com  # Required — public-facing URL

# =============================================================================
# Database — PostgreSQL
# =============================================================================
POSTGRES_USER=cmms                         # Required
POSTGRES_PASSWORD=changeme-use-strong-password             # Required
POSTGRES_DB=cmms                           # Required
POSTGRES_PORT=5432                         # Optional (default: 5432)

# =============================================================================
# S3 / MinIO — Object Storage
# =============================================================================
S3_ENDPOINT=http://minio:9000              # Required — internal Docker URL
S3_ACCESS_KEY=minioadmin                   # Required
S3_SECRET_KEY=minioadmin                   # Required — change for production
S3_BUCKET_NAME=cmms-evidence               # Required
S3_REGION=us-east-1                        # Optional (default: us-east-1)
S3_PUBLIC_URL=https://minio.cmms.example.com  # Required — public-facing URL for presigned links

# =============================================================================
# Redis
# =============================================================================
REDIS_URL=redis://redis:6379               # Required

# =============================================================================
# Keycloak — Authentication
# =============================================================================
KEYCLOAK_AUTH_SERVER_URL=https://auth.cmms.example.com  # Required
KEYCLOAK_REALM=cmms                        # Required
KEYCLOAK_CLIENT_ID=cmms-api                # Required
KEYCLOAK_CLIENT_SECRET=changeme            # Required — from Keycloak admin
KEYCLOAK_ADMIN_USER=admin                  # Required — initial admin
KEYCLOAK_ADMIN_PASSWORD=changeme           # Required — initial admin password

# =============================================================================
# BullMQ — Background Jobs
# =============================================================================
BULLMQ_REDIS_URL=redis://redis:6379        # Optional — defaults to REDIS_URL
BULLMQ_CONCURRENCY=5                       # Optional (default: 5)

# =============================================================================
# Monitoring — OpenTelemetry
# =============================================================================
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4317  # Optional
OTEL_SERVICE_NAME=cmms-api                 # Optional (default: cmms-api)
OTEL_TRACES_ENABLED=true                   # Optional (default: true)
OTEL_METRICS_ENABLED=true                  # Optional (default: true)

# =============================================================================
# File Upload Limits
# =============================================================================
MAX_FILE_SIZE_MB=500                       # Optional (default: 500)
THUMBNAIL_SIZE_PX=800                      # Optional (default: 800)
VIDEO_PREVIEW_HEIGHT=720                   # Optional (default: 720)
```

Generate secure secrets:
```bash
openssl rand -base64 48    # For JWT_SECRET
openssl rand -base64 24    # For passwords
```

---

## 4. Docker Compose Configuration

Save as `docker-compose.yml` in the project root:

```yaml
version: "3.9"

services:
  # ── API Server ────────────────────────────────────────────────────────────
  api:
    build:
      context: .
      dockerfile: Dockerfile
      target: production
    container_name: cmms-api
    restart: unless-stopped
    ports:
      - "3000:3000"
    env_file: .env
    environment:
      - DATABASE_URL=postgresql://${POSTGRES_USER:-cmms}:${POSTGRES_PASSWORD:-changeme}@postgres:5432/${POSTGRES_DB:-cmms}
      - REDIS_URL=redis://redis:6379
      - S3_ENDPOINT=http://minio:9000
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      minio:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 30s
    deploy:
      resources:
        limits:
          cpus: "2.0"
          memory: 1G
        reservations:
          cpus: "0.5"
          memory: 256M
    networks:
      - cmms-net

  # ── PostgreSQL 15 ─────────────────────────────────────────────────────────
  postgres:
    image: postgres:15-alpine
    container_name: cmms-postgres
    restart: unless-stopped
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-cmms}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-changeme}
      POSTGRES_DB: ${POSTGRES_DB:-cmms}
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-cmms}"]
      interval: 10s
      timeout: 5s
      retries: 5
    deploy:
      resources:
        limits:
          cpus: "2.0"
          memory: 2G
        reservations:
          cpus: "0.25"
          memory: 512M
    networks:
      - cmms-net

  # ── Redis 7 ───────────────────────────────────────────────────────────────
  redis:
    image: redis:7-alpine
    container_name: cmms-redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
    volumes:
      - redisdata:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    deploy:
      resources:
        limits:
          cpus: "1.0"
          memory: 512M
        reservations:
          cpus: "0.1"
          memory: 64M
    networks:
      - cmms-net

  # ── MinIO (S3-Compatible Storage) ─────────────────────────────────────────
  minio:
    image: minio/minio:latest
    container_name: cmms-minio
    restart: unless-stopped
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      MINIO_ROOT_USER: ${S3_ACCESS_KEY:-minioadmin}
      MINIO_ROOT_PASSWORD: ${S3_SECRET_KEY:-minioadmin}
    command: server /data --console-address ":9001"
    volumes:
      - miniodata:/data
    healthcheck:
      test: ["CMD", "mc", "ready", "local"]
      interval: 10s
      timeout: 5s
      retries: 5
    deploy:
      resources:
        limits:
          cpus: "1.0"
          memory: 512M
        reservations:
          cpus: "0.1"
          memory: 128M
    networks:
      - cmms-net

  # ── Keycloak (Authentication) ─────────────────────────────────────────────
  keycloak:
    image: quay.io/keycloak/keycloak:23.0
    container_name: cmms-keycloak
    restart: unless-stopped
    ports:
      - "8080:8080"
    environment:
      KC_DB: postgres
      KC_DB_URL: jdbc:postgresql://postgres:5432/${POSTGRES_DB:-cmms}
      KC_DB_USERNAME: ${POSTGRES_USER:-cmms}
      KC_DB_PASSWORD: ${POSTGRES_PASSWORD:-changeme}
      KEYCLOAK_ADMIN: ${KEYCLOAK_ADMIN_USER:-admin}
      KEYCLOAK_ADMIN_PASSWORD: ${KEYCLOAK_ADMIN_PASSWORD:-changeme}
      KC_HEALTH_ENABLED: "true"
      KC_METRICS_ENABLED: "true"
    command: start-dev
    depends_on:
      postgres:
        condition: service_healthy
    healthcheck:
      test: ["CMD-SHELL", "exec 3<>/dev/tcp/127.0.0.1/8080;echo -e \"GET /health/ready HTTP/1.1\r\nhost: localhost\r\n\r\n\" >&3;if [ $? -eq 0 ];then echo 'Health check successful';exit 0;else echo 'Health check failed';exit 1;fi"]
      interval: 30s
      timeout: 10s
      retries: 5
      start_period: 60s
    deploy:
      resources:
        limits:
          cpus: "2.0"
          memory: 1G
        reservations:
          cpus: "0.5"
          memory: 512M
    networks:
      - cmms-net

  # ── OpenTelemetry Collector ───────────────────────────────────────────────
  otel-collector:
    image: otel/opentelemetry-collector-contrib:0.96.0
    container_name: cmms-otel
    restart: unless-stopped
    ports:
      - "4317:4317"   # gRPC
      - "4318:4318"   # HTTP
    volumes:
      - ./config/otel-collector.yaml:/etc/otelcol-contrib/config.yaml:ro
    depends_on:
      - grafana
    deploy:
      resources:
        limits:
          cpus: "0.5"
          memory: 256M
    networks:
      - cmms-net

  # ── Grafana (Monitoring Dashboards) ───────────────────────────────────────
  grafana:
    image: grafana/grafana:10.3.0
    container_name: cmms-grafana
    restart: unless-stopped
    ports:
      - "3100:3000"
    environment:
      GF_SECURITY_ADMIN_USER: admin
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_ADMIN_PASSWORD:-changeme}
      GF_AUTH_ANONYMOUS_ENABLED: "false"
    volumes:
      - grafanadata:/var/lib/grafana
      - ./config/grafana/provisioning:/etc/grafana/provisioning:ro
    deploy:
      resources:
        limits:
          cpus: "0.5"
          memory: 256M
    networks:
      - cmms-net

volumes:
  pgdata:
    driver: local
  redisdata:
    driver: local
  miniodata:
    driver: local
  grafanadata:
    driver: local

networks:
  cmms-net:
    driver: bridge
```

### API Dockerfile

Save as `Dockerfile` in the project root:

```dockerfile
# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

# ── Production stage ─────────────────────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app
RUN addgroup -g 1001 -S appgroup && adduser -S appuser -u 1001 -G appgroup
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
USER appuser
EXPOSE 3000
CMD ["node", "dist/main.js"]
```

---

## 5. Local Development Setup

### Clone and Install

```bash
git clone https://github.com/your-org/cmms.git
cd cmms

# Install all dependencies
npm install

# Copy environment template
cp .env.example .env
# Edit .env with local values
```

### Start Dependencies Only

Run PostgreSQL, Redis, MinIO, and Keycloak via Docker Compose, but keep the API running locally for hot reload:

```bash
docker compose up postgres redis minio keycloak -d
```

### Run API in Dev Mode

```bash
# Apply migrations
npx prisma migrate dev

# Seed database (creates test data + Keycloak test users)
npx prisma db seed

# Start API with hot reload
npm run dev
```

### Run Frontend in Dev Mode

```bash
cd packages/frontend  # or /frontend — adjust to project structure
npm install
npm run dev
```

The PWA dev server runs on `http://localhost:5173` with hot module replacement.

### Run Tests

```bash
# Unit tests
npm test

# Integration tests (requires Docker dependencies running)
npm run test:integration

# Lint
npm run lint

# Type-check
npx tsc --noEmit
```

---

## 6. Database Setup

### Prisma Commands

```bash
# Create a new migration after schema changes
npx prisma migrate dev --name describe_the_change

# Apply all pending migrations (use in CI/CD and production)
npx prisma migrate deploy

# Reset database (destroys all data — development only)
npx prisma migrate reset

# Generate Prisma Client after schema changes
npx prisma generate

# Open Prisma Studio (visual DB browser)
npx prisma studio

# Seed with test data
npx prisma db seed
```

### Backup Strategy

Daily `pg_dump` with upload to S3/MinIO:

```bash
#!/bin/bash
# scripts/backup-db.sh — run via cron at 02:00 daily
# crontab: 0 2 * * * /path/to/scripts/backup-db.sh

BACKUP_DIR=/tmp/cmms-backups
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME=cmms_${TIMESTAMP}.sql.gz

mkdir -p $BACKUP_DIR

# Dump and compress
docker exec cmms-postgres pg_dump -U cmms cmms | gzip > ${BACKUP_DIR}/${FILENAME}

# Upload to MinIO
docker exec cmms-api npx aws s3 cp ${BACKUP_DIR}/${FILENAME} s3://cmms-evidence/backups/${FILENAME} \
  --endpoint-url http://minio:9000

# Clean up local files older than 7 days
find $BACKUP_DIR -name "cmms_*.sql.gz" -mtime +7 -delete

echo "Backup completed: ${FILENAME}"
```

---

## 7. S3 / MinIO Setup

### Bucket Creation

```bash
# Install MinIO client
docker exec cmms-minio mc alias set local http://localhost:9000 minioadmin minioadmin

# Create the evidence bucket
docker exec cmms-minio mc mb local/cmms-evidence

# Set bucket policy for private access (default)
docker exec cmms-minio mc anonymous none local/cmms-evidence
```

Or automate in a startup script:

```bash
#!/bin/bash
# scripts/init-minio.sh
set -e

echo "Waiting for MinIO..."
until docker exec cmms-minio mc ready local 2>/dev/null; do sleep 2; done

docker exec cmms-minio mc alias set local http://localhost:9000 ${S3_ACCESS_KEY} ${S3_SECRET_KEY}

# Create bucket if it doesn't exist
docker exec cmms-minio mc mb --ignore-existing local/cmms-evidence

echo "MinIO bucket ready."
```

### CORS Configuration for Direct Uploads

Save as `config/minio-cors.json`:

```json
{
  "CORSRules": [
    {
      "AllowedHeaders": ["Content-Type", "x-amz-content-sha256", "Authorization"],
      "AllowedMethods": ["PUT", "GET", "POST", "DELETE"],
      "AllowedOrigins": ["https://cmms.example.com"],
      "ExposeHeaders": ["ETag", "x-amz-request-id"],
      "MaxAgeSeconds": 3600
    }
  ]
}
```

Apply:
```bash
docker exec cmms-minio mc cors set /path/to/minio-cors.json local/cmms-evidence
```

### Presigned URL Settings

The API generates presigned URLs for client-side direct uploads. Default settings:

- Upload URL expiry: 15 minutes
- Download URL expiry: 60 minutes
- Thumbnail URLs: generated server-side after upload completes via BullMQ worker

### Thumbnail Generation

A BullMQ worker processes uploaded files and creates thumbnails:

- Images: resized to 800px width (JPEG, quality 85)
- Videos: extracted frame at 1s, resized to 720p
- Thumbnails stored in the same bucket under `thumbnails/` prefix

---

## 8. Keycloak Setup

### Realm Creation

1. Open Keycloak Admin Console: `http://localhost:8080` (or `https://auth.cmms.example.com`)
2. Sign in with admin credentials from `.env`
3. Create a new realm: click the realm dropdown → **Create Realm** → Name: `cmms`

### Client Configuration for the API

1. Go to **Clients** → **Create client**
2. Set:
   - Client ID: `cmms-api`
   - Client authentication: **ON**
   - Authorization: **ON**
   - Valid redirect URIs: `https://cmms.example.com/*`
   - Web origins: `https://cmms.example.com`
   - Admin URL: `https://api.cmms.example.com`
3. After creation, go to **Credentials** tab → copy the **Client Secret** to `.env` as `KEYCLOAK_CLIENT_SECRET`

### Client Configuration for the PWA

1. Go to **Clients** → **Create client**
2. Set:
   - Client ID: `cmms-pwa`
   - Client authentication: **OFF** (public client — PWA is a SPA)
   - Standard flow: **ON**
   - Direct access grants: **ON**
   - Valid redirect URIs: `http://localhost:5173/*`, `https://cmms.example.com/*`
   - Web origins: `http://localhost:5173`, `https://cmms.example.com`

### Roles

Go to **Realm roles** and create:

| Role | Description |
|------|-------------|
| `technician` | Field technician — inspection capture, evidence upload |
| `dispatcher` | Dispatcher/planner — assignment, reassignment, scheduling |
| `qa-reviewer` | QA reviewer — validates inspections and evidence |
| `operations-manager` | Ops manager — dashboards, SLA monitoring, reports |
| `administrator` | Full system access |

### Test Users

Create test users under **Users** → **Add user**:

| Username | Email | Roles | Purpose |
|----------|-------|-------|---------|
| `tech.alice` | alice@example.com | technician | Field testing offline flow |
| `tech.bob` | bob@example.com | technician | Field testing sync |
| `dispatch.carol` | carol@example.com | dispatcher | Assignment testing |
| `qa.dave` | dave@example.com, qa-reviewer | Quality review testing |
| `ops.eve` | eve@example.com | operations-manager | Dashboard testing |
| `admin` | admin@example.com | administrator | Full access |

Set passwords under **Users → Credentials**. Toggle **Temporary** off for test accounts.

### Automate with Realm Export

After setup, export the realm configuration for reproducible deployments:

```bash
docker exec cmms-keycloak \
  /opt/keycloak/bin/kc.sh export \
  --realm cmms \
  --file /tmp/cmms-realm.json \
  --users realm_file

docker cp cmms-keycloak:/tmp/cmms-realm.json config/keycloak/cmms-realm.json
```

Import on fresh install:
```bash
docker exec cmms-keycloak \
  /opt/keycloak/bin/kc.sh import \
  --file /tmp/cmms-realm.json
```

---

## 9. CI/CD Pipeline (GitHub Actions)

### PR Workflow

Save as `.github/workflows/pr.yml`:

```yaml
name: PR Checks

on:
  pull_request:
    branches: [main, develop]

jobs:
  lint-and-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npx prisma generate
      - run: npm run lint
      - run: npx tsc --noEmit

  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npx prisma generate
      - run: npm test -- --coverage
      - uses: actions/upload-artifact@v4
        with:
          name: coverage
          path: coverage/

  integration-tests:
    runs-on: ubuntu-latest
    needs: [lint-and-typecheck]
    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: cmms_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npx prisma generate
      - run: npx prisma migrate deploy
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/cmms_test
      - run: npm run test:integration
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/cmms_test
          REDIS_URL: redis://localhost:6379
```

### Deploy Workflow

Save as `.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main, develop]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    outputs:
      image_tag: ${{ steps.meta.outputs.tags }}
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/metadata-action@v5
        id: meta
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=ref,event=branch
            type=sha,prefix=
      - uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy:
    runs-on: ubuntu-latest
    needs: build-and-push
    environment: ${{ github.ref == 'refs/heads/main' && 'production' || 'staging' }}
    steps:
      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SERVER_SSH_KEY }}
          script: |
            cd /opt/cmms
            docker compose pull api
            docker compose up -d api
            docker compose exec api npx prisma migrate deploy
```

### Required GitHub Secrets

| Secret | Description |
|--------|-------------|
| `SERVER_HOST` | Target server IP or hostname |
| `SERVER_USER` | SSH user (e.g., `deploy`) |
| `SERVER_SSH_KEY` | Private SSH key for deployment |
| `GITHUB_TOKEN` | Auto-provided — used for GHCR |

### Branch Strategy

| Branch | Environment | Trigger |
|--------|-------------|---------|
| `main` | Production | Push to main deploys to production server |
| `develop` | Staging | Push to develop deploys to staging server |
| `feature/*` | CI only | PR checks run; no deployment |

---

## 10. Monitoring and Observability

### OpenTelemetry Setup

Save as `config/otel-collector.yaml`:

```yaml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318

processors:
  batch:
    timeout: 10s
    send_batch_size: 1024

exporters:
  prometheus:
    endpoint: "0.0.0.0:8889"
  debug:
    verbosity: basic
  # For production, add exporters to Grafana Cloud, Jaeger, or Loki

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch]
      exporters: [debug]
    metrics:
      receivers: [otlp]
      processors: [batch]
      exporters: [prometheus, debug]
    logs:
      receivers: [otlp]
      processors: [batch]
      exporters: [debug]
```

### Grafana Dashboards

Create provisioning config at `config/grafana/provisioning/datasources/datasource.yml`:

```yaml
apiVersion: 1
datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://otel-collector:8889
    isDefault: true
  - name: Loki
    type: loki
    access: proxy
    url: http://loki:3100
```

#### Key Dashboards

**API Health**
- Request rate (req/s)
- Response time p50, p95, p99
- Error rate by status code
- Active WebSocket connections

**Sync Success Rate**
- Sync operations per minute
- Sync success / failure ratio
- Conflict resolution rate
- Pending sync queue depth

**Background Job Queue**
- Active / completed / failed jobs
- Queue wait time
- Retry count by job type
- Dead letter queue size

**Database Connections**
- Active connections vs pool size
- Query duration p95
- Slow queries (> 500ms)
- Migration status

### Alerting Rules

| Alert | Condition | Severity | Action |
|-------|-----------|----------|--------|
| HighErrorRate | 5xx rate > 5% for 5 min | Critical | Page on-call |
| SyncFailures | Sync failure rate > 10% for 10 min | Warning | Notify ops channel |
| DiskSpaceLow | Disk usage > 85% | Warning | Notify ops channel |
| SSLExpiry | Certificate expires < 14 days | Warning | Notify ops channel |
| DatabaseDown | PostgreSQL health check fails | Critical | Page on-call |
| QueueBacklog | BullMQ pending > 1000 for 15 min | Warning | Check worker health |

### Log Aggregation

For MVP, use Docker logs with structured JSON output:

```bash
# View API logs
docker compose logs -f api

# View all service logs
docker compose logs -f

# Filter by time
docker compose logs --since 30m api
```

For production, add Loki or a managed log service to aggregate and search logs centrally.

---

## 11. Backup and Recovery

### PostgreSQL Backup (Daily)

Automated via cron — see Section 6 for the backup script.

Retention: daily backups for 30 days, then weekly backups for 6 months.

### S3/MinIO Backup

Mirror bucket to a secondary location:

```bash
#!/bin/bash
# scripts/backup-minio.sh
docker exec cmms-minio mc mirror \
  --watch \
  --remove \
  local/cmms-evidence \
  local/cmms-evidence-backup
```

Or periodic snapshot:

```bash
# One-time full backup
docker exec cmms-minio mc cp --recursive \
  local/cmms-evidence \
  local/cmms-backup-$(date +%Y%m%d)
```

### Keycloak Realm Export

```bash
# Export realm with users
docker exec cmms-keycloak \
  /opt/keycloak/bin/kc.sh export \
  --realm cmms \
  --file /tmp/cmms-realm-backup.json \
  --users realm_file

docker cp cmms-keycloak:/tmp/cmms-realm-backup.json \
  backups/keycloak/cmms-realm-$(date +%Y%m%d).json
```

### Recovery Procedure

#### PostgreSQL Recovery

```bash
# 1. Stop the API to prevent writes
docker compose stop api

# 2. List available backups
docker exec cmms-minio mc ls local/cmms-evidence/backups/

# 3. Download the backup
docker exec cmms-minio mc cp \
  local/cmms-evidence/backups/cmms_YYYYMMDD_HHMMSS.sql.gz \
  /tmp/cmms_restore.sql.gz

# 4. Copy to host
docker cp cmms-minio:/tmp/cmms_restore.sql.gz /tmp/

# 5. Restore
gunzip -c /tmp/cmms_restore.sql.gz | \
  docker exec -i cmms-postgres psql -U cmms -d cmms

# 6. Restart the API
docker compose start api

# 7. Verify data integrity
docker exec cmms-api npx prisma db pull --print  # Compare schema
docker exec cmms-api curl -f http://localhost:3000/health
```

#### Full System Recovery (New Server)

```bash
# 1. Clone the repository
git clone https://github.com/your-org/cmms.git /opt/cmms
cd /opt/cmms

# 2. Restore .env from secure storage
cp /path/to/backup/.env .env

# 3. Start infrastructure services first
docker compose up postgres redis minio -d

# 4. Wait for health checks
docker compose ps  # All should show "healthy"

# 5. Restore database
gunzip -c /path/to/backup/cmms_YYYYMMDD.sql.gz | \
  docker exec -i cmms-postgres psql -U cmms -d cmms

# 6. Start Keycloak and import realm
docker compose up keycloak -d
# Wait for Keycloak to be ready
docker cp backups/keycloak/cmms-realm.json cmms-keycloak:/tmp/
docker exec cmms-keycloak /opt/keycloak/bin/kc.sh import --file /tmp/cmms-realm.json

# 7. Start remaining services
docker compose up -d

# 8. Run pending migrations
docker compose exec api npx prisma migrate deploy

# 9. Verify
curl -f http://localhost:3000/health
```

---

## 12. SSL / TLS

### Option A: Let's Encrypt with Certbot (Production)

```bash
# Install Certbot
sudo apt install -y certbot

# Obtain certificate (stop any service on port 80 first)
sudo certbot certonly --standalone \
  -d cmms.example.com \
  -d api.cmms.example.com \
  -d auth.cmms.example.com \
  -d minio.cmms.example.com \
  -d grafana.cmms.example.com

# Certificates saved to /etc/letsencrypt/live/cmms.example.com/
```

Auto-renewal cron:
```bash
# Add to crontab
0 3 * * * certbot renew --quiet --deploy-hook "docker compose restart nginx"
```

### Option B: Self-Signed (Internal / Staging)

```bash
# Generate self-signed certificate (valid 365 days)
openssl req -x509 -nodes -days 365 \
  -newkey rsa:2048 \
  -keyout config/certs/server.key \
  -out config/certs/server.crt \
  -subj "/CN=cmms.local" \
  -addext "subjectAltName=DNS:cmms.local,DNS:api.cmms.local,DNS:auth.cmms.local"
```

### Nginx Reverse Proxy

Add an Nginx service to `docker-compose.yml` for TLS termination:

```yaml
  # ── Nginx (TLS Termination) ──────────────────────────────────────────────
  nginx:
    image: nginx:alpine
    container_name: cmms-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./config/nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro
    depends_on:
      - api
      - keycloak
      - minio
      - grafana
    networks:
      - cmms-net
```

Save as `config/nginx/nginx.conf`:

```nginx
events {
    worker_connections 1024;
}

http {
    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=30r/s;
    limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/s;

    # API
    server {
        listen 443 ssl http2;
        server_name api.cmms.example.com;

        ssl_certificate /etc/letsencrypt/live/cmms.example.com/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/cmms.example.com/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;

        location / {
            limit_req zone=api burst=50 nodelay;
            proxy_pass http://api:3000;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # WebSocket
        location /ws {
            proxy_pass http://api:3000;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
        }
    }

    # Keycloak
    server {
        listen 443 ssl http2;
        server_name auth.cmms.example.com;

        ssl_certificate /etc/letsencrypt/live/cmms.example.com/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/cmms.example.com/privkey.pem;

        location / {
            limit_req zone=auth burst=10 nodelay;
            proxy_pass http://keycloak:8080;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }

    # MinIO Console
    server {
        listen 443 ssl http2;
        server_name minio.cmms.example.com;

        ssl_certificate /etc/letsencrypt/live/cmms.example.com/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/cmms.example.com/privkey.pem;

        location / {
            proxy_pass http://minio:9001;
            proxy_set_header Host $host;
        }
    }

    # Grafana
    server {
        listen 443 ssl http2;
        server_name grafana.cmms.example.com;

        ssl_certificate /etc/letsencrypt/live/cmms.example.com/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/cmms.example.com/privkey.pem;

        location / {
            proxy_pass http://grafana:3000;
            proxy_set_header Host $host;
        }
    }

    # PWA (static files served by API or separate container)
    server {
        listen 443 ssl http2;
        server_name cmms.example.com;

        ssl_certificate /etc/letsencrypt/live/cmms.example.com/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/cmms.example.com/privkey.pem;

        root /var/www/pwa;
        index index.html;

        location / {
            try_files $uri $uri/ /index.html;
        }

        # Service Worker — no cache
        location /sw.js {
            add_header Cache-Control "no-cache, no-store, must-revalidate";
        }
    }

    # HTTP → HTTPS redirect
    server {
        listen 80;
        server_name _;
        return 301 https://$host$request_uri;
    }
}
```

---

## 13. Scaling Notes (Post-MVP)

### When to Move from Docker Compose to Kubernetes

Consider migrating when:
- API needs horizontal scaling (> 1 replica)
- Zero-downtime deployments are required
- Multi-region deployment is needed
- Team grows beyond 5 developers with separate environments

### Horizontal API Scaling

- API is stateless — scale behind a load balancer
- WebSocket connections require sticky sessions (use Redis adapter for Socket.IO)
- Prisma connection pool: set `connection_limit` proportional to instances

### PostgreSQL Read Replicas

- Add read replicas for reporting queries and dashboard aggregation
- Configure Prisma with read/write routing:
  ```
  DATABASE_URL=postgresql://user:pass@pg-primary:5432/cmms
  DATABASE_READ_URL=postgresql://user:pass@pg-replica:5432/cmms
  ```

### CDN for Static Assets

- Serve PWA build, evidence thumbnails, and static files via CloudFront or Cloudflare
- Configure presigned URLs to use CDN domain
- Set cache headers: thumbnails = 7 days, app shell = no-cache

---

## 14. Troubleshooting

### Database Connection Refused

```bash
# Check if PostgreSQL is running and healthy
docker compose ps postgres

# Check logs
docker compose logs postgres

# Test connection
docker exec cmms-postgres pg_isready -U cmms

# Common fixes:
# 1. Wait longer — PostgreSQL needs 10-30s to start
# 2. Check POSTGRES_PASSWORD matches DATABASE_URL in .env
# 3. Ensure API's DATABASE_URL uses hostname "postgres" (Docker DNS), not "localhost"
```

### S3 Upload Failures

```bash
# Check MinIO health
docker compose ps minio
docker compose logs minio

# Test with mc client
docker exec cmms-minio mc ls local/cmms-evidence

# Common fixes:
# 1. Bucket doesn't exist — run scripts/init-minio.sh
# 2. Credentials mismatch — verify S3_ACCESS_KEY/SECRET_KEY match MinIO config
# 3. CORS error — verify config/minio-cors.json is applied
# 4. File too large — check MAX_FILE_SIZE_MB and nginx client_max_body_size
```

### Keycloak Token Issues

```bash
# Check Keycloak health
curl -f http://localhost:8080/health/ready

# Verify realm exists
curl -s http://localhost:8080/admin/realms \
  -H "Authorization: Bearer $(docker exec cmms-keycloak \
    /opt/keycloak/bin/kc.sh token --user admin --password changeme)" | jq '.[].realm'

# Common fixes:
# 1. Token expired — PWA should use silent refresh via refresh token
# 2. Wrong realm — verify KEYCLOAK_REALM in .env matches Keycloak realm name
# 3. Client not configured — verify KEYCLOAK_CLIENT_ID exists in Keycloak
# 4. Clock skew — ensure server time is synchronized (ntp)
```

### Redis Connection Issues

```bash
# Check Redis
docker exec cmms-redis redis-cli ping

# Check memory usage
docker exec cmms-redis redis-cli info memory

# Common fixes:
# 1. REDIS_URL must use "redis" hostname inside Docker, not "localhost"
# 2. If Redis OOM — increase maxmemory or switch eviction policy
# 3. BullMQ stuck jobs — clear: docker exec cmms-redis redis-cli FLUSHDB
```

### PWA Service Worker Not Updating

```bash
# Service Worker caches aggressively. Force update:
# 1. In browser: DevTools → Application → Service Workers → Update on reload
# 2. In browser: DevTools → Application → Cache Storage → Delete all caches
# 3. Check that sw.js response has Cache-Control: no-cache (see nginx config)
# 4. Increment cache version in service worker source code
# 5. Verify the HTML file fetches sw.js with a cache-busting query param
```

### Sync Conflicts Pileup

```bash
# Check conflict queue
curl -s http://localhost:3000/api/admin/sync/conflicts | jq

# Inspect individual conflict
curl -s http://localhost:3000/api/admin/sync/conflicts/{id} | jq

# Common fixes:
# 1. For field-level conflicts: QA reviewer resolves via the review UI
# 2. For safety-critical rejects: dispatcher reviews and manually re-submits
# 3. For stale conflicts (> 7 days): escalate to admin
# 4. If all conflicts are from one device: check device clock sync

# Purge resolved conflicts older than 30 days
curl -X DELETE http://localhost:3000/api/admin/sync/conflicts/purge
```
