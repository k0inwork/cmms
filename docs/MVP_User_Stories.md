# MVP User Stories

## Format

Each story follows: **As a [role], I want to [action] so that [value].**

Roles: Technician, Dispatcher, QA Reviewer, Operations Manager, Administrator

---

## 1. Authentication & Roles

### US-AUTH-01: Log in with credentials
**As a** user, **I want to** log in with my credentials **so that** I can access the system securely.

**Acceptance criteria:**
- User can log in with email and password.
- Invalid credentials show a clear error message.
- Session expires after configurable inactivity timeout.
- User is redirected to their role-appropriate home screen after login.

### US-AUTH-02: Role-based access control
**As an** administrator, **I want to** assign roles to users **so that** each person only sees and does what they are authorized for.

**Acceptance criteria:**
- System supports five roles: Technician, Dispatcher, QA Reviewer, Operations Manager, Administrator.
- Each role has a defined set of permitted screens and actions.
- Users cannot access screens or actions outside their role.
- Role changes take effect on next login.

### US-AUTH-03: Log out
**As a** user, **I want to** log out **so that** my session is secured when I stop working.

**Acceptance criteria:**
- Logout clears the session and redirects to login screen.
- Local offline data remains accessible after logout (cached for offline use).
- Pending sync operations resume on next login when online.

---

## 2. Asset Registry

### US-ASSET-01: Create an organization
**As an** administrator, **I want to** create an organization record **so that** sites and assets can be grouped under it.

**Acceptance criteria:**
- Organization has a unique ID and name.
- Duplicate organization names are rejected with a clear message.
- Organization appears in the asset hierarchy navigation.

### US-ASSET-02: Create a site (wind farm)
**As an** administrator, **I want to** create a site under an organization **so that** turbines can be organized by location.

**Acceptance criteria:**
- Site has a unique ID, name, location metadata (coordinates), and parent organization.
- Site appears in the hierarchy: Organization → Site.
- Site can be searched and filtered by name and location.

### US-ASSET-03: Create a turbine (WTG)
**As an** administrator, **I want to** register a turbine under a site **so that** it can be tracked and inspected.

**Acceptance criteria:**
- Turbine has a unique ID conforming to IEC 61400-25 / RDS-PP naming.
- Turbine belongs to exactly one site.
- Turbine has status (active, decommissioned, maintenance), owner, and location metadata.
- Turbine appears in hierarchy: Organization → Site → Turbine.

### US-ASSET-04: Create a subsystem
**As an** administrator, **I want to** define subsystems under a turbine (e.g., Gearbox, Blade, Yaw System) **so that** components can be categorized.

**Acceptance criteria:**
- Subsystem belongs to exactly one turbine.
- Subsystem has a unique ID, name, and type.
- Subsystem appears in hierarchy: Organization → Site → Turbine → Subsystem.

### US-ASSET-05: Create a component
**As an** administrator, **I want to** register components under a subsystem (e.g., Bearing, Trailing Edge) **so that** defects and inspections can be linked to specific parts.

**Acceptance criteria:**
- Component has a unique ID, name, and parent subsystem.
- Component has status and complete history of linked inspections and work orders.
- Component appears in hierarchy: Organization → Site → Turbine → Subsystem → Component.

### US-ASSET-06: Browse asset hierarchy
**As a** user, **I want to** navigate the asset hierarchy from organization down to component **so that** I can find any asset quickly.

**Acceptance criteria:**
- Hierarchy is displayed as a navigable tree or drill-down list.
- Each level shows relevant status and summary counts (e.g., number of open tickets at a site).
- Breadcrumb navigation shows the current position in the hierarchy.

### US-ASSET-07: View asset detail and history
**As a** user, **I want to** view an asset's full detail and history **so that** I can understand its condition and past work.

**Acceptance criteria:**
- Detail view shows asset metadata, status, owner, and location.
- History tab lists all linked inspections, defects, tickets, and work orders in chronological order.
- Evidence items attached to any historical record are accessible from the detail view.

### US-ASSET-08: Prevent duplicate assets
**As an** administrator, **I want to** be prevented from creating duplicate assets **so that** data integrity is maintained.

**Acceptance criteria:**
- System rejects assets with the same name and parent (e.g., two turbines with the same ID at the same site).
- Error message clearly states which field is duplicated.

---

## 3. Inspection Templates & Forms

### US-INS-01: Create an inspection template
**As an** administrator, **I want to** create configurable inspection templates **so that** forms match the inspection type, turbine model, or site requirements.

**Acceptance criteria:**
- Template supports field types: text, numeric, pass/fail, dropdown, photo, video, annotation, signature.
- Template is a JSON schema that can be versioned.
- Template can be scoped by inspection type, turbine model, customer, or site.

### US-INS-02: Edit an inspection template
**As an** administrator, **I want to** edit existing templates **so that** I can improve forms based on feedback.

**Acceptance criteria:**
- Changes create a new version of the template.
- In-progress inspections using the previous version are not affected.
- Version history is viewable.

### US-INS-03: Render an inspection form from template
**As a** technician, **I want to** see a dynamic inspection form generated from the assigned template **so that** I can fill it out during inspection.

**Acceptance criteria:**
- Form renders all field types defined in the template.
- Required fields are clearly marked.
- Form validates input before submission (e.g., numeric fields reject text).
- Form works fully offline.

### US-INS-04: Submit an inspection
**As a** technician, **I want to** submit a completed inspection form **so that** findings are recorded and reviewable.

**Acceptance criteria:**
- Submission includes timestamp, technician ID, asset ID, and all form data.
- If offline, the form is saved locally and queued for sync.
- If online, the form is submitted immediately.
- Duplicate submissions do not create duplicate records (idempotent).

### US-INS-05: View inspection history for an asset
**As a** user, **I want to** see all past inspections for a given asset **so that** I can track its condition over time.

**Acceptance criteria:**
- Inspections are listed in reverse chronological order.
- Each entry shows date, technician, status, and number of defects found.
- Clicking an entry opens the full inspection record with all form data and evidence.

---

## 4. Offline Mobile Capture

### US-OFF-01: Work offline without interruption
**As a** technician, **I want to** continue working in the app when I have no connectivity **so that** I never lose work due to bad signal.

**Acceptance criteria:**
- App detects loss of connectivity and displays an offline indicator on every screen.
- All form entry, evidence capture, and status changes work without network.
- Data is stored locally in IndexedDB.

### US-OFF-02: Pre-load data before a site visit
**As a** technician, **I want to** pre-load my assigned inspections and reference data before going to a remote site **so that** I have everything I need offline.

**Acceptance criteria:**
- Pre-load includes assigned inspections, asset data, templates, and reference materials.
- Pre-load indicator shows which data is available offline.
- Pre-loaded data is stored in IndexedDB and accessible without network.

### US-OFF-03: Automatic sync when back online
**As a** technician, **I want to** sync my offline work automatically when connectivity returns **so that** I don't have to remember to upload.

**Acceptance criteria:**
- Sync starts automatically when network is detected.
- Each record shows sync status: pending, synced, failed, conflict.
- Successful syncs update the status indicator on the affected records.
- Failed syncs are retried with backoff.

### US-OFF-04: Handle sync conflicts
**As a** technician, **I want to** be notified when my offline changes conflict with server data **so that** I can resolve discrepancies.

**Acceptance criteria:**
- Non-conflicting field changes are auto-merged (field-level merge).
- Conflicting fields are flagged for QA reviewer resolution.
- Safety-critical data conflicts are rejected entirely and flagged for immediate review.
- Sync conflict events are recorded in the audit trail.

### US-OFF-05: Idempotent sync
**As a** technician, **I want to** never accidentally create duplicate records **so that** my data stays clean even if sync retries.

**Acceptance criteria:**
- Submitting the same inspection twice does not create a duplicate.
- Each record carries a client-generated unique ID used for deduplication.
- Server rejects duplicates with a success response (not an error).

---

## 5. Evidence Management

### US-EVID-01: Capture photos during inspection
**As a** technician, **I want to** take photos directly from the inspection form **so that** evidence is captured in context.

**Acceptance criteria:**
- Camera button is prominently placed on the inspection form.
- Photos are tagged with asset ID, inspection ID, timestamp, and technician automatically.
- Photos are saved locally if offline, uploaded when online.
- Supported formats: JPEG, PNG. Max 50 MB per image.

### US-EVID-02: Capture video during inspection
**As a** technician, **I want to** record video during inspection **so that** I can capture dynamic defect evidence.

**Acceptance criteria:**
- Video recording is accessible from the inspection form.
- Videos are tagged with asset ID, inspection ID, timestamp, and technician.
- Max 500 MB per video file.
- Server generates a 720p preview for quick viewing.

### US-EVID-03: Upload files as evidence
**As a** technician, **I want to** upload existing files (PDFs, images, documents) **so that** I can attach pre-existing documentation.

**Acceptance criteria:**
- File picker supports JPEG, PNG, MP4, PDF formats.
- Files are linked to the current inspection, asset, and ticket.
- Upload progress is visible.
- Failed uploads are retried automatically.

### US-EVID-04: View and annotate evidence
**As a** user, **I want to** view evidence items and add annotations **so that** I can highlight defect locations and add context.

**Acceptance criteria:**
- Evidence viewer displays the media with zoom and pan.
- Annotation tools allow markup on images (arrows, circles, text labels).
- Annotations are saved as separate overlay data, not baked into the original.
- Annotations are visible to all users who can view the evidence.

### US-EVID-05: Search the evidence library
**As a** user, **I want to** search for evidence by asset, site, date, or type **so that** I can reuse evidence across tickets and reports.

**Acceptance criteria:**
- Search supports filtering by asset ID, site, turbine, component, inspection ID, ticket ID, date range, media type, and author.
- Results show thumbnails with metadata.
- Clicking a result opens the full evidence item with context (linked records).

### US-EVID-06: Evidence versioning
**As a** user, **I want to** see the version history of evidence items **so that** I can track changes and annotations over time.

**Acceptance criteria:**
- Each evidence item has a version history showing upload, annotation, and approval events.
- Original file is always preserved; annotations are separate.
- Version history includes author and timestamp for each change.

---

## 6. Ticket & Work Order Management

### US-TKT-01: Create a ticket from an inspection defect
**As a** QA reviewer, **I want to** create a ticket directly from a defect found during inspection **so that** issues are tracked and assigned without manual re-entry.

**Acceptance criteria:**
- Defect has a "Create Ticket" action.
- Ticket auto-populates asset link, defect description, severity, and evidence.
- Ticket follows the configured lifecycle starting at "New."

### US-TKT-02: View ticket lifecycle
**As a** user, **I want to** see the full status history of a ticket **so that** I understand what happened and when.

**Acceptance criteria:**
- Ticket status transitions are logged: New → Triaged → Assigned → In Progress → Pending Review → Closed → Reopened.
- Each transition shows who changed it, when, and any notes.
- Invalid status transitions are rejected (enforced by state machine).

### US-TKT-03: Assign a ticket
**As a** dispatcher, **I want to** assign a ticket to a technician **so that** work is dispatched to the right person.

**Acceptance criteria:**
- Dispatcher can select a technician from available candidates.
- Technician receives a notification of the new assignment.
- Ticket status moves to "Assigned."
- Assignment is recorded in the audit trail.

### US-TKT-04: Update ticket priority and severity
**As a** dispatcher, **I want to** set or change ticket priority and severity **so that** urgent issues are handled first.

**Acceptance criteria:**
- Priority levels are clearly displayed with color coding.
- Changes to priority or severity are logged in the audit trail.
- Critical defects trigger escalation rules and notifications.

### US-TKT-05: Add resolution notes and close a ticket
**As a** technician, **I want to** add resolution notes and evidence when completing work **so that** the ticket has a complete record.

**Acceptance criteria:**
- Resolution notes support rich text.
- Evidence can be attached at closure.
- Ticket moves to "Pending Review" after technician submits.
- QA reviewer can approve closure or reopen with comments.

### US-TKT-06: Reopen a closed ticket
**As a** QA reviewer, **I want to** reopen a closed ticket **so that** recurring or unresolved issues are tracked.

**Acceptance criteria:**
- Reopening requires a reason.
- Ticket status resets to "Reopened."
- Reopened tickets are visible on dashboards and dispatcher board.
- Reopen event is logged in audit trail.

### US-TKT-07: Link evidence to a ticket
**As a** user, **I want to** attach evidence items to a ticket **so that** the ticket has supporting documentation.

**Acceptance criteria:**
- Evidence can be linked from the evidence library or uploaded directly.
- Links are recorded with who linked them and when.
- Multiple evidence items can be linked to one ticket.

### US-TKT-08: Create a work order
**As a** dispatcher, **I want to** create a work order from a ticket **so that** the repair or maintenance work is planned and tracked.

**Acceptance criteria:**
- Work order links to the parent ticket, asset, and assignee.
- Work order has its own lifecycle and due date.
- Work order appears on the technician's task list.

---

## 7. Technician Availability & Absence

### US-AVAIL-01: Set technician status
**As a** technician, **I want to** update my status (available, sick, leave, traveling, etc.) **so that** dispatchers know my availability.

**Acceptance criteria:**
- Status options: Available, Assigned, Traveling, On-site, On break, Sick, Training, Leave, Unavailable.
- Status change is visible immediately to dispatchers and managers.
- Status change is logged with timestamp.

### US-AVAIL-02: View team availability
**As a** dispatcher, **I want to** see all technicians' current status at a glance **so that** I can make informed assignment decisions.

**Acceptance criteria:**
- Board shows each technician with their current status, location, skills, and active assignments.
- Filterable by skill, location, and shift window.
- Color-coded for quick scanning.

### US-AVAIL-03: Mark a technician absent
**As a** dispatcher, **I want to** mark a technician as absent with a reason and expected return **so that** their assignments can be reassigned.

**Acceptance criteria:**
- Absence record captures: reason, start time, expected return date, approval state, notes.
- Technician's status changes to the relevant unavailable state.
- All open assignments for the technician are flagged for reassignment.
- Absence event is logged in audit trail.

### US-AVAIL-04: Self-report absence
**As a** technician, **I want to** mark myself as sick or unavailable from my mobile **so that** my dispatcher is notified immediately.

**Acceptance criteria:**
- Technician can set status to Sick or Unavailable with a reason.
- Dispatcher receives a notification.
- Technician's open assignments are flagged for reassignment.

### US-AVAIL-05: View absence history
**As an** operations manager, **I want to** see absence history for the team **so that** I can identify patterns and plan coverage.

**Acceptance criteria:**
- Absence history is viewable per technician and per team.
- Shows reason, duration, and impact on assignments.
- Filterable by date range and reason.

---

## 8. Replacement Suggestions

### US-REPL-01: Get replacement suggestions
**As a** dispatcher, **I want to** see ranked replacement candidates when a technician becomes unavailable **so that** I can reassign work quickly.

**Acceptance criteria:**
- System suggests candidates ranked by weighted score: skill match (30%), certification match (25%), proximity to site (20%), workload capacity (15%), site/customer familiarity (10%).
- Each candidate shows their score breakdown and reason codes explaining suitability.
- Candidates below 60% threshold are flagged for escalation.

### US-REPL-02: Reassign work to a replacement
**As a** dispatcher, **I want to** reassign a technician's open assignments to a suggested replacement with one action **so that** service continuity is maintained.

**Acceptance criteria:**
- Dispatcher selects a candidate and confirms reassignment.
- All open assignments transfer to the replacement technician.
- Both the original technician and replacement are notified.
- Replacement technician sees the new assignments on their home screen.

### US-REPL-03: Escalate when no qualified replacement exists
**As a** dispatcher, **I want to** escalate to a manager when no qualified replacement is found **so that** the gap is addressed manually.

**Acceptance criteria:**
- If no candidate scores above 60%, an escalation notification is sent to the operations manager.
- Escalation includes the affected assignments and the skills/certs required.
- Escalation is logged in the audit trail.

### US-REPL-04: Accept or decline a substitute assignment
**As a** technician, **I want to** accept or decline a reassignment **so that** I can confirm I am able to do the work.

**Acceptance criteria:**
- Technician receives a notification with assignment details.
- Technician can accept or decline with a reason.
- If declined, dispatcher is notified and can choose another candidate.

---

## 9. Dispatcher Board

### US-DISP-01: View coverage by day, site, team, and skill
**As a** dispatcher, **I want to** see a coverage board organized by day, site, team, and skill **so that** I can identify gaps.

**Acceptance criteria:**
- Board shows assignments, availability, and coverage status.
- Filterable by date range, site, team, and skill.
- Coverage gaps are highlighted visually (color coding).
- Board updates in real time when changes occur.

### US-DISP-02: Identify SLA risk from absences
**As a** dispatcher, **I want to** see which absences create SLA risk **so that** I can prioritize reassignments.

**Acceptance criteria:**
- Board flags assignments at SLA risk due to absences.
- Shows time remaining before SLA breach.
- Links directly to replacement suggestions for quick action.

### US-DISP-03: Assign inspections from the board
**As a** dispatcher, **I want to** assign inspections to technicians from the dispatch board **so that** upcoming work is distributed.

**Acceptance criteria:**
- Dispatcher can drag or select to assign an inspection to a technician.
- Assignment respects technician skills and certifications.
- Technician is notified of the new assignment.

---

## 10. Dashboard & Reporting

### US-DASH-01: View operational dashboard
**As an** operations manager, **I want to** see a dashboard with key metrics **so that** I can monitor operations at a glance.

**Acceptance criteria:**
- Dashboard shows: open ticket count, ticket aging, SLA compliance, sync failure rate, defect trends, technician coverage gaps.
- Metrics update in near real time.
- Filterable by site, team, and date range.

### US-DASH-02: View ticket aging
**As an** operations manager, **I want to** see how long tickets have been open **so that** I can identify stalled work.

**Acceptance criteria:**
- Aging report groups tickets by how long they have been in each status.
- Tickets approaching or exceeding SLA targets are highlighted.
- Clicking a ticket opens its detail view.

### US-DASH-03: View defect trends
**As an** operations manager, **I want to** see defect trends by asset class over time **so that** I can identify recurring problems.

**Acceptance criteria:**
- Trend chart shows defect count by asset class over a selectable date range.
- Drill-down from the chart opens the filtered defect list.
- Data can be exported for external analysis.

### US-DASH-04: Export a report
**As an** operations manager, **I want to** export reports **so that** I can share them with stakeholders.

**Acceptance criteria:**
- Reports can be exported in PDF format.
- Report includes the data and evidence snapshot as of the export date.
- Exported reports are reproducible from stored data.

### US-DASH-05: View sync health
**As an** operations manager, **I want to** monitor sync success rates across the field team **so that** I can detect connectivity or app issues.

**Acceptance criteria:**
- Dashboard shows sync success rate per technician.
- Failed syncs are listed with error details.
- Sync events are logged and traceable.

---

## 11. Search & Audit Trail

### US-SEARCH-01: Search assets, tickets, and evidence
**As a** user, **I want to** search across assets, tickets, and evidence **so that** I can find what I need quickly.

**Acceptance criteria:**
- Global search bar accessible from any screen.
- Searchable by: asset, site, turbine, component, ticket ID, inspection type, date range, severity, status, technician, customer.
- Results are grouped by type (assets, tickets, evidence).
- Filters can be combined for narrow results.

### US-SEARCH-02: Filter ticket lists
**As a** user, **I want to** filter tickets by status, priority, assignee, and date **so that** I can focus on relevant work.

**Acceptance criteria:**
- Filter bar on ticket list view.
- Multiple filters can be combined.
- Filter state is preserved when navigating away and back.

### US-AUDIT-01: View audit trail for a record
**As a** user, **I want to** see the full audit trail for any record **so that** I know what changed and who changed it.

**Acceptance criteria:**
- Every edit, approval, status change, assignment, and evidence link is recorded.
- Audit trail shows: timestamp, user, action, before/after values.
- Audit trail cannot be edited or deleted.
- Accessible from any record detail view.

### US-AUDIT-02: Export audit trail
**As an** administrator, **I want to** export audit trails **so that** I can provide compliance evidence.

**Acceptance criteria:**
- Export includes all audit events for a selected scope (record, asset, date range).
- Export format: CSV or PDF.
- Export is logged as an audit event itself.

---

## 12. Technician Mobile Workflow

### US-MOB-01: See my assigned inspections
**As a** technician, **I want to** see a list of my assigned inspections on my mobile home screen **so that** I know what to work on.

**Acceptance criteria:**
- Home screen shows assigned inspections sorted by due date.
- Each card shows turbine, inspection type, and status.
- Offline/sync indicator is visible on the home screen.

### US-MOB-02: Start an inspection from my phone
**As a** technician, **I want to** tap to start an inspection **so that** I can begin work with minimal steps.

**Acceptance criteria:**
- One tap to open the inspection form.
- Form loads from pre-loaded template data (works offline).
- Start time is recorded automatically.

### US-MOB-03: Complete an inspection from my phone
**As a** technician, **I want to** complete and submit an inspection from my phone **so that** I can move to the next task.

**Acceptance criteria:**
- Submit button validates all required fields.
- Completion time is recorded automatically.
- If offline, submission is queued for sync.
- Success confirmation is shown.

### US-MOB-04: Scan a QR code to identify an asset
**As a** technician, **I want to** scan a QR code on a turbine or component **so that** I can quickly open the right asset and report issues.

**Acceptance criteria:**
- Camera opens from any screen via QR scan button.
- Scanned code resolves to the correct asset in the hierarchy.
- Technician can start an inspection or create a ticket directly from the scanned asset.

### US-MOB-05: View sync status of my records
**As a** technician, **I want to** see which of my records are synced, pending, or failed **so that** I know my data is safe.

**Acceptance criteria:**
- Sync status indicator on every record (pending, synced, failed, conflict).
- Summary view shows count of pending and failed syncs.
- Failed records have a retry action.

### US-MOB-06: Install the PWA to my home screen
**As a** technician, **I want to** install the app to my phone's home screen **so that** it feels like a native app.

**Acceptance criteria:**
- Browser prompts "Add to Home Screen."
- Installed app opens in fullscreen mode (no browser chrome).
- App icon and splash screen match branding.

---

## 13. Admin Settings

### US-ADMIN-01: Manage users and roles
**As an** administrator, **I want to** create, edit, and deactivate user accounts **so that** access is controlled.

**Acceptance criteria:**
- Admin can create users with name, email, role, and skills.
- Admin can change a user's role.
- Admin can deactivate a user (prevents login but preserves history).

### US-ADMIN-02: Manage skills and certifications
**As an** administrator, **I want to** define skills and certifications and assign them to technicians **so that** the system can match replacements accurately.

**Acceptance criteria:**
- Skills have a name and category.
- Certifications have name, issuing body, and validity period.
- User-skill assignment includes proficiency level and acquired date.
- User-certification assignment includes issue date, expiry date, and certificate URL.
- Expired certifications are flagged.

### US-ADMIN-03: Configure workflow rules
**As an** administrator, **I want to** configure ticket lifecycle states and escalation rules **so that** workflows match our processes.

**Acceptance criteria:**
- Admin can define which status transitions are allowed.
- Admin can set escalation rules for critical-priority tickets.
- Admin can configure notification triggers for key events.

### US-ADMIN-04: Build inspection templates
**As an** administrator, **I want to** use a template builder to create and edit inspection forms **so that** I don't need developer help to change forms.

**Acceptance criteria:**
- Drag-and-drop form builder with supported field types (text, numeric, pass/fail, dropdown, photo, video, annotation, signature).
- Preview mode shows the form as the technician would see it.
- Templates can be scoped by inspection type, turbine model, customer, or site.

---

## 14. Non-Functional Requirements (as user stories)

### US-NFR-01: Fast media upload and retrieval
**As a** technician, **I want to** upload large photos and videos quickly **so that** I am not waiting in the field.

**Acceptance criteria:**
- Client-side compression before upload for images.
- S3 presigned URLs for direct upload (no server bottleneck).
- Server generates thumbnails (JPEG 800px, video 720p preview) for fast browsing.
- Upload progress is visible.

### US-NFR-02: Data integrity during sync
**As a** technician, **I want to** never lose my captured data even if sync fails **so that** my field work is never wasted.

**Acceptance criteria:**
- Local data in IndexedDB persists across app restarts.
- Failed syncs are queued and retried with exponential backoff.
- Sync events are logged for traceability.

### US-NFR-03: Secure mobile storage
**As a** technician, **I want to** my locally cached data to be secure **so that** sensitive information is not exposed if I lose my device.

**Acceptance criteria:**
- Local storage is encrypted at rest.
- Data is scoped to the logged-in user.
- Logout clears session data but preserves encrypted offline cache.

### US-NFR-04: Scalable performance under load
**As an** operations manager, **I want to** the system to remain responsive even with many users and large evidence files **so that** operations are not slowed down.

**Acceptance criteria:**
- Page load under 3 seconds for standard views.
- Search returns results within 2 seconds.
- Dashboard loads within 5 seconds with up to 10,000 records.
- Evidence thumbnails load progressively.

---

## 15. QA Review Workflow

### US-QA-01: Review a submitted inspection
**As a** QA reviewer, **I want to** review submitted inspections **so that** I can validate quality before tickets are created.

**Acceptance criteria:**
- Review queue shows all submitted inspections awaiting review.
- Reviewer can see all form data, evidence, and metadata.
- Reviewer can approve, reject with comments, or request changes.

### US-QA-02: Approve evidence
**As a** QA reviewer, **I want to** approve or flag evidence **so that** only verified evidence is used in reports.

**Acceptance criteria:**
- Evidence items have approval status: pending, approved, flagged.
- Approved evidence is available for report inclusion.
- Flagged evidence is returned to the technician with comments.

### US-QA-03: Approve ticket closure
**As a** QA reviewer, **I want to** approve or reject ticket closures **so that** work quality is verified before closing.

**Acceptance criteria:**
- Tickets in "Pending Review" appear in the reviewer's queue.
- Reviewer can approve (ticket moves to Closed) or reopen with comments.
- Approval/rejection is logged in the audit trail.

---

## Story Index by Role

### Technician
US-AUTH-01, US-AUTH-03, US-INS-03, US-INS-04, US-OFF-01, US-OFF-02, US-OFF-03, US-OFF-04, US-OFF-05, US-EVID-01, US-EVID-02, US-EVID-03, US-TKT-05, US-AVAIL-01, US-AVAIL-04, US-REPL-04, US-MOB-01, US-MOB-02, US-MOB-03, US-MOB-04, US-MOB-05, US-MOB-06, US-NFR-01, US-NFR-02, US-NFR-03, US-SEARCH-01

### Dispatcher
US-TKT-03, US-TKT-04, US-TKT-08, US-AVAIL-02, US-AVAIL-03, US-REPL-01, US-REPL-02, US-REPL-03, US-DISP-01, US-DISP-02, US-DISP-03, US-SEARCH-01, US-SEARCH-02

### QA Reviewer
US-TKT-01, US-TKT-06, US-TKT-07, US-QA-01, US-QA-02, US-QA-03, US-EVID-04, US-SEARCH-01

### Operations Manager
US-DASH-01, US-DASH-02, US-DASH-03, US-DASH-04, US-DASH-05, US-AVAIL-05, US-AUDIT-01, US-SEARCH-01, US-NFR-04

### Administrator
US-AUTH-02, US-ASSET-01, US-ASSET-02, US-ASSET-03, US-ASSET-04, US-ASSET-05, US-ASSET-06, US-ASSET-07, US-ASSET-08, US-INS-01, US-INS-02, US-ADMIN-01, US-ADMIN-02, US-ADMIN-03, US-ADMIN-04, US-AUDIT-02
