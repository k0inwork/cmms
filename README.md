# Wind Turbine CMMS Platform

A full-stack **Computerized Maintenance Management System (CMMS)** built for remote wind-turbine inspection and field-service operations. The platform lets field teams capture inspection data, attach photographic and sensor evidence, manage defect tickets through their full lifecycle, dispatch technicians based on availability and skills, and track maintenance work orders — all with offline-first design principles.

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Local Development (without Docker)](#local-development-without-docker)
  - [Docker Compose (full stack)](#docker-compose-full-stack)
- [Environment Variables](#environment-variables)
- [Database](#database)
- [API Reference](#api-reference)
- [Frontend (GUI)](#frontend-gui)
- [Testing](#testing)
- [CI/CD](#cicd)
- [Deployment](#deployment)
- [Documentation](#documentation)
- [License](#license)

---

## Overview

Wind farms operate in remote, harsh environments where reliable maintenance tracking is critical. This CMMS platform provides:

- **Asset hierarchy management** — Organizations → Sites → Turbines → Subsystems → Components
- **Structured inspections** — Versioned templates with typed fields, assigned to qualified technicians
- **Defect-to-resolution workflow** — Defects found during inspections automatically become tickets, which flow through triage, assignment, work orders, and closure
- **Technician dispatch** — Skill-based matching, availability/absence tracking, SLA risk monitoring, and automatic replacement suggestions when technicians become unavailable
- **Evidence management** — Photo, video, PDF, and sensor-export uploads with annotations, QA review, and approval workflows
- **Offline sync** — Conflict-aware synchronization for field devices operating without connectivity
- **Audit trail** — Every significant action is logged for compliance and traceability

---

## Key Features

| Domain | Capabilities |
|---|---|
| **Asset Management** | Hierarchical asset registry (org → site → turbine → subsystem → component), status tracking, maintenance history |
| **Inspections** | Template-based inspections with versioning, field-level data capture, defect recording, status workflow (assigned → submitted → approved/rejected) |
| **Ticketing** | Full lifecycle (new → triaged → assigned → in progress → pending review → closed), priority/severity classification, SLA tracking, reopen support |
| **Work Orders** | Linked to tickets, time tracking, parts/labor logging, technician assignment |
| **Dispatch** | Coverage analysis by site, skill-based technician matching, SLA risk dashboard, manual assignment with audit trail |
| **Technician Management** | Availability slots, absence records, skill & certification tracking, status tracking (available, traveling, on-site, etc.) |
| **Evidence** | Upload (local file or URL), type classification, annotations, QA approval/flagging, linked to inspections and tickets |
| **Search** | Global full-text search across organizations, sites, turbines, tickets, and users |
| **Reports** | Ticket status summaries, inspection completion rates, technician utilization, SLA compliance |
| **Admin** | User CRUD, role management (5 roles), skill/certification catalog, workflow rules |
| **Audit** | Timestamped audit events for all write operations, filterable by entity, action, and user |
| **Sync** | Offline-first sync events with conflict detection and resolution |
| **Auth** | JWT access + refresh tokens, role-based access control, secure password hashing |

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Runtime** | Node.js 22 |
| **API Framework** | [Hono](https://hono.dev/) |
| **Language** | TypeScript (ES2022, strict mode) |
| **Database** | PostgreSQL 16 |
| **ORM** | [Prisma](https://www.prisma.io/) (29 models) |
| **Validation** | [Zod](https://zod.dev/) |
| **Auth** | JWT (access + refresh tokens), bcrypt password hashing |
| **Frontend** | Next.js 14, React 18, Tailwind CSS, Lucide icons |
| **Testing** | [Vitest](https://vitest.dev/) (unit + integration) |
| **Containerization** | Docker, Docker Compose |
| **CI** | GitHub Actions |

---

## Project Structure

```
cmms/
├── src/                        # Backend source code
│   ├── index.ts                # Hono app entry point, route mounting, middleware
│   ├── routes/                 # REST API route handlers
│   │   ├── auth.ts             # Login, refresh, logout, me
│   │   ├── organizations.ts    # Organization CRUD
│   │   ├── sites.ts            # Site CRUD (nested under orgs)
│   │   ├── turbines.ts         # Turbine CRUD (nested under sites)
│   │   ├── subsystems.ts       # Subsystem CRUD (nested under turbines)
│   │   ├── components.ts       # Component CRUD (nested under subsystems)
│   │   ├── assets.ts           # Cross-cutting asset queries
│   │   ├── inspections.ts      # Inspection records & workflows
│   │   ├── inspection-templates.ts  # Versioned inspection templates
│   │   ├── tickets.ts          # Defect ticket lifecycle
│   │   ├── work-orders.ts      # Work order management
│   │   ├── technicians.ts      # Availability, absences, assignments
│   │   ├── dispatch.ts         # Coverage analysis, SLA risk, assignment
│   │   ├── evidence.ts         # Evidence upload, annotations, QA review
│   │   ├── replacements.ts     # Technician replacement suggestions
│   │   ├── search.ts           # Global search
│   │   ├── reports.ts          # Reporting endpoints
│   │   ├── audit.ts            # Audit log queries
│   │   ├── sync.ts             # Offline sync events
│   │   ├── admin.ts            # User, skill, cert, workflow-rule management
│   │   └── showcase.ts         # Demo scenario runner
│   ├── middleware/
│   │   ├── auth.ts             # JWT verification, role guards
│   │   └── production.ts       # CORS, rate limiting, structured logging, security headers
│   ├── lib/
│   │   └── prisma.ts           # Prisma client singleton
│   └── utils/
│       ├── errors.ts           # Custom error types
│       ├── jwt.ts              # Token signing & verification
│       ├── pagination.ts       # Cursor-based pagination helpers
│       ├── password.ts         # bcrypt hashing
│       └── validate.ts         # Shared Zod schemas
├── gui/                        # Next.js frontend
│   ├── src/app/                # App router pages
│   └── src/components/         # Shared UI components
├── prisma/
│   ├── schema.prisma           # Database schema (29 models, 13 enums)
│   ├── migrations/             # Migration history
│   └── seed.ts                 # Realistic seed data (orgs, sites, turbines, users, etc.)
├── tests/
│   ├── routes/                 # Unit tests (mock-based, London School)
│   ├── integration/            # Integration tests (real DB)
│   ├── e2e/                    # End-to-end scenario tests
│   └── utils/                  # Utility tests
├── scripts/
│   └── showcase/               # Demo scenario scripts
├── docs/                       # Design docs, specs, presentations
├── docker-compose.yml          # Full stack: API + PostgreSQL + pgAdmin
├── Dockerfile                  # Multi-stage production build
└── .github/
    └── ci.yml                  # CI pipeline (lint, build, test, docker)
```

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 22
- **npm** (comes with Node.js)
- **PostgreSQL** 16+ (or use Docker Compose)

### Local Development (without Docker)

**1. Clone the repository**

```bash
git clone https://github.com/k0inwork/cmms.git
cd cmms
```

**2. Install dependencies**

```bash
npm install
```

**3. Configure environment**

```bash
cp .env.example .env
```

Edit `.env` and set your PostgreSQL connection string:

```env
DATABASE_URL="postgresql://cmms:cmms@localhost:5432/cmms?schema=public"
PORT=3000
NODE_ENV=development
JWT_SECRET=change-me-in-production
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
```

**4. Set up the database**

```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Seed with realistic demo data
npm run db:seed
```

**5. Start the dev server**

```bash
npm run dev
```

The API will be running at `http://localhost:3000`. Verify with:

```bash
curl http://localhost:3000/health
# → {"status":"healthy","timestamp":"..."}
```

**6. (Optional) Start the frontend**

```bash
cd gui
npm install
npm run dev
```

The frontend will be running at `http://localhost:3001`.

### Docker Compose (full stack)

This starts the API, PostgreSQL, and pgAdmin in one command:

```bash
docker compose up --build
```

| Service | URL | Credentials |
|---|---|---|
| **API** | http://localhost:3000 | — |
| **pgAdmin** | http://localhost:5050 | `admin@cmms.local` / `admin` |
| **PostgreSQL** | localhost:5432 | `cmms` / `cmms` |

To run migrations inside Docker:

```bash
docker compose exec api npx prisma migrate deploy
```

To seed the database:

```bash
docker compose exec api npx tsx prisma/seed.ts
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | — | PostgreSQL connection string |
| `PORT` | `3000` | Server port |
| `NODE_ENV` | `development` | Environment (`development`, `production`, `test`) |
| `JWT_SECRET` | — | Secret key for JWT signing (change in production!) |
| `JWT_ACCESS_EXPIRY` | `15m` | Access token lifetime |
| `JWT_REFRESH_EXPIRY` | `7d` | Refresh token lifetime |

---

## Database

The database schema contains **29 models** and **13 enums** managed by Prisma.

### Key Models

- **Organization / Site / Turbine / Subsystem / Component** — hierarchical asset tree
- **User** — with roles: `TECHNICIAN`, `DISPATCHER`, `QA_REVIEWER`, `OPERATIONS_MANAGER`, `ADMINISTRATOR`
- **Skill / Certification / UserSkill / UserCertification** — competency tracking
- **InspectionTemplate / InspectionTemplateVersion** — versioned inspection forms
- **InspectionRecord / InspectionFieldData / Defect** — captured inspection data
- **Ticket / WorkOrder** — defect tracking and maintenance work
- **EvidenceItem / EvidenceAnnotation** — uploaded evidence with QA workflow
- **AvailabilitySlot / AbsenceRecord / Assignment / ReplacementSuggestion** — dispatch & scheduling
- **AuditEvent / SyncEvent** — compliance and offline sync

### Useful Commands

```bash
npm run db:generate    # Regenerate Prisma client after schema changes
npm run db:migrate     # Create and apply a new migration
npm run db:seed        # Seed the database with demo data
npm run db:studio      # Open Prisma Studio (visual DB browser)
npm run db:reset       # Reset DB: drop all data, re-run migrations, re-seed
```

---

## API Reference

The API is REST-based, JSON-encoded, and uses cursor-based pagination. All write endpoints require JWT authentication via `Authorization: Bearer <token>`.

### Authentication

```
POST   /auth/login          # Returns access + refresh tokens
POST   /auth/refresh         # Refresh an expired access token
POST   /auth/logout          # Revoke refresh token
GET    /auth/me              # Current user profile
```

### Asset Hierarchy

```
GET|POST           /organizations
GET|PATCH|DELETE   /organizations/:orgId
GET|POST           /organizations/:orgId/sites
GET|PATCH|DELETE   /organizations/:orgId/sites/:siteId
GET|POST           /organizations/:orgId/sites/:siteId/turbines
GET|PATCH|DELETE   /organizations/:orgId/sites/:siteId/turbines/:turbineId
GET|POST           /organizations/:orgId/sites/:siteId/turbines/:turbineId/subsystems
GET|PATCH|DELETE   /organizations/:orgId/sites/:siteId/turbines/:turbineId/subsystems/:subId/components
```

### Inspections

```
GET|POST           /templates                       # Inspection templates
GET|PATCH|DELETE   /templates/:id
GET|POST           /templates/:id/versions           # Template versioning
GET|POST           /inspections                      # Inspection records
GET                /inspections/:id
PUT                /inspections/:id/submit|approve|reject
```

### Tickets & Work Orders

```
GET|POST           /tickets
GET|PATCH          /tickets/:id
POST               /tickets/:id/triage|assign|close|reopen
GET|POST           /work-orders
GET|PATCH          /work-orders/:id
```

### Dispatch & Technicians

```
GET    /dispatch/coverage     # Site coverage analysis
GET    /dispatch/sla-risk     # At-risk tickets
POST   /dispatch/assign       # Assign technician to ticket
GET    /technicians           # List with availability
GET    /technicians/:id/availability
POST   /technicians/:id/availability
POST   /technicians/:id/absences
GET    /replacements           # Replacement suggestions
```

### Evidence

```
POST   /evidence/upload-url    # Get upload URL
POST   /evidence               # Create evidence record
GET    /evidence               # List evidence
GET    /evidence/:id
POST   /evidence/:id/annotations
PUT    /evidence/:id/approve|flag
```

### Other

```
GET    /search?q=...           # Global search
GET    /reports/...            # Reporting endpoints
GET    /audit                  # Audit log
GET    /sync                   # Sync events
GET    /admin/...              # User, skill, cert management (admin only)
GET    /assets                 # Cross-cutting asset search
GET    /health                 # Health check
```

### Seed User Credentials

After running `npm run db:seed`, you can log in with:

- **Password for all users:** `Password123!`
- **Email pattern:** `{firstname}.{lastname}@{org-slug}.cmms.local`

Check the seed output or Prisma Studio for specific emails.

---

## Frontend (GUI)

The frontend is a Next.js 14 application in the `gui/` directory with:

- **Dashboard** with role-aware views (technician mobile view, dispatcher overview, admin panels)
- **Inspection detail pages** with field data and evidence
- **Ticket management** with lifecycle actions
- **Technician scheduling** and absence management
- **Admin panel** with user management, skills/certifications catalog, and showcase demos
- **Global search** across all entities
- **QA review** and **escalation** workflows
- **Responsive design** using Tailwind CSS

### Running the Frontend

```bash
cd gui
npm install
npm run dev      # → http://localhost:3001
```

The frontend expects the API at `http://localhost:3000` by default.

---

## Testing

The project uses [Vitest](https://vitest.dev/) with three test tiers:

### Unit Tests (mock-based)

Located in `tests/routes/` and `tests/utils/`. These mock Prisma and test route handlers in isolation (London School style).

```bash
npm test
```

### Integration Tests

Located in `tests/integration/`. These run against a real PostgreSQL database.

```bash
# Requires a running PostgreSQL instance
npm run test:integration
```

### End-to-End Scenario Tests

Located in `tests/e2e/`. These test complete workflows like inspection-to-ticket resolution, absence-triggered reassignment, and sync conflict handling.

```bash
npm test          # Included in the default test suite
```

### Watch Mode

```bash
npm run test:watch
```

---

## CI/CD

GitHub Actions runs on every push and PR to `main`:

| Job | What it does |
|---|---|
| **Lint** | TypeScript type checking (`tsc --noEmit`) |
| **Build** | Compiles TypeScript to `dist/` |
| **Unit Tests** | Runs `npm test` with mocked dependencies |
| **Integration Tests** | Spins up PostgreSQL service, runs migrations, runs integration suite |
| **Docker Build** | Builds the production Docker image and verifies it starts |

---

## Deployment

### Production Build

```bash
npm run build
npm run db:migrate:prod    # Apply migrations without creating new ones
npm start                  # Starts from dist/index.js
```

### Docker Production

```bash
docker build -t cmms-api .
docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://..." \
  -e JWT_SECRET="your-production-secret" \
  -e NODE_ENV=production \
  cmms-api
```

The Dockerfile uses a multi-stage build (builder → runner) with a non-root user for security.

---

## Documentation

Detailed design documents are available in `docs/`:

- **[MVP Requirements](docs/MVP_Requirements.md)** — Functional and non-functional requirements
- **[MVP Design](docs/MVP_Design.md)** — Architecture and design decisions
- **[Database Schema](docs/MVP_Database_Schema.md)** — Full schema documentation
- **[API Specification](docs/MVP_API_Specification.md)** — Detailed endpoint specifications
- **[User Stories](docs/MVP_User_Stories.md)** — User stories and acceptance criteria
- **[Testing Strategy](docs/MVP_Testing_Strategy.md)** — Test approach and coverage goals
- **[Test Specification](docs/MVP_Test_Specification.md)** — Detailed test cases
- **[Deployment Guide](docs/MVP_Deployment_Guide.md)** — Production deployment instructions
- **[Implementation Phases](docs/MVP_Implementation_Phases.md)** — Development roadmap
- **[E2E Test Chains](docs/E2E_Test_Chains.md)** — End-to-end scenario documentation

---

## License

This project is private. All rights reserved.
