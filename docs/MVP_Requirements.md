# MVP Requirements Specification

## Goal
Build a first usable version of a centralized platform for remote wind-turbine inspection and maintenance operations. The MVP must let field teams capture inspection data offline, attach evidence, create tickets, manage technician availability, and support basic reassignment when someone becomes unavailable.

## Scope
### In scope
- Asset registry.
- Inspection forms.
- Offline mobile capture.
- Evidence upload and storage.
- Ticket/work order creation.
- Technician availability and absence marking.
- Replacement suggestion.
- Basic dashboards.
- Search and audit trail.

### Out of scope
- Predictive maintenance.
- Advanced inventory management.
- ERP replacement.
- AI defect classification.
- Full customer portal.
- Complex optimization for routing and scheduling.

## User roles
- Technician.
- Dispatcher/planner.
- QA reviewer.
- Operations manager.
- Administrator.

## Core user flows
1. Technician opens an assigned inspection.
2. Technician works offline if needed.
3. Technician captures forms, photos, video, and notes.
4. Data syncs when online.
5. QA reviews the submission.
6. Defects become tickets or work orders.
7. Dispatcher assigns or reassigns jobs.
8. Technician absence triggers replacement suggestions.

## Functional requirements
- The system must maintain a unique ID for each site, turbine, component, inspection, and ticket.
- The system must support offline mobile capture and automatic sync later.
- The system must store evidence as linked records with metadata and audit history.
- The system must create tickets from inspection findings.
- The system must track technician status as available, unavailable, sick, leave, assigned, or traveling.
- The system must suggest substitutes based on skills, certifications, location, and workload.
- The system must support search, filtering, and status tracking for assets, tickets, and evidence.
- The system must record all important changes in an audit trail.

## Non-functional requirements
- Reliable offline operation.
- Secure authentication and role-based access.
- Auditability.
- Fast upload and retrieval of media.
- Scalable storage for large evidence files.
- Data integrity and conflict handling during sync.

## Success metrics
- Time from inspection to ticket creation.
- Time to reassign work after absence.
- Sync success rate.
- Percentage of inspections completed without manual re-entry.
- Ticket closure time.
- Number of orphaned evidence records.
