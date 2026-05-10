# Open Source CMMS Review & Gap Analysis

## 1. Purpose

This document evaluates available open source CMMS platforms against the requirements defined in `proposal.md`. It identifies which platforms come closest, where each falls short, and whether any could serve as a foundation instead of building from scratch.

---

## 2. Platforms Evaluated

| Platform | Repository / URL | Stars | Tech Stack | License | Last Active |
|---|---|---|---|---|---|
| Atlas CMMS | github.com/Grashjs/cmms | 614 | Java Spring Boot + React + React Native + PostgreSQL + MinIO | AGPL-3.0 / Commercial | May 2026 |
| SuperCMMS | supercmms.com | N/A | Unknown (SaaS only, no public repo) | Claims open source, no code published | Active |
| Trier OS | github.com/DougTrier/trier-os | 16 | Node.js + React + SQLite | MIT | Apr 2026 |
| Liberu Maintenance | github.com/liberu-maintenance/maintenance-laravel | 49 | PHP 8.5 + Laravel 12 + Filament 5 + MySQL | MIT | Mar 2026 |
| Snipe-IT | github.com/grokability/snipe-it | 13,763 | PHP + Laravel + MySQL | AGPL-3.0 | May 2026 |
| CalemEAM | github.com/calemcme/CalemEAM | 14 | JavaScript | Commercial OSS | Oct 2016 (abandoned) |

---

## 3. Platform Summaries

### 3.1 Atlas CMMS (atlas-cmms.com)

**What it is:** A self-hosted CMMS with web and mobile apps, positioned as "Jira for technicians." Docker-based deployment with PostgreSQL and MinIO (S3-compatible) storage.

**Strengths:**
- Web + mobile apps (iOS and Android, React Native)
- Work orders with priorities, assignment, time logging, and automation triggers
- Analytics: work order compliance, cost analysis, downtime insights, cost trends
- Equipment and inventory tracking with stock alerts and purchase order automation
- Location management with Google Maps integration
- MinIO or GCP storage for file attachments
- SSO support (Google, Microsoft), LDAP authentication
- Multi-language (14 languages)
- Docker Compose deployment in 2 minutes

**Weaknesses:**
- No offline-first architecture — mobile app requires connectivity
- No configurable inspection templates
- Flat asset hierarchy (locations + equipment, no deep nesting to component level)
- No technician skill, certification, or availability tracking
- No absence handling or replacement suggestion engine
- No evidence versioning or annotation support
- No SCADA or IoT integration
- Dual-licensed — advanced features (white labeling, custom branding) require commercial license
- Java Spring Boot backend (not TypeScript as proposed)

**Tech match to proposal:** Moderate. Uses PostgreSQL, React, React Native, and S3-compatible storage. But Java backend diverges from the proposed TypeScript/Node.js stack.

---

### 3.2 SuperCMMS (supercmms.com)

**What it is:** A SaaS CMMS claiming to be "free and open source." Offers a free-forever plan for 2 team members with all features included. Operated by Kepler Data Science Pte. Ltd. (Singapore).

**Strengths:**
- Explicitly lists **wind and solar sites** as a target industry
- IoT and SCADA integration available
- Rules engine for event-based predictive maintenance (PdM)
- Preventive and predictive maintenance
- Inventory management
- API access included in free plan
- QR code-based issue reporting
- Audit trails
- Mobile apps (claimed)
- Very low cost ($15/user/month for mission-critical plan)
- Trusted in 50+ countries, 99.95% uptime claim

**Weaknesses:**
- **No public source code** despite "open source" claims — no GitHub repository found
- No offline-first capability mentioned
- No inspection template builder described
- No technician availability, skill, or absence management
- No evidence management (annotation, versioning, media lifecycle)
- No deep asset hierarchy described
- No self-hosting option — SaaS only
- Vendor lock-in risk — proprietary platform with no exit path
- Unknown tech stack, no API documentation publicly available
- No customer-facing report generation described

**Tech match to proposal:** Low. Unknown stack, SaaS-only, cannot be self-hosted or customized. The wind/solar and SCADA integrations are notable but come with vendor dependency.

---

### 3.3 Trier OS (github.com/DougTrier/trier-os)

**What it is:** An offline-first industrial operations platform built for plant floors. Scan-to-execute workflow where technicians scan a machine barcode and the system surfaces the next action. Per-plant SQLite databases with no cloud dependency.

**Strengths:**
- **Best offline architecture of all platforms evaluated:**
  - IndexedDB queue captures every operation
  - Auto-drains queue on reconnect
  - Queue preserved across session expiry
  - Idempotent operations (duplicate scans never create duplicate records)
- Zero-keystroke floor execution — tap-only actions
- Per-plant isolated SQLite databases
- Plant LAN peer sync via WebSocket (no internet required)
- Silent auto-close engine for missed close-outs
- GIS spatial intelligence (Cesium-based 3D maps)
- WebRTC barcode scanning for mobile devices
- Full Playwright test suite (886+ tests)
- Invariant-enforced audit (structural guarantees at DB level)
- ERP outbound integration (SAP, Oracle)
- MIT license — no restrictions
- Embedded Monaco IDE for in-app customization
- Mobile-optimized (tested on Zebra TC77 rugged devices)

**Weaknesses:**
- Built for manufacturing plant floors, not remote field service
- Scan-to-execute model doesn't map to wind turbine inspection workflows
- No configurable inspection templates
- No deep asset hierarchy beyond machine/parts
- No technician skill, certification, or availability tracking
- No absence handling or replacement suggestions
- No media evidence lifecycle (annotation, versioning, approval)
- No customer-facing report generation
- SQLite per-plant doesn't scale to multi-site centralized view without additional work
- Small community (16 stars)

**Tech match to proposal:** High for architecture patterns, low for feature coverage. Node.js + React stack matches. The offline-first design is exactly what the proposal requires, but the plant-floor workflow model is fundamentally different from remote wind turbine inspection.

---

### 3.4 Liberu Maintenance (github.com/liberu-maintenance/maintenance-laravel)

**What it is:** A Laravel 12-based CMMS with Filament 5 admin panel. Part of the Liberu ecosystem of Laravel business applications.

**Strengths:**
- Asset management with equipment inventory, location, status, and service history
- Preventive maintenance scheduler with multi-stage reminders (3 days, 1 day, same day)
- Work orders with configurable approval and completion workflows
- Document management with versioning, tagging, and expiry tracking (ISO 9001, OSHA, FDA)
- Custom forms attachable to work orders or schedules
- IoT sensor integration for condition-based maintenance triggers
- Role-based access control (Laravel Jetstream Teams)
- MIT license — most permissive of all options
- Docker and Laravel Sail support
- Part of a broader ecosystem (CRM, accounting, billing, e-commerce modules available)
- Clean modular architecture

**Weaknesses:**
- **Web-only — no mobile app, no offline capability**
- PHP/Laravel stack (not TypeScript/Node.js as proposed)
- No technician availability, skill, or certification tracking
- No absence handling or replacement suggestions
- No evidence management (photos, video, annotations)
- No customer-facing report generation
- No SCADA integration (only basic IoT sensor triggers)
- Flat asset hierarchy
- Small community (49 stars, few contributors)

**Tech match to proposal:** Low. PHP stack diverges significantly. The custom forms and document versioning are relevant reference patterns, but the absence of mobile and offline makes it non-viable as a starting point.

---

### 3.5 Snipe-IT (github.com/grokability/snipe-it)

**What it is:** The most popular open source asset management system (13,763 stars), but focused on **IT asset and license management**, not maintenance operations.

**Strengths:**
- Largest community of all platforms evaluated
- Mature, battle-tested, actively maintained
- Comprehensive asset tracking with custom fields
- License management
- Robust API
- Well-documented
- Two-factor authentication, SSO
- Docker deployment

**Weaknesses:**
- **Not a CMMS** — no work orders, no maintenance workflows, no inspection capability
- No mobile app
- No offline capability
- No technician management
- No evidence management
- No reporting beyond asset inventory
- IT-focused — no relevance to wind turbine or field service operations

**Tech match to proposal:** None. Eliminate from consideration. Included only because it dominates GitHub CMMS searches and must be explicitly ruled out.

---

### 3.6 CalemEAM (github.com/calemcme/CalemEAM)

**What it is:** A commercial open source enterprise asset management platform.

**Assessment:** Abandoned since October 2016. Only 14 stars. Not evaluated further.

---

## 4. Gap Analysis Matrix

Legend: **Yes** = fully supported, **Partial** = some support, **No** = not available, **N/A** = not applicable

| Requirement | Atlas CMMS | SuperCMMS | Trier OS | Liberu | Snipe-IT |
|---|---|---|---|---|---|
| **Asset hierarchy** (org→site→turbine→component) | Partial (flat locations) | Partial (unknown depth) | Partial (plant→machine→parts) | Partial (flat equipment) | No |
| **Configurable inspection templates** | No | Unknown | Partial (SOP library) | Partial (custom forms) | No |
| **Offline-first mobile** | No | No | **Yes** | No | No |
| **Sync conflict resolution** | No | No | **Yes** (idempotent + queue) | No | No |
| **Work order lifecycle** (configurable states) | **Yes** | **Yes** | **Yes** | **Yes** | No |
| **Evidence management** (photos, video, annotations) | Partial (file attachments) | No detail | No | Partial (document mgmt) | Partial (file uploads) |
| **Evidence versioning** | No | No | No | **Yes** | No |
| **Technician skills & certifications** | No | No | No | No | No |
| **Technician availability tracking** | No | No | No | No | No |
| **Absence handling** | No | No | No | No | No |
| **Replacement suggestions** (weighted scoring) | No | No | No | No | No |
| **Auto-reassignment** | No | No | No | No | No |
| **Coverage gap analysis** | No | No | No | No | No |
| **Audit trail** | Partial | **Yes** | **Yes** (invariant-enforced) | Partial | Partial |
| **Search & traceability** | Partial | Unknown | **Yes** | Partial (tag-based) | Partial |
| **Customer-facing reports** | No | Unknown | No | No | No |
| **Report versioning** | No | No | No | No | No |
| **Multi-tenant** | **Yes** (org-level) | Unknown | **Yes** (per-plant) | No | No |
| **API-first** | **Yes** (REST) | **Yes** | Partial (ERP outbound) | Partial (IoT hooks) | **Yes** (REST) |
| **SCADA/IoT integration** | No | **Yes** | Partial (telemetry) | Partial (IoT sensors) | No |
| **RBAC** | **Yes** | **Yes** | **Yes** | **Yes** | **Yes** |
| **SSO** | **Yes** (Google, MS, LDAP) | Unknown | No | No | **Yes** |
| **Wind/energy industry fit** | No | **Yes** (listed) | No | No | No |
| **Self-hostable** | **Yes** (Docker) | No (SaaS only) | **Yes** | **Yes** | **Yes** |

---

## 5. Critical Gap Summary

### Requirements no open source platform covers

These requirements have zero coverage across all evaluated platforms and must be built from scratch:

1. **Technician skill and certification tracking** — No platform tracks technician qualifications, certification expiry, or proficiency levels.
2. **Technician availability management** — No platform provides real-time availability status (available, on-site, sick, leave, traveling, etc.).
3. **Absence handling workflow** — No platform supports marking technicians unavailable and cascading impact to assignments.
4. **Replacement suggestion engine** — No platform offers weighted scoring for substitute technician selection based on skills, proximity, workload, and certifications.
5. **Auto-reassignment** — No platform automatically pauses jobs, recalculates schedules, and escalates when technicians become unavailable.
6. **Coverage gap analysis** — No platform shows SLA risk from absences by day, site, team, and skill.
7. **Configurable inspection templates** — No platform offers a template builder for wind turbine inspection forms with text, numeric, pass/fail, photo, video, annotation, and signature fields.
8. **Evidence annotation and markup** — No platform supports annotating photos or marking up images in the field.
9. **Customer-facing report generation** — No platform produces customer-ready export packages with evidence snapshots.
10. **Report versioning and reproducibility** — No platform preserves the exact data/evidence snapshot used for each issued report.

### Requirements with partial coverage

These requirements have some support but need significant extension:

1. **Offline-first mobile** — Only Trier OS solves this, but for plant floors, not field inspections.
2. **Hierarchical asset model** — All platforms use flat or shallow hierarchies. None support org→site→turbine→subsystem→component.
3. **Evidence management** — Atlas CMMS has file attachments via MinIO, Liberu has document versioning, but none have the full evidence lifecycle (capture→tag→sync→review→approve→link-to-report).
4. **Audit trail** — Trier OS has the strongest audit (invariant-enforced at DB level), others have basic history logging.

---

## 6. Conclusion

No single open source CMMS, and no combination of them, covers the core requirements of the proposal. The three hardest requirements — offline-first mobile inspections, technician absence/replacement management, and evidence lifecycle — have essentially zero open source coverage.

The proposal to build a custom platform is justified. The next document (`borrowed-patterns.md`) identifies which architectural patterns and implementation approaches from each platform are worth incorporating.
