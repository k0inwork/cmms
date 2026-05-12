# Documentation Correctness Audit

**Date:** 2026-05-12
**Scope:** All MVP documentation and presentation files compared against the implemented codebase.

---

## 1. Tech Stack Misrepresentation (HIGH)

Every doc and presentation claims a stack that doesn't match the codebase.

| Component | Documented As | Actual Implementation |
|-----------|--------------|----------------------|
| API Framework | Fastify / NestJS | Hono |
| Auth | Keycloak / Auth0 | Custom JWT (access 15m, refresh 7d) |
| Frontend | React + Vite PWA | Next.js 14 App Router |
| File Storage | S3 / MinIO (presigned URLs) | Not implemented (evidence stores URLs only) |
| Job Queue | Redis / BullMQ | Not implemented |
| Real-time | WebSocket / Socket.IO | Not implemented |
| Mobile | React Native + Expo (Phase 3) | Not implemented (responsive web only) |
| ORM choice | Prisma or Drizzle | Prisma (remove ambiguity) |

**Affected files:**

- `docs/proposal.md` — Section 18 tech stack table, offline architecture diagram
- `docs/developer-briefing.md` — Architecture diagram, tech stack table, API design section
- `docs/presentation.html` — Architecture SVG, tech stack table, deployment topology SVG, security model slide
- `docs/MVP_Design.md` — Design principles, main modules section

---

## 2. Presentation Architecture Shows Nonexistent Components (HIGH)

The architecture SVG and deployment topology SVG in `presentation.html` show components that don't exist:

- **Keycloak** container — doesn't exist, auth is custom JWT
- **MinIO/S3** container — doesn't exist, no file storage
- **Redis** container — doesn't exist, no job queue
- **"REST + WebSocket"** label — WebSocket not implemented
- **"React + Vite PWA"** label — actual is Next.js 14
- **"Node.js + Fastify"** label — actual is Hono
- Docker Compose shows 6 services — actual `docker-compose.yml` has 3 (postgres, api, pgadmin)

---

## 3. Role Count Discrepancies (HIGH)

| Source | Roles Listed | Count |
|--------|-------------|-------|
| `proposal.md` section 5 | Field Tech, QA, Dispatcher, Ops Manager, Customer User, Admin, HR Coordinator | 7 |
| `developer-briefing.md` | Same roles including Customer User | 6 |
| `presentation.html` security slide | Claims "6 roles" | 6 |
| **Actual Prisma enum** | TECHNICIAN, DISPATCHER, QA_REVIEWER, OPERATIONS_MANAGER, ADMINISTRATOR | 5 |

Missing from implementation: **Customer User** (read-only), **HR/Workforce Coordinator**

---

## 4. Seed Data Domain Mismatch (MEDIUM)

- `docs/MVP_Database_Schema.md` references `admin@aerowind.dev`
- Actual seed data uses `admin@cmms.test`
- Domain `aerowind.dev` used as fictional company name throughout docs but doesn't match seeded data

---

## 5. User Stories Describe Unimplemented Features (MEDIUM)

| Story ID | Feature | Status |
|----------|---------|--------|
| MOB-04 | QR code scanning for asset identification | Not implemented |
| MOB-06 | PWA install prompt on mobile | Not implemented (no PWA) |
| ADMIN-04 | Drag-drop template builder | Not implemented |
| EVID-04 | Evidence photo annotations/markup | Not implemented |
| EVID-06 | Evidence versioning/history | Not implemented |
| NFR-03 | Local storage encryption for offline data | Not implemented |

---

## 6. Data Model Entities That May Not Exist (MEDIUM)

The `presentation.html` data model SVG shows:

- **"Measurement"** entity — verify against Prisma schema
- **"Approval"** entity — verify against Prisma schema
- **"Attachment"** entity — actual schema uses `WorkOrderEvidence` instead

---

## 7. Internal Consistency Issues (LOW)

1. `proposal.md` — Says "Prisma or Drizzle" — actual is Prisma only
2. `proposal.md` — Says "S3-compatible (MinIO or AWS S3)" — not implemented
3. `proposal.md` — Says "Keycloak or Auth0" — actual is custom JWT
4. `developer-briefing.md` — Claims "Presigned upload URLs" API endpoint — not implemented
5. `developer-briefing.md` — Claims "WebSocket events" — not implemented
6. `MVP_Design.md` — Claims "MVP uses IndexedDB + Service Worker (PWA)" — no PWA, uses Next.js SSR
7. `MVP_Design.md` — Claims "Single React codebase shared with the web portal" — actual is Next.js

---

## Files With No Issues

- `MVP_Testing_Strategy.md` — brief, internally consistent
- `MVP_Test_Specification.md` — 76 test cases, internally consistent with user stories
- `MVP_Database_Schema.md` — 29 models match actual Prisma schema
- `MVP_Implementation_Phases.md` — phase structure is fine (no tech stack claims)
- `testing-presentation.html` — internally consistent
- `user-stories-slides.html` — internally consistent

---

## Recommended Fix Order

1. Fix tech stack tables in proposal, briefing, presentation, MVP_Design
2. Update presentation SVG diagrams to reflect actual architecture
3. Remove or mark Customer User and HR roles as Phase 2+
4. Align seed data domain references
5. Mark unimplemented user stories as Phase 2+
