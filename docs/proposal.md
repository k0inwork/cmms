# Centralized Maintenance, Inspection, Ticketing, Technician, and Evidence Management Platform

## 1. Purpose

This document defines requirements for a centralized platform for an Aerones-like company that performs remote wind-turbine inspection, maintenance, and repair. The platform must manage inspection data, maintenance work orders, tickets, evidence, reporting, technician availability, and substitutions in one system so operations do not depend on spreadsheets, email threads, or manual coordination. [aufaittechnologies](https://aufaittechnologies.com/blog/mobile-cmms-offline-maintenance-basements-plant-rooms/)

## 2. Business goals

- Reduce time from field inspection to ticket creation and assignment.
- Keep a complete traceable history for every asset, defect, and evidence item.
- Support offline-first mobile work in remote and low-connectivity locations.
- Eliminate duplicate records and manual transcription.
- Improve service continuity when technicians are unavailable.
- Provide customer-ready reports and internal operational dashboards. [osapiens](https://osapiens.com/maintenance/maintenance-checklist/wind-turbine-maintenance-checklist/)

## 3. System archetype: Hybrid Service-Asset Platform

This platform is not a pure CMMS. For an Aerones-like provider performing remote robotic inspection and repair, the architecture must combine three operational paradigms:

| Dimension | CMMS (Maintenance Focus) | FSM (Field Service Focus) | EAM (Lifecycle Focus) |
|---|---|---|---|
| Primary goal | Asset reliability and uptime | Dispatching and SLA compliance | Total cost of ownership |
| Asset owner | Internal (robots, crawlers) | External (customer turbines) | Both; distributed fleet |
| Key workflow | PM schedules and work orders | Dispatch, route, and close-out | Capital planning and decommissioning |
| Mobility | Facility-based (WiFi common) | Remote-first (offline critical) | Strategic; fleet-wide visibility |

The platform must:
- **CMMS logic** — maintain the specialized robotic crawlers and inspection equipment.
- **FSM engine** — dispatch crews to remote wind sites, manage travel, meet customer SLAs.
- **EAM depth** — track long-term turbine health, component degradation, and capital planning.

Architectural decisions must serve all three dimensions simultaneously. [ifs](https://www.ifs.com/en/glossary/compare/top-10-field-service-management-software-2026)

## 4. Operating context

The company operates in remote environments where field teams inspect turbines and capture large evidence sets such as photos, videos, measurements, and defect notes. Because connectivity is often unreliable, the platform must support offline capture and later synchronization without data loss. The system must also support rapid reassignment when technicians become ill, are on leave, or otherwise unavailable, because missed assignments can delay repairs and reporting. [oxmaint](https://oxmaint.com/industries/power-plant/cmms-mobile-offline-power-plant-remote-sites)

## 5. Users and roles

### Field technician
Captures inspection data, evidence, and completion notes, often offline.

### QA reviewer
Validates inspection quality, confirms defect severity, and approves reports or closures.

### Dispatcher or planner
Assigns work, handles substitutions, and re-optimizes schedules.

### Operations manager
Monitors fleet status, open issues, SLA risk, and workforce coverage.

### Customer user
Views approved reports, case summaries, and closure evidence.

### Administrator
Manages templates, access control, master data, workflow rules, and integrations.

### HR or workforce coordinator
Maintains absences, shift coverage, and technician qualification records.

## 6. Scope

The platform must cover:
- Asset registry.
- Inspection capture.
- Work order and ticket management.
- Evidence management.
- Reporting and analytics.
- Technician availability and absence handling.
- Replacement assignment and dispatch re-optimization.
- Integrations with external systems such as ERP, CRM, BI, and storage. [oxmaint](https://oxmaint.com/industries/power-plant/wind-turbine-maintenance-cmms-software-renewable-energy)

## 7. Functional requirements

### 7.1 Asset registry
The system must store a hierarchical asset model aligned with wind industry standards:
- Organization.
- Site (Wind Farm).
- Turbine (WTG).
- Subsystem (e.g., Gearbox, Blade, Yaw System).
- Component (e.g., Bearing, Trailing Edge).
- Defect or event. [blogs.infosys](https://blogs.infosys.com/infosys-cobalt/digital-supply-chain/structured-cmms-implementation-approach-for-wind-farms-part-6-of-6.html)

Asset naming and identification must conform to **IEC 61400-25** (communication standard for wind power plants) and **RDS-PP** (Reference Designation System for Power Plants) to ensure interoperability with client SCADA systems. Each asset level must carry both physical and virtual/logical identifiers:

| Level | Physical Entity | Virtual/Logic Entity | Data Source |
|---|---|---|---|
| Fleet | Global Portfolio | Portfolio Health Score | BI Tools / ERP |
| Site | Wind Farm | Environmental Baseline | SCADA / Met Mast |
| Asset | Turbine (WTG) | Availability % / MTBF | SCADA / CMMS |
| Subsystem | Gearbox / Blade | Condition-Based Monitoring (CBM) | Vibration / Oil Sensors |
| Detail | Bearings / Trailing Edge | Specific Defect ID (AI Classified) | Robotic Inspection |

Each asset must have a unique ID, location metadata, status, owner, and complete history of inspections and work orders. Naming and ID rules must be enforced to prevent duplicates.

### 7.2 Inspection capture
The system must provide digital inspection templates for wind-turbine work. Forms must support:
- Text fields.
- Numeric measurements.
- Pass/fail checks.
- Dropdowns.
- Photos.
- Video.
- Markup or annotation.
- Signatures where needed. [oxmaint](https://oxmaint.com/industries/power-plant/cmms-mobile-offline-power-plant-remote-sites)

Inspection data must be structured at the point of capture. The system should allow configurable templates by inspection type, turbine model, customer, or site.

### 7.3 Offline mobile mode
The mobile app must work offline in remote or low-signal environments. The synchronization model must follow a **Briefcase pattern**: before a site visit, the system pre-loads a curated set of assigned inspections, asset data, templates, and reference materials to the technician's local SQLite database. In the field, the technician works entirely offline. On return, curated sync reconciles changes.

Technicians must be able to:
- Open assigned inspections and work orders (pre-loaded).
- Fill out forms.
- Capture evidence.
- Save timestamps locally.
- Continue work without interruption.
- Sync automatically when connectivity returns. [facilio](https://facilio.com/blog/mobile-cmms-offline-support/)

Offline mode must include secure local storage, sync status per record (pending, synced, failed, conflict), retry logic, and conflict-aware synchronization. [facilio](https://facilio.com/blog/mobile-cmms-offline-support/)

### 7.4 Work order and ticketing
The system must convert inspection findings into tickets or work orders with minimal manual intervention. Each ticket must support:
- Asset link.
- Priority.
- Severity.
- Category.
- Owner.
- Due date.
- SLA target.
- Status.
- Root cause.
- Resolution notes.
- Evidence attachments.

Ticket lifecycle should be configurable, at minimum:
- New.
- Triaged.
- Assigned.
- In progress.
- Pending review.
- Closed.
- Reopened.

Critical defects must support escalation rules and automated notifications.

### 7.5 Evidence management
The system must store and link all evidence to the correct asset and ticket. Evidence may include:
- Photos.
- Videos.
- Files.
- Inspection documents.
- Annotated images.
- Sensor or measurement exports. [pixly](https://www.pixly.ai/post/facility-management-documentation-fundamentals-capturing-maintenance-repairs-and-warranty-claims-with-photos-and-videos)

Evidence must retain:
- Asset ID.
- Site.
- Turbine.
- Component.
- Inspection ID.
- Ticket ID.
- Timestamp.
- Author.
- Device source.
- Media type.
- Sync status.
- Approval status.

Evidence must be searchable, reusable in reports, and kept in a centralized repository with clear permissions and versioning. [pixly](https://pixly.ai/insights/facility-management-documentation-fundamentals-capturing-maintenance-repairs-and-warranty-claims-with-photos-and-videos/)

### 7.6 Reporting
The system must generate:
- Inspection reports.
- Maintenance completion reports.
- Open issue summaries.
- SLA and aging reports.
- Site and turbine history reports.
- Customer-ready export packages. [aufaittechnologies](https://aufaittechnologies.com/blog/mobile-cmms-offline-maintenance-basements-plant-rooms/)

Reports must be reproducible from stored data and support versioning. The platform should preserve the exact data and evidence snapshot used for each issued report.

### 7.7 Search and traceability
Users must be able to search by:
- Asset.
- Site.
- Turbine.
- Component.
- Ticket ID.
- Inspection type.
- Date range.
- Severity.
- Status.
- Technician.
- Customer.

Every edit, approval, and status change must be recorded in an audit trail. [osapiens](https://osapiens.com/maintenance/maintenance-checklist/wind-turbine-maintenance-checklist/)

## 8. Technician management

### 8.1 Availability tracking
The system must show real-time technician status:
- Available.
- Assigned.
- Traveling.
- On-site.
- On break.
- Sick.
- Training.
- Leave.
- Unavailable. [innomaint](https://innomaint.com/industry/field-service-management-software/)

Managers must be able to view availability by skill, location, and shift window.

### 8.2 Absence handling
When a technician becomes ill or otherwise unavailable, the system must allow a dispatcher or manager to mark them unavailable immediately and record:
- Reason.
- Start time.
- Expected return.
- Approval state.
- Notes. [traxxeo](https://traxxeo.com/en/time-and-activity-management/staff-absence-management-software/)

The absence must automatically remove the technician from active dispatch plans and open assignments.

### 8.3 Replacement search
The system must suggest substitute technicians based on:
- Skill match.
- Certification match.
- Location or proximity.
- Current workload.
- Shift overlap.
- Site or customer restrictions. [formitize](https://www.formitize.com/blog/technician-management-software-a-modern-guide-for-field-service-teams/)

The system must rank candidates and explain why each candidate is suitable.

### 8.4 Auto-reassignment
If a technician is unavailable, the system should automatically:
- Pause or reopen open jobs.
- Recalculate schedules.
- Notify the dispatcher.
- Suggest a replacement.
- Escalate if no qualified substitute exists. [ifs](https://www.ifs.com/en/glossary/compare/top-10-field-service-management-software-2026)

### 8.5 Coverage view
The platform should show coverage gaps by day, site, team, and skill. Managers should see whether absences create SLA risk, missed inspections, or overtime pressure. [apps365](https://www.apps365.com/blog/absence-management-software/)

### 8.6 Mobile technician workflow
Technicians should be able to:
- Mark themselves sick or unavailable.
- Request leave.
- See reassigned jobs.
- Accept or decline substitute assignments.
- Receive notifications for updated dispatches. [tylertech](https://www.tylertech.com/products/absence-substitute)

## 9. Non-functional requirements

### Reliability
The system must remain usable during connectivity loss and must not lose captured field data. Every sync operation must be idempotent — duplicate submissions never create duplicate records. [aufaittechnologies](https://aufaittechnologies.com/blog/mobile-cmms-offline-maintenance-basements-plant-rooms/)

### Performance
The platform must handle large evidence files and high volumes of records without degrading user experience.

### Security
The platform must support role-based access control, secure authentication, and secure mobile storage.

### Auditability
The system must preserve timestamps, authorship, approvals, status transitions, substitutions, and evidence lineage. [blogs.infosys](https://blogs.infosys.com/infosys-cobalt/digital-supply-chain/structured-cmms-implementation-approach-for-wind-farms-part-6-of-6.html)

### Scalability
The solution must support multi-site operations, high attachment volume, and growing technician pools. [oxmaint](https://www.oxmaint.com/blog/post/blog-post-wind-turbine-maintenance-predictive-cmms)

### Data quality
The platform must enforce structured input, mandatory fields, and asset validation to minimize manual cleanup. [blogs.infosys](https://blogs.infosys.com/infosys-cobalt/digital-supply-chain/structured-cmms-implementation-approach-for-wind-farms-part-6-of-6.html)

## 10. Data model requirements

The core data model should include:
- Organization.
- Site.
- Turbine.
- Component.
- Inspection template.
- Inspection record.
- Measurement.
- Defect.
- Work order.
- Ticket.
- Attachment.
- User.
- Role.
- Skill.
- Certification.
- Availability slot.
- Absence record.
- Shift assignment.
- Replacement suggestion.
- Approval.
- Audit event.
- Sync event.

Every record should support relational traceability so a ticket or repair can be traced back to a specific inspection, technician, and evidence set.

## 11. Workflow requirements

### Inspection workflow
1. Technician receives an assigned inspection.
2. Technician opens it on mobile.
3. Data is entered offline or online.
4. Evidence is captured.
5. Record is saved locally if needed.
6. Data syncs automatically.
7. Reviewer validates the submission.
8. Defects become tickets or work orders.

### Repair workflow
1. Planner reviews the ticket.
2. Work is assigned.
3. Technician executes repair.
4. Evidence and completion notes are added.
5. Reviewer approves closure.
6. Ticket closes and history is retained.

### Absence and replacement workflow
1. Technician reports illness or absence.
2. Manager marks technician unavailable.
3. System identifies open assignments and coverage impact.
4. System suggests substitute technicians.
5. Dispatcher reassigns jobs or escalates if no substitute exists.
6. Technician and affected stakeholders receive notifications.
7. Schedule and workload dashboards update immediately.

### Evidence workflow
1. Technician captures evidence in the mobile app.
2. App tags evidence with asset and inspection context.
3. Evidence is stored locally if offline.
4. Sync happens automatically when online.
5. QA reviews and approves evidence if needed.
6. Approved evidence is linked to the final report and ticket history. [pixly](https://www.pixly.ai/post/facility-management-documentation-fundamentals-capturing-maintenance-repairs-and-warranty-claims-with-photos-and-videos)

## 12. Integration requirements

The system should support integration with:
- ERP or finance systems.
- CRM or customer portals.
- Storage services for large media files.
- BI/reporting tools.
- SCADA or condition-monitoring sources when available. [oxmaint](https://oxmaint.com/industries/power-plant/wind-turbine-maintenance-cmms-software-renewable-energy)
- External CMMS or EAM tools if the platform is not the system of record for all maintenance. [blogs.infosys](https://blogs.infosys.com/infosys-cobalt/digital-supply-chain/structured-cmms-implementation-approach-for-wind-farms-part-6-of-6.html)

Integration must be API-first, with import/export support and webhook events for key lifecycle changes.

## 13. Analytics and KPIs

The platform should provide dashboards for:
- Open ticket count.
- Ticket aging.
- Inspection-to-ticket cycle time.
- First-time-right completion.
- SLA compliance.
- Reopen rate.
- Sync failure rate.
- Field productivity.
- Defect trends by asset class.
- Technician coverage gaps.
- Absence impact on schedule.
- Reassignment time.

These metrics help compare sites, identify recurring issues, and manage workforce continuity. [oxmaint](https://www.oxmaint.com/blog/post/blog-post-wind-turbine-maintenance-predictive-cmms)

## 14. MVP definition

The MVP should include:
- Asset registry.
- Offline-capable PWA inspection forms (IndexedDB + Service Worker).
- Evidence uploads.
- Ticket and work order creation.
- Status lifecycle tracking.
- Technician availability tracking.
- Absence marking and replacement suggestions.
- Search.
- Audit trail.
- Basic dashboards.
- Report export.

The MVP should not try to solve predictive maintenance, advanced inventory optimization, or full ERP replacement on day one. Those can be added later after the core workflow is stable. [maintboard](https://maintboard.com/robotic-wind-turbine-maintenance-cmms)

## 15. Later-phase enhancements

Future releases should consider:
- Predictive maintenance inputs from SCADA or sensor systems.
- Condition-based alerting.
- Spare parts and inventory management.
- Customer portal.
- Automated defect classification (AI from visual/LiDAR data).
- AI-assisted report drafting.
- Advanced rules for priority and scheduling.
- Optimization for technician routing and multi-job dispatch. [maintboard](https://maintboard.com/robotic-wind-turbine-maintenance-cmms)
- AI-driven scheduling engine to reduce travel time and optimize multi-job dispatch.
- Unified view for 8K video, 3D LiDAR, and AI-detected defects (robotic inspection integration).

## 16. Acceptance criteria

The solution is acceptable when:
- Technicians can complete inspections offline and sync later without loss.
- Every defect can be traced to a unique asset and inspection.
- Tickets can be generated from inspection findings with minimal manual re-entry.
- Reports can be reproduced from stored data and evidence.
- Managers can monitor work progress and aging issues in real time.
- Technicians can be marked unavailable and replaced quickly.
- Coverage gaps are visible before they affect SLA commitments.
- Evidence is centrally managed, searchable, versioned, and traceable.
- Audit trails remain complete and tamper-evident. [pixly](https://pixly.ai/insights/facility-management-documentation-fundamentals-capturing-maintenance-repairs-and-warranty-claims-with-photos-and-videos/)

## 17. Data model relationships

### Entity-relationship overview

```
Organization
  └── Site
        ├── Turbine
        │     └── Component
        │           ├── Measurement
        │           └── Defect
        ├── Inspection Template
        └── Shift Assignment

User
  ├── Role
  ├── Skill
  ├── Certification
  ├── Availability Slot
  ├── Absence Record
  └── Replacement Suggestion

Inspection Record
  ├── → Inspection Template
  ├── → User (technician)
  ├── → Turbine
  ├── → Component
  ├── Measurement
  ├── Defect
  └── Attachment (evidence)

Work Order
  ├── → Turbine
  ├── → Component
  ├── → User (assignee)
  ├── Ticket
  │     ├── → Defect
  │     ├── Attachment (evidence)
  │     ├── Approval
  │     └── Audit Event
  └── Attachment (evidence)

Attachment
  ├── → Inspection Record or Work Order or Ticket
  ├── → Turbine
  ├── → Component
  └── → User (author)

Sync Event
  └── → User, Attachment, Inspection Record, Work Order
```

### Key cardinalities

| Relationship | Cardinality |
|---|---|
| Organization → Sites | 1:N |
| Site → Turbines | 1:N |
| Turbine → Components | 1:N |
| Component → Defects | 1:N |
| Inspection Template → Inspection Records | 1:N |
| Inspection Record → Measurements | 1:N |
| Inspection Record → Defects | 0:N |
| Inspection Record → Attachments | 1:N |
| Defect → Tickets | 1:N |
| Work Order → Tickets | 1:N |
| Ticket → Attachments | 0:N |
| Ticket → Approvals | 0:N |
| Ticket → Audit Events | 1:N |
| User → Availability Slots | 1:N |
| User → Absence Records | 0:N |
| User → Skills | M:N (through user_skill) |
| User → Certifications | M:N (through user_certification) |
| User → Shift Assignments | 1:N |
| Absence Record → Replacement Suggestions | 1:N |

### Required join tables

| Table | Connects | Additional Fields |
|---|---|---|
| user_skill | User ↔ Skill | proficiency_level, acquired_date |
| user_certification | User ↔ Certification | issued_date, expiry_date, certificate_url |
| ticket_attachment | Ticket ↔ Attachment | linked_by, linked_at |
| work_order_attachment | Work Order ↔ Attachment | linked_by, linked_at |

## 18. Tech stack

### Recommended stack

| Layer | Technology | Rationale |
|---|---|---|
| **API** | TypeScript + Node.js (Fastify or NestJS) | Strong typing, large ecosystem, team familiarity |
| **Database** | PostgreSQL | Relational integrity, JSONB for flexible form data, full-text search |
| **ORM** | Prisma or Drizzle | Type-safe queries, migrations, schema-as-code |
| **File storage** | S3-compatible (MinIO self-hosted or AWS S3) | Large media files, presigned upload URLs, cost-effective |
| **Frontend + offline field app** | React + Vite PWA (Service Worker + IndexedDB) | Single codebase for web and field use; installable to home screen; offline via Service Worker and IndexedDB |
| **Native mobile app** | React Native + Expo (Phase 3+) | Full native capabilities: background sync, push notifications, hardware access (LiDAR, Bluetooth); deferred from MVP |
| **Auth** | Keycloak or Auth0 | RBAC, SSO, multi-tenant ready |
| **Real-time** | WebSocket (Socket.IO or native) | Live status updates, notifications |
| **Task queue** | BullMQ + Redis | Background jobs: report generation, notifications, sync reconciliation |
| **Search** | PostgreSQL full-text + optional Meilisearch | Fast filtering on assets, tickets, evidence metadata |
| **CI/CD** | GitHub Actions | Automated test, lint, build, deploy |
| **Infrastructure** | Docker + Kubernetes or single-server Docker Compose | Scales from MVP to multi-site |
| **Monitoring** | OpenTelemetry + Grafana | Performance, error tracking, sync health |

### Offline architecture

**MVP (PWA):**
```
PWA (React, installed to home screen)
  └── Service Worker
        ├── Caches app shell and static assets
        ├── Routes API calls through sync-aware fetch layer
        └── IndexedDB (local storage)
              ├── Reads/writes locally at all times
              ├── Tracks sync status per record
              └── Two-way sync via REST + delta endpoints (triggered on app open)
                    └── Server (PostgreSQL)
                          ├── Receives changes, resolves conflicts
                          ├── Returns updated records since last sync
                          └── Emits real-time events to connected clients
```

**Phase 3+ (Native mobile):**
```
Native App (React Native + Expo)
  └── WatermelonDB (local SQLite)
        ├── Reads/writes locally at all times
        ├── Tracks sync status per record
        ├── Background sync queue drain
        └── Two-way sync via REST + delta endpoints
              └── Server (PostgreSQL)
```

The PWA and native app share the same API layer. Migration to native is a frontend-only concern — no backend changes needed.

Conflict resolution strategy:
- **Default**: last-write-wins with server timestamp as authority.
- **Evidence and inspections**: field-level merge — non-conflicting fields auto-merge; conflicting fields flagged for QA reviewer to resolve manually.
- **Status transitions**: state-machine enforced — invalid transitions rejected regardless of timestamp.
- **Safety-critical data** (LOTO, permits, safety statuses): sequence number versioning — if the client version ID does not match the server, the sync is rejected entirely. Required for 100% safety compliance.
- **Inventory and parts usage**: multi-version reconciliation — detects mismatches and flags the dispatcher to manually "true up" stock levels.

| Conflict Scenario | Strategy | Logic | Risk |
|---|---|---|---|
| Simultaneous note edits | Field-level last-write-wins | Most recent timestamp per field preserved | Minor metadata loss if timestamps nearly identical |
| Inventory/parts usage | Multi-version reconciliation | Detects mismatch; flags dispatcher for manual "true-up" | Higher admin friction |
| Safety/LOTO status | Sequence number versioning | Client version must match server; otherwise sync rejected | Required for 100% safety compliance |

## 19. Timeline and phasing

### Phase 1 — MVP (months 1–4)

| Sprint | Weeks | Deliverables |
|---|---|---|
| Foundation | 1–3 | Project scaffold, database schema, auth, user/role management, CI/CD pipeline |
| Asset Registry | 4–6 | CRUD for organizations, sites, turbines, components; hierarchical navigation; search |
| Inspections | 7–10 | Template builder, inspection form rendering, PWA offline capture with IndexedDB + Service Worker, sync |
| Ticketing | 11–14 | Ticket creation from inspection defects, lifecycle workflow, assignment, basic dashboard |
| Evidence & Polish | 15–17 | File upload pipeline, evidence linking, report export, MVP launch |

**Team**: 2 backend, 2 frontend, 1 QA, 1 DevOps (part-time)

### Phase 2 — Technician & Workforce (months 5–7)

| Sprint | Weeks | Deliverables |
|---|---|---|
| Availability | 1–3 | Technician status tracking, shift calendar, absence management |
| Substitution | 4–6 | Replacement suggestions, auto-reassignment, coverage gap dashboard |
| Notifications | 7–8 | Push/email notifications for assignments, reassignments, escalations |

**Team**: 2 backend, 1 frontend, 1 QA

### Phase 3 — Reporting, Analytics & Native Mobile (months 8–10)

| Sprint | Weeks | Deliverables |
|---|---|---|
| Reports | 1–3 | Customer-ready report generation, PDF export, evidence packaging |
| Dashboards | 4–6 | KPI dashboards, SLA tracking, aging reports, defect trends |
| Audit | 7–8 | Full audit trail viewer, compliance export |
| Native mobile | 9–12 | React Native + Expo app with WatermelonDB; background sync; push notifications; native camera/hardware access |

**Team**: 1 backend, 2 frontend, 1 mobile, 1 QA

### Phase 4 — Integrations & Scale (months 11–14)

| Sprint | Weeks | Deliverables |
|---|---|---|
| Integrations | 1–4 | ERP sync, CRM hooks, SCADA ingest, webhook events |
| Scale | 5–8 | Performance tuning, multi-tenant isolation, load testing, documentation |

**Team**: 2 backend, 1 DevOps, 1 QA

### Total estimated effort: 14 months, 5–7 people

## 20. Open questions — recommended answers

| # | Question | Recommendation |
|---|---|---|
| 1 | Which existing systems must remain authoritative for customers, assets, or finance? | Start with the CMMS as the system of record for assets, inspections, and tickets. Sync customer and financial data from the ERP bi-directionally. Define clear ownership per entity in the integration layer. |
| 2 | Do field teams need full offline work order execution or only offline inspection capture? | MVP: offline inspection capture via PWA only. Phase 2: extend to offline work order execution (still PWA). Phase 3: native mobile app with background sync for both. This reduces sync complexity in the first release while still solving the primary pain point. |
| 3 | Which file types and media sizes must be supported? | MVP: JPEG, PNG, MP4, PDF. Max file size 500 MB per file (video), 50 MB per image. Store originals plus server-generated thumbnails (JPEG 800px, video 720p preview). |
| 4 | What approval chain is required for report publication? | Two-level: QA reviewer approves content accuracy, then operations manager approves for customer release. Configurable per customer contract in later phases. |
| 5 | What rules determine the best substitute technician? | Weighted scoring: skill match (30%), certification match (25%), proximity to site (20%), current workload capacity (15%), site/customer familiarity (10%). Threshold: minimum 60% score to qualify; below that, escalate to dispatcher. |
| 6 | Which integrations are required in phase 1 versus later phases? | Phase 1: S3-compatible storage only. Phase 2: notification services (email/push). Phase 3: BI tool export. Phase 4: ERP, CRM, SCADA integrations. |

## 21. Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Offline sync data loss | Medium | High | IndexedDB with durable local storage; Service Worker queue; idempotent operations; server-side conflict queue with manual resolution fallback |
| Large media files degrade performance | High | Medium | S3 presigned URLs for direct upload; client-side compression before upload; thumbnail generation on server |
| Technician adoption resistance | Medium | High | Involve field teams in UX testing from sprint 3; keep offline flow simple; provide training |
| Scope creep into predictive maintenance | Medium | Medium | Strict MVP scope enforced; phase-gate reviews; separate backlog for post-MVP features |
| Multi-tenant data leakage | Low | Critical | Row-level security in PostgreSQL; tenant isolation in API layer; automated tenant isolation tests |
| ERP integration delays | High | Low | Phase 4 placement isolates risk; CMMS operates standalone until integration is ready |
| Safety data inconsistency during sync | Low | Critical | Sequence number versioning for all safety-critical fields; rejected syncs flagged for immediate dispatcher review |
| SCADA standard misalignment | Medium | High | Adopt IEC 61400-25 and RDS-PP naming conventions from day one; validate asset taxonomy with client engineering teams before Phase 1 |
