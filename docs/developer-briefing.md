# Wind CMMS — Developer Briefing

A walkthrough of what we're building and why, for the engineering team.

---

## What We're Building

A centralized platform for a company that does remote robotic wind turbine inspection and repair. Technicians climb (or send robots up) turbines in offshore and rural wind farms, capture inspection data, and the system manages everything from scheduling to evidence to reporting.

This is **not** a standard CMMS. It's a **Hybrid Service-Asset Platform**:

```
CMMS logic   → maintain the robotic crawlers and inspection equipment
FSM engine   → dispatch crews to remote wind sites, manage travel, meet SLAs
EAM depth    → track long-term turbine health across the fleet
```

---

## The Problem Today

- Field teams use spreadsheets and email to coordinate inspections
- Photos and videos live on shared drives, not linked to assets or tickets
- When a technician calls in sick, there's no system to find a replacement — it's phone calls and Slack
- No offline capability — remote sites have unreliable connectivity
- No traceability from defect → inspection → repair → evidence → report

---

## Users

| Role | What They Do |
|---|---|
| **Field Technician** | Captures inspections, evidence, completion notes. Often offline. |
| **QA Reviewer** | Validates inspection quality, approves reports. |
| **Dispatcher / Planner** | Assigns work, handles substitutions, optimizes schedules. |
| **Operations Manager** | Monitors fleet status, SLA risk, workforce coverage. |
| **Admin** | Manages templates, roles, master data, workflow rules. |

> **Phase 2+:** Customer User (read-only reports), HR/Workforce Coordinator (absences, qualifications).

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│              Next.js 14 Web App (App Router)              │
│       (Admin Portal, Dispatch Board, Dashboard)          │
└──────────────────────┬──────────────────────────────────┘
                       │ REST API
┌──────────────────────┴──────────────────────────────────┐
│              API Server (TypeScript / Hono)              │
│    ┌──────────┬───────────┬──────────┬───────────────┐  │
│    │ Auth     │ Assets    │ Tickets  │ Workforce     │  │
│    │ (JWT)    │ (CRUD)    │(Lifecycle)│ (Skills, Abs)│  │
│    └──────────┴───────────┴──────────┴───────────────┘  │
│    ┌──────────┬───────────┬──────────┬───────────────┐  │
│    │ Evidence │ Inspect.  │ Sync     │ Reporting     │  │
│    │ (URLs)   │ Templates │ Engine   │ (CSV Export)  │  │
│    └──────────┴───────────┴──────────┴───────────────┘  │
└──────────────────────┬──────────────────────────────────┘
                       │
                  ┌────┴────┐
                  │PostgreSQL│
                  │(Primary) │
                  └─────────┘

Phase 2+: Real-time (WebSocket/SSE), File storage (S3/MinIO), Task queue (Redis/BullMQ)
Phase 3+: React Native + Expo + WatermelonDB (SQLite) — background sync, push, native hardware
```

---

## Core Data Model

Think of it as a tree with cross-links:

```
Organization
  └── Site (Wind Farm)
        ├── Turbine (WTG)          ← IEC 61400-25 / RDS-PP naming
        │     └── Subsystem (Gearbox, Blade, Yaw...)
        │           └── Component (Bearing, Trailing Edge...)
        │                 └── Defect
        └── Shift Assignment

User (Technician)
  ├── Role
  ├── Skills [M:N]             ← proficiency_level, acquired_date
  ├── Certifications [M:N]     ← expiry_date (GWO, industry certs)
  ├── Availability Slots
  ├── Absence Records
  └── Replacement Suggestions

Inspection Record
  ├── → Template (JSON schema)
  ├── → Technician (User)
  ├── → Turbine / Component
  ├── InspectionFieldData
  ├── Defects
  └── EvidenceItems

Work Order
  ├── → Turbine / Component
  ├── → Assignee (User)
  ├── Tickets
  │     ├── → Defect
  │     ├── TicketEvidence
  │     └── Audit Events
  └── WorkOrderEvidence

EvidenceItem
  ├── → Inspection or Work Order or Ticket (via junction tables)
  ├── → Author (User)
  ├── media_type, sync_status
  └── versioned (never deleted, superseded)
```

**Key rule:** Every record links back to an asset, a user, and a point in time. Full traceability.

---

## The 6 Things That Make This Hard

### 1. Offline-First Mobile (Briefcase Model)

This is not "cache some data." It's a structured offline-first architecture:

```
Before site visit:
  Server → pre-load assigned inspections, asset data, templates → local SQLite

During site visit (no connectivity):
  Technician fills forms, captures photos/video → all saved locally
  Every operation queued with a client-generated UUID (operation ID)

After site visit (connectivity returns):
  Queue drains automatically → server processes each operation
  Server deduplicates by operation ID (idempotent)
  Conflicts resolved by strategy (see below)
```

**Why it matters:** Turbines are in the middle of nowhere. Cell signal is unreliable. If a technician spends 6 hours on a turbine and loses data because the app crashed or signal dropped, that's a day of work lost and a re-climb.

### 2. Conflict Resolution (Not Just Last-Write-Wins)

| Data Type | Strategy | Why |
|---|---|---|
| Regular fields (notes, descriptions) | Last-write-wins (server timestamp) | Low risk, simple |
| Inspection evidence | Field-level merge | Non-conflicting fields auto-merge; conflicts flagged for QA |
| Ticket status transitions | State machine enforced | Invalid transitions rejected regardless of timestamp |
| Safety-critical (LOTO, permits) | Sequence number versioning | **Sync rejected** if client version ≠ server version |
| Inventory / parts | Multi-version reconciliation | Mismatch flagged for dispatcher to "true up" manually |

### 3. Inspection Templates (Dynamic Form Engine)

Templates are JSON schemas rendered dynamically in the mobile app:

```typescript
interface InspectionTemplate {
  id: string;
  name: string;           // "Blade Inspection v2"
  version: number;
  appliesTo: {            // which turbines/sites this applies to
    turbineModels?: string[];
    customerIds?: string[];
    siteIds?: string[];
  };
  fields: TemplateField[];
}

type TemplateField = {
  id: string;
  type: 'text' | 'numeric' | 'pass_fail' | 'dropdown' | 'photo' | 'video'
      | 'signature' | 'annotation';
  label: string;
  required: boolean;
  options?: string[];      // for dropdown
  unit?: string;           // for numeric (e.g., "mm")
  maxLength?: number;      // for text
};
```

**Why JSON schema:** Admins create templates in the web portal. Mobile app renders them. No app update needed to add new inspection types. Templates are versioned — old inspections retain the template version used at time of capture.

### 4. Technician Absence → Replacement Pipeline

This is the part no open source CMMS does. The flow:

```
1. Technician reports sick (via mobile or manager marks them)
2. System marks them UNAVAILABLE, records:
   - reason, start time, expected return, approval state
3. System finds all their open assignments
4. System calculates coverage impact (which SLAs are now at risk?)
5. System searches for replacement technicians using weighted scoring:
   - Skill match:              30%
   - Certification match:      25%
   - Proximity to site:        20%
   - Current workload capacity: 15%
   - Site/customer familiarity: 10%
   Minimum score: 60% to qualify. Below → escalate to dispatcher.
6. Ranked candidate list with reason codes shown to dispatcher
7. Dispatcher reassigns → notifications sent to all parties
8. Dashboards update immediately
```

**Why it matters:** A missed inspection on a turbine with a known defect can cascade into an emergency repair costing €380K instead of a €20K planned fix.

### 5. Evidence Lifecycle

Evidence isn't just file uploads. It's a tracked lifecycle:

```
Capture → Tag → Store Locally → Sync → Review → Approve → Link to Report

Every evidence item carries:
  asset_id, site, turbine, component,
  inspection_id, ticket_id,
  timestamp, author, device_source,
  media_type, sync_status, approval_status
```

- Original files are never modified. Annotations stored separately.
- Thumbnails and previews generated server-side.
- Evidence is versioned — once approved, it's immutable.
- Direct upload to S3 via presigned URLs (bypasses API server for large files).

### 6. Audit Trail (Everything Tracked)

Every state change, approval, assignment, substitution, and sync event is recorded:

```typescript
interface AuditEvent {
  id: string;
  entityType: 'ticket' | 'inspection' | 'work_order' | 'assignment' | 'evidence';
  entityId: string;
  action: string;          // 'status_change', 'assigned', 'approved', 'synced'
  fromValue?: string;
  toValue?: string;
  userId: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}
```

**Rule:** Audit events are append-only. Never deleted, never modified. This is required for customer reports and compliance.

---

## Ticket Lifecycle

```
New → Triaged → Assigned → In Progress → Pending Review → Closed
                                                      ↗
                                              Reopened ←─────┘
```

Configurable per organization. Each transition validates:
- Who can perform it (role check)
- What fields must be filled
- Who gets notified

Critical defects (severity = critical) trigger automatic escalation rules and notifications.

---

## API Design Principles

- **REST-first.** Resources map to entities. Standard HTTP methods.
- **Delta sync endpoints.** `GET /sync/changes?since=<timestamp>` returns only records changed since last sync.
- **Webhook events.** For external integrations (ERP, CRM, BI tools). Key lifecycle events fire webhooks.
- **Idempotency keys.** Every write operation accepts an `X-Idempotency-Key` header. Server deduplicates.
- **Phase 2+:** Presigned upload URLs (`POST /evidence/upload-url` → S3), WebSocket events (assignment changes, ticket status updates pushed in real-time).

---

## Tech Stack Summary

| Layer | Choice | Why |
|---|---|---|
| API | TypeScript + Hono | Lightweight, type-safe, edge-ready |
| Database | PostgreSQL | Relational integrity, JSONB for flexible form data, full-text search |
| ORM | Prisma | Type-safe queries, migrations, schema-as-code |
| Frontend + field app | Next.js 14 App Router + Tailwind CSS | SSR, responsive, file-based routing |
| Native mobile app | React Native + Expo (Phase 3+) | Background sync, push, native hardware; deferred from MVP |
| Auth | Custom JWT (access 15m + refresh 7d with rotation) | RBAC, organization-scoped, refresh token rotation |
| Real-time | Phase 2+ (WebSocket / Server-Sent Events) | Live status updates; not in MVP |
| File storage | Phase 2+ (S3-compatible) | Large media, presigned uploads |
| Task queue | Phase 2+ (BullMQ + Redis) | Background jobs: reports, notifications, sync |
| Search | PostgreSQL FTS | Fast filtering |
| CI/CD | GitHub Actions | Automated test, lint, build, deploy |
| Infrastructure | Docker Compose (3 services: API, PostgreSQL, pgAdmin) | Scales from MVP to multi-site |
| Testing | Vitest (mock-first London School) | Unit + integration tests |

---

## Phased Timeline

| Phase | Months | Focus | Team |
|---|---|---|---|
| **1 — MVP** | 1–4 | Asset registry, offline PWA inspections (IndexedDB), ticketing, evidence, basic dashboards | 2 BE, 2 FE, 1 QA, 1 DevOps |
| **2 — Workforce** | 5–7 | Availability, absence handling, replacement engine, notifications | 2 BE, 1 FE, 1 QA |
| **3 — Reporting & Mobile** | 8–10 | Customer reports, KPI dashboards, audit trail viewer, native mobile app (React Native + WatermelonDB) | 1 BE, 2 FE, 1 mobile, 1 QA |
| **4 — Integrations** | 11–14 | ERP, CRM, SCADA hooks, scale testing | 2 BE, 1 DevOps, 1 QA |

---

## What We're NOT Building (Yet)

- Predictive maintenance / ML models
- Inventory optimization
- Automated defect classification
- Customer portal
- Technician routing optimization

These are Phase 4+ items. The MVP must nail offline inspections, ticketing, and evidence first.

---

## Key Constraints for Developers

1. **Offline is not optional.** Every field screen must work without network. Design for zero connectivity first. MVP uses responsive Next.js web app; offline PWA capabilities and native mobile with WatermelonDB come in Phase 2+.
2. **Idempotent writes.** Every mutation must be safe to replay. Use operation IDs.
3. **Safety data is sacred.** LOTO, permit-to-work, and safety statuses use strict versioning. No last-write-wins.
4. **Asset naming follows standards.** IEC 61400-25 and RDS-PP. Don't invent your own naming scheme.
5. **Evidence is immutable.** Once captured, original files are never modified. Annotations are separate.
6. **Audit trail is append-only.** Never delete or modify audit events.
7. **Multi-tenant from day one.** Every query scoped by `organization_id`. Row-level security in PostgreSQL.
8. **File uploads bypass the API.** Phase 2+: Presigned S3 URLs. MVP stores evidence as URLs only.
