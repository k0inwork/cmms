# Borrowed Patterns from Open Source CMMS

## 1. Purpose

This document catalogs specific architectural patterns, code structures, and design decisions from evaluated open source CMMS platforms that should be borrowed or adapted for the custom build defined in `proposal.md`.

---

## 2. From Trier OS — Offline-First Architecture

Trier OS has the most mature offline-first implementation of any platform evaluated. Its patterns directly address proposal sections 6.3 (Offline Mobile Mode) and the offline sync architecture in section 17.

### 2.1 IndexedDB Operation Queue

**What Trier OS does:** Every operation is captured in an IndexedDB queue on the client. When connectivity returns, the queue drains automatically. If a session expires during an extended outage, the queue is preserved and drain resumes after re-auth.

**What to borrow:**
- Use IndexedDB as the client-side operation queue for React Native (via WatermelonDB or a custom IndexedDB layer for PWA fallback).
- Queue must survive app restarts, session expiry, and device reboots.
- Each queued operation should carry: record ID, operation type (create/update/delete), timestamp, payload hash, and sync retry count.
- Maximum 3 retry attempts per operation before flagging for manual resolution.

**How it maps to the proposal:**
- Inspection records, evidence metadata, and status changes queue locally.
- Sync status per record (pending, synced, failed, conflict) visible to the technician.
- QA reviewer gets a dashboard of failed/conflicted syncs.

### 2.2 Idempotent Operations

**What Trier OS does:** Duplicate scans never create duplicate records. Each operation is idempotent — re-processing the same queued item produces the same result.

**What to borrow:**
- Every sync payload must include a client-generated UUID (operation ID) that the server recognizes as idempotent.
- Server stores processed operation IDs for a configurable window (e.g., 7 days) to deduplicate retries.
- Status transitions are state-machine enforced — an invalid transition is rejected regardless of timestamp or operation ID.

**How it maps to the proposal:**
- Prevents double-submitted inspections when a technician presses "save" in a flaky network.
- Protects ticket lifecycle (can't reopen a closed ticket via stale queue drain).

### 2.3 Auto-Recovery for Missed Actions

**What Trier OS does:** A server-side cron job detects work segments left open by missed close-out scans, closes them with a `TimedOut` state, and flags the parent work order for supervisor review.

**What to borrow:**
- Implement a background job that detects inspections or work orders stuck in "in progress" beyond an expected duration.
- Auto-transition to a "pending review — timeout" state.
- Notify the QA reviewer and dispatcher.
- Never auto-close evidence or final approvals — only flag for human review.

**How it maps to the proposal:**
- Prevents ghost records from technicians who lose connectivity mid-inspection.
- Ensures nothing falls through the cracks during sync delays.

### 2.4 Per-Plant Isolated Storage

**What Trier OS does:** Each plant gets its own SQLite database. Corporate analytics layer aggregates across all of them.

**What to borrow (adapted):**
- For the proposal, each mobile device gets its own local SQLite database (via WatermelonDB) containing only the technician's assigned work.
- The server uses a single PostgreSQL with row-level tenant isolation (not separate DBs per site).
- The local/central split mirrors Trier OS's approach: local-first execution, centralized aggregation.

---

## 3. From Atlas CMMS — Work Order Lifecycle & File Storage

Atlas CMMS has the most complete work order and file management implementation. Its patterns address proposal sections 6.4 (Work Order and Ticketing) and 6.5 (Evidence Management).

### 3.1 Work Order Automation Triggers

**What Atlas CMMS does:** Work orders can be automated with triggers — rule-based conditions that create, assign, or escalate work orders without manual intervention.

**What to borrow:**
- Implement a trigger engine where rules can be defined per organization:
  - "If a critical defect is found during inspection, auto-create a work order and assign to the site lead."
  - "If a work order is unassigned for 24 hours, escalate to dispatcher."
  - "If technician marked unavailable, trigger replacement workflow."
- Triggers should be configurable by admin users, not hardcoded.
- Store trigger definitions as JSON rules in the database.

**How it maps to the proposal:**
- Enables the escalation rules in section 6.4 (critical defects → automated notifications).
- Supports the auto-reassignment triggers in section 7.4.

### 3.2 MinIO/S3 File Storage with Presigned URLs

**What Atlas CMMS does:** Uses MinIO (self-hosted S3) or Google Cloud Storage. Files are uploaded directly to object storage via presigned URLs, keeping the API server stateless for large file handling.

**What to borrow:**
- API generates a presigned upload URL when the client requests to upload evidence.
- Client uploads directly to S3/MinIO, bypassing the API server for large files.
- API stores only the metadata (file key, content type, size, asset/ticket link) in PostgreSQL.
- Server generates thumbnails and previews asynchronously via BullMQ background jobs.

**How it maps to the proposal:**
- Directly matches the proposed S3-compatible storage in section 17.
- Solves the "large media files degrade performance" risk from section 20.
- Client-side compression before upload (resize images, transcode video) reduces bandwidth.

### 3.3 Organization-Level Multi-Tenancy

**What Atlas CMMS does:** Supports multiple organizations with isolation. Organization admins can invite users. `ALLOWED_ORGANIZATION_ADMINS` env variable controls who can create orgs.

**What to borrow:**
- Organization as the top-level tenant boundary.
- Row-level security in PostgreSQL: every query includes `WHERE organization_id = ?`.
- Organization admin role can manage users, templates, and workflows within their org.
- Platform super-admin can manage cross-org settings.

**How it maps to the proposal:**
- Matches the hierarchical model: Organization → Site → Turbine → Component.
- Supports the multi-tenant isolation requirement in section 8 (Security).

### 3.4 SSO and LDAP Integration

**What Atlas CMMS does:** Supports OAuth2 (Google, Microsoft) and LDAP for enterprise authentication.

**What to borrow:**
- Delegate auth to Keycloak (as proposed) which handles Google, Microsoft, LDAP, and SAML.
- Atlas's pattern of configurable SSO via environment variables is a good ops model.
- Keep JWT-based session management consistent across web and mobile.

---

## 4. From SuperCMMS — SCADA/IoT and Predictive Maintenance

SuperCMMS is the only platform with explicit wind/solar industry support and a SCADA integration story. Its patterns address proposal sections 11 (Integration Requirements) and 14 (Later-Phase Enhancements).

### 4.1 Rules Engine for Predictive Maintenance

**What SuperCMMS does:** A rules engine allows defining event-based conditions that trigger predictive maintenance actions. For example: "If SCADA reports vibration > threshold for 30 minutes, create a work order."

**What to borrow (for Phase 4):**
- Define a simple rule schema:
  ```
  {
    "trigger": {"source": "scada", "metric": "vibration", "operator": ">", "threshold": 5.0, "duration": "30m"},
    "action": {"type": "create_work_order", "priority": "high", "assign_to": "site_lead"},
    "asset_filter": {"turbine_model": "Vestas V90"}
  }
  ```
- Store rules in PostgreSQL, evaluate via BullMQ scheduled jobs or a real-time event stream.
- Start simple (threshold rules) and evolve to ML-based predictions later.

**How it maps to the proposal:**
- Addresses the Phase 4 predictive maintenance enhancement (section 14).
- The rules engine also powers the auto-reassignment logic (section 7.4).

### 4.2 QR Code-Based Issue Reporting

**What SuperCMMS does:** QR codes on assets allow anyone (even non-users) to scan and report an issue.

**What to borrow:**
- Generate unique QR codes for each turbine and component.
- Scanning a QR code opens a simplified issue report form (no login required for external reporters).
- Reports route to the dispatcher for triage.
- Useful for site visitors, customer reps, or anyone who spots a defect but isn't a platform user.

---

## 5. From Liberu Maintenance — Document Management and Custom Forms

Liberu has the most structured approach to document versioning and custom data capture forms.

### 5.1 Document Versioning with Compliance Tracking

**What Liberu does:** Documents have version history, tagging, expiry dates, and review schedules. Supports ISO 9001, OSHA, FDA compliance tracking.

**What to borrow:**
- Evidence items and inspection reports should have immutable versions.
- Each version stores: file reference, metadata snapshot, author, timestamp, approval status.
- Compliance fields: next review date, expiry date, standard reference (ISO, customer contract).
- Never delete versions — mark as superseded.

**How it maps to the proposal:**
- Supports the evidence versioning requirement in section 6.5.
- Enables report reproducibility in section 6.6 (preserve exact data/evidence snapshot).

### 5.2 Custom Forms on Work Orders

**What Liberu does:** Custom data-capture forms can be built and attached to any work order or schedule. Forms support different field types.

**What to borrow:**
- Inspection templates are essentially custom forms with typed fields (text, numeric, pass/fail, dropdown, photo, video, signature).
- Store template definitions as JSON schemas:
  ```json
  {
    "name": "Blade Inspection v2",
    "fields": [
      {"id": "blade_damage", "type": "pass_fail", "required": true},
      {"id": "damage_photo", "type": "photo", "required": false},
      {"id": "crack_length_mm", "type": "numeric", "unit": "mm", "required": false},
      {"id": "technician_notes", "type": "text", "max_length": 1000},
      {"id": "completion_signature", "type": "signature", "required": true}
    ]
  }
  ```
- Render forms dynamically in React Native from the schema.
- Validation runs client-side before sync submission.

**How it maps to the proposal:**
- Directly implements the configurable inspection templates in section 6.2.
- Templates can be versioned and assigned by inspection type, turbine model, customer, or site.

---

## 6. Borrowing Strategy by Phase

| Pattern | Source | Which Phase | Effort |
|---|---|---|---|
| IndexedDB operation queue | Trier OS | Phase 1 (MVP) | Medium — adapt to WatermelonDB |
| Idempotent sync operations | Trier OS | Phase 1 (MVP) | Low — operation ID + server dedup |
| Auto-recovery for missed actions | Trier OS | Phase 1 (MVP) | Low — single BullMQ recurring job |
| Presigned URL file uploads | Atlas CMMS | Phase 1 (MVP) | Low — standard S3 pattern |
| Organization multi-tenancy | Atlas CMMS | Phase 1 (MVP) | Medium — row-level security setup |
| SSO via Keycloak | Atlas CMMS (pattern) | Phase 1 (MVP) | Medium — Keycloak configuration |
| Custom form schema engine | Liberu | Phase 1 (MVP) | Medium — JSON schema + dynamic renderer |
| Work order trigger engine | Atlas CMMS | Phase 2 | Medium — rule definition + evaluation |
| Replacement scoring engine | Custom (no source) | Phase 2 | High — no open source reference exists |
| Absence workflow | Custom (no source) | Phase 2 | High — no open source reference exists |
| Document versioning | Liberu | Phase 3 | Low — audit table + superseded flag |
| Customer report generation | Custom (no source) | Phase 3 | High — PDF packaging + evidence bundling |
| SCADA rules engine | SuperCMMS (pattern) | Phase 4 | Medium — rule schema + event processing |

---

## 7. What Must Be Built From Scratch

These components have no viable open source reference and require custom design and implementation:

1. **Technician availability state machine** — Available, Assigned, Traveling, On-site, On break, Sick, Training, Leave, Unavailable. Transitions between states, mobile push for status changes.
2. **Absence management workflow** — Mark unavailable, record reason/expected return/approval, cascade impact to assignments.
3. **Replacement suggestion engine** — Weighted scoring across skills (30%), certifications (25%), proximity (20%), workload (15%), site familiarity (10%). Minimum 60% threshold. Ranked candidate list with reason codes.
4. **Auto-reassignment engine** — Pause/reopen jobs, recalculate schedules, notify dispatcher, suggest replacement, escalate if no substitute.
5. **Coverage gap dashboard** — Visualize SLA risk by day/site/team/skill when absences occur.
6. **Inspection template builder** — Admin UI to create and version inspection form schemas with all field types including photo/video capture and signature.
7. **Evidence annotation** — In-app photo markup and annotation on mobile, with annotation data stored separately from the original image.
8. **Customer report packager** — Assemble inspection data, evidence, and approval chain into a versioned, reproducible PDF export package.
9. **Wind turbine asset hierarchy** — Organization → Site → Turbine → Subsystem → Component → Defect with enforced naming rules and duplicate prevention.

---

## 8. Recommended Approach

1. **Do not fork any existing platform.** The tech stack mismatches, missing features, and license constraints (AGPL-3.0) make forking more expensive than building clean.
2. **Build on the proposed stack** (TypeScript/Node.js, PostgreSQL, React/React Native, S3).
3. **Implement borrowed patterns** from the table in section 6 at the appropriate phase.
4. **Reference Trier OS source code** for offline queue and sync implementation details. The idempotent operation and auto-recovery patterns are well-documented and MIT-licensed.
5. **Reference Atlas CMMS API design** for work order lifecycle, trigger engine, and multi-tenant organization model.
6. **Reference Liberu's document model** for versioning and compliance tracking patterns.
7. **Design technician management from scratch** — this is the proposal's differentiator and has no open source precedent.
