# MVP Design Document

## Design principles
- Offline-first. Briefcase sync model: pre-load curated data before site visits, reconcile on return. MVP is a responsive Next.js 14 web app; offline PWA capabilities and native mobile app (React Native + WatermelonDB) deferred to Phase 2+.
- Mobile-first responsive design. Large buttons, minimal typing, camera-first evidence capture via browser APIs.
- Structured data before unstructured notes.
- Evidence tied to records, not stored separately.
- Simple workflows over feature-heavy screens.
- Idempotent operations: duplicate submissions never create duplicate records.
- Safety-critical data uses sequence number versioning — rejected if version mismatch.
- Asset naming conforms to IEC 61400-25 and RDS-PP standards for SCADA interoperability.

## System archetype
This is a Hybrid Service-Asset Platform combining:
- **CMMS** — maintain robotic crawlers and inspection equipment.
- **FSM** — dispatch crews, manage travel, meet customer SLAs.
- **EAM** — track long-term turbine health and capital planning.

Architectural decisions must serve all three dimensions.

## Main modules
### Responsive Web App (MVP)
Used by technicians for inspections, evidence capture, and status updates. Next.js 14 App Router with Tailwind CSS. Works on desktop and mobile browsers. Phase 2+: offline PWA capabilities.

### Admin web portal
Shares the same Next.js 14 codebase as the field app. Used to manage assets, users, forms, skills, and workflow rules.

### Dispatch board
Used by planners to manage assignments, absences, and replacements.

### Evidence library
Used to browse, search, and reuse uploaded photos, videos, and files. Evidence is versioned and traceable to assets, inspections, and tickets.

### Dashboard
Used to monitor open issues, coverage gaps, and aging tickets. KPIs include ticket aging, SLA compliance, sync failure rate, defect trends, and technician coverage gaps.

## Key screens
- Login.
- Technician home (with offline/sync status indicator; responsive web, Phase 2+: PWA installable to home screen).
- Assigned inspections (pre-loaded for offline use).
- Inspection form (rendered dynamically from template schema).
- Evidence viewer (with annotation support).
- Ticket detail (with full lifecycle: New → Triaged → Assigned → In Progress → Pending Review → Closed → Reopened).
- Absence screen (mark unavailable, reason, expected return).
- Replacement recommendations (ranked candidates with weighted scoring and reason codes).
- Dispatcher board (coverage view by day/site/team/skill).
- Asset detail (hierarchical: org → site → turbine → subsystem → component → defect).
- Admin settings (template builder, role management, workflow rules).

## Data model overview
- Organization.
- Site (Wind Farm).
- Turbine (WTG) — IEC 61400-25 / RDS-PP naming.
- Subsystem (e.g., Gearbox, Blade, Yaw System).
- Component (e.g., Bearing, Trailing Edge).
- Inspection Template (JSON schema with typed fields).
- Inspection Record.
- Defect (AI-classifiable severity).
- Ticket (configurable lifecycle states).
- Work Order.
- Evidence Item (versioned, with annotation data).
- Technician.
- Skill.
- Certification (GWO and industry-specific).
- Availability Slot.
- Absence Record.
- Assignment.
- Audit Event.
- Sync Event (with conflict resolution metadata).

## UX notes
- Large buttons and minimal typing in the field.
- Clear offline/sync indicators on every screen (pending, synced, failed, conflict).
- Fast access to camera and file upload.
- Color-coded ticket priorities.
- Simple substitution suggestions with reason codes.
- Zero-keystroke actions where possible — tap to start, tap to complete.
- QR code scanning for quick asset identification and issue reporting.
- Pre-load indicator showing which data is available offline before site visit.
- Native mobile app (React Native + Expo) planned for Phase 3: background sync, push notifications, native hardware access (LiDAR, Bluetooth for robotic controllers).
