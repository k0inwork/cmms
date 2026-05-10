# MVP Test Specification

## Document Purpose

This document provides traceable test cases for every MVP user story. Each acceptance criterion becomes one or more test cases with steps, expected results, priority, and test type.

## Test Type Legend

| Code | Type | Description |
|------|------|-------------|
| **F** | Functional | Single-feature verification |
| **I** | Integration | Cross-module data flow |
| **E2E** | End-to-End | Full user flow across modules |
| **NF** | Non-Functional | Performance, security, reliability |
| **UAT** | User Acceptance | Real-user validation |

## Priority Legend

| Code | Priority | Meaning |
|------|----------|---------|
| **P0** | Critical | Must pass for MVP launch |
| **P1** | High | Core feature, must pass before pilot |
| **P2** | Medium | Important but not blocking launch |

---

## 1. Authentication & Roles

### TC-AUTH-01: Successful login
- **User Story:** US-AUTH-01
- **Type:** F | **Priority:** P0
- **Precondition:** User account exists with known credentials

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to login page | Login form displayed with email and password fields |
| 2 | Enter valid email and password | Fields populated |
| 3 | Click "Log In" | User is authenticated and redirected to role-appropriate home screen |
| 4 | Verify session token | Session token is set and stored |

### TC-AUTH-02: Login with invalid credentials
- **User Story:** US-AUTH-01
- **Type:** F | **Priority:** P0
- **Precondition:** User account exists

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Enter valid email with wrong password | Fields populated |
| 2 | Click "Log In" | Clear error message: "Invalid email or password" |
| 3 | Verify no session is created | User remains on login page |
| 4 | Enter non-existent email | Clear error message displayed |

### TC-AUTH-03: Session timeout
- **User Story:** US-AUTH-01
- **Type:** F | **Priority:** P1
- **Precondition:** User is logged in, timeout configured (e.g., 30 min)

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Log in and remain idle past timeout | Session expires |
| 2 | Attempt any action | User is redirected to login page |
| 3 | Re-authenticate | User can log in again and resume |

### TC-AUTH-04: Role-based access — role assignment
- **User Story:** US-AUTH-02
- **Type:** F | **Priority:** P0
- **Precondition:** Administrator is logged in

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open user management | User list displayed |
| 2 | Select a user and change role to "Technician" | Role updated successfully |
| 3 | Log in as that user | Only Technician-permitted screens and actions are visible |
| 4 | Attempt to access admin-only screen (e.g., user management) | Access denied; redirect or 403 |

### TC-AUTH-05: Role-based access — all five roles
- **User Story:** US-AUTH-02
- **Type:** F | **Priority:** P0
- **Precondition:** Test accounts exist for all five roles

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Log in as Technician | Only Technician screens visible |
| 2 | Log in as Dispatcher | Only Dispatcher screens visible |
| 3 | Log in as QA Reviewer | Only QA Reviewer screens visible |
| 4 | Log in as Operations Manager | Only Operations Manager screens visible |
| 5 | Log in as Administrator | All screens visible |
| 6 | For each non-admin role, attempt admin URL directly | Access denied for each |

### TC-AUTH-06: Role change takes effect on next login
- **User Story:** US-AUTH-02
- **Type:** F | **Priority:** P1
- **Precondition:** User is logged in as Technician

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Admin changes user role from Technician to Dispatcher | Role updated |
| 2 | User continues working in current session | Still sees Technician screens (old session) |
| 3 | User logs out and logs back in | Now sees Dispatcher screens |

### TC-AUTH-07: Logout clears session
- **User Story:** US-AUTH-03
- **Type:** F | **Priority:** P0
- **Precondition:** User is logged in

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Log Out" | Session cleared, redirected to login page |
| 2 | Attempt to access authenticated route via URL | Redirected to login |
| 3 | Verify offline data persists | Local IndexedDB data still available |

### TC-AUTH-08: Pending sync resumes after re-login
- **User Story:** US-AUTH-03
- **Type:** I | **Priority:** P1
- **Precondition:** User has pending offline sync data

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | User has pending offline records, logs out | Records remain in local storage |
| 2 | Log back in with network available | Sync resumes automatically |
| 3 | Verify records sync successfully | Records show "synced" status |

---

## 2. Asset Registry

### TC-ASSET-01: Create organization
- **User Story:** US-ASSET-01
- **Type:** F | **Priority:** P0
- **Precondition:** Administrator is logged in

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to Asset Registry → Create Organization | Organization form displayed |
| 2 | Enter unique name and save | Organization created with unique ID |
| 3 | Verify in hierarchy navigation | Organization appears in the asset tree |

### TC-ASSET-02: Reject duplicate organization
- **User Story:** US-ASSET-01
- **Type:** F | **Priority:** P0
- **Precondition:** Organization "Acme Wind" exists

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create organization with name "Acme Wind" | Rejected with error: "Organization already exists" |
| 2 | Create organization with name "Acme Wind " (trailing space) | Rejected or trimmed and rejected |

### TC-ASSET-03: Create site under organization
- **User Story:** US-ASSET-02
- **Type:** F | **Priority:** P0
- **Precondition:** Organization exists

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Select organization, click "Add Site" | Site form displayed |
| 2 | Enter name, coordinates, save | Site created with unique ID |
| 3 | Verify in hierarchy | Site listed under parent organization |
| 4 | Search for site by name | Site appears in search results |

### TC-ASSET-04: Create turbine with IEC 61400-25 naming
- **User Story:** US-ASSET-03
- **Type:** F | **Priority:** P0
- **Precondition:** Site exists

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Select site, click "Add Turbine" | Turbine form displayed |
| 2 | Enter turbine ID conforming to RDS-PP naming (e.g., "WTG01"), status, owner | Turbine created |
| 3 | Verify naming validation | Non-conforming IDs are rejected with guidance |
| 4 | Verify in hierarchy | Turbine listed under site |

### TC-ASSET-05: Create subsystem under turbine
- **User Story:** US-ASSET-04
- **Type:** F | **Priority:** P0
- **Precondition:** Turbine exists

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Select turbine, click "Add Subsystem" | Subsystem form displayed |
| 2 | Enter name (e.g., "Gearbox"), type, save | Subsystem created with unique ID |
| 3 | Verify in hierarchy | Subsystem listed under turbine |

### TC-ASSET-06: Create component under subsystem
- **User Story:** US-ASSET-05
- **Type:** F | **Priority:** P0
- **Precondition:** Subsystem exists

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Select subsystem, click "Add Component" | Component form displayed |
| 2 | Enter name (e.g., "Bearing"), save | Component created with unique ID |
| 3 | Verify component has status field and empty history | Component detail shows no linked records yet |

### TC-ASSET-07: Browse full asset hierarchy
- **User Story:** US-ASSET-06
- **Type:** F | **Priority:** P0
- **Precondition:** Full hierarchy exists (org → site → turbine → subsystem → component)

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open asset registry | Top-level organizations listed |
| 2 | Click organization | Sites listed underneath |
| 3 | Click site | Turbines listed |
| 4 | Click turbine | Subsystems listed |
| 5 | Click subsystem | Components listed |
| 6 | Verify breadcrumb at component level | Shows: Org > Site > Turbine > Subsystem > Component |

### TC-ASSET-08: View asset detail and history
- **User Story:** US-ASSET-07
- **Type:** F | **Priority:** P1
- **Precondition:** Asset has linked inspections and tickets

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open asset detail view | Metadata, status, owner, location displayed |
| 2 | Click "History" tab | Chronological list of inspections, defects, tickets, work orders |
| 3 | Click a historical inspection | Full inspection record opens with evidence accessible |

### TC-ASSET-09: Reject duplicate turbine at same site
- **User Story:** US-ASSET-08
- **Type:** F | **Priority:** P0
- **Precondition:** Turbine "WTG01" exists at Site A

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create turbine "WTG01" at Site A | Rejected: "Turbine with this ID already exists at this site" |
| 2 | Create turbine "WTG01" at Site B | Allowed (same ID, different parent) |

---

## 3. Inspection Templates & Forms

### TC-INS-01: Create inspection template with all field types
- **User Story:** US-INS-01
- **Type:** F | **Priority:** P0
- **Precondition:** Administrator is logged in

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open template builder | Template creation form displayed |
| 2 | Add one of each field type: text, numeric, pass/fail, dropdown, photo, video, annotation, signature | All fields added successfully |
| 3 | Set template scope (inspection type, turbine model) | Scope set |
| 4 | Save template | Template saved as JSON schema with version 1 |

### TC-INS-02: Edit template creates new version
- **User Story:** US-INS-02
- **Type:** F | **Priority:** P1
- **Precondition:** Template v1 exists, one inspection is in progress using v1

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Edit template, add a new field, save | New version (v2) created |
| 2 | Verify version history | Shows v1 and v2 |
| 3 | Open in-progress inspection using v1 | Form still uses v1 schema, not affected by edit |
| 4 | Start new inspection with this template | Uses v2 schema |

### TC-INS-03: Render inspection form from template (online)
- **User Story:** US-INS-03
- **Type:** F | **Priority:** P0
- **Precondition:** Template exists, technician is assigned an inspection

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open assigned inspection | Dynamic form rendered from template schema |
| 2 | Verify all field types render correctly | Text input, numeric input, pass/fail toggle, dropdown, camera button, etc. |
| 3 | Leave a required field blank and submit | Validation error highlights the missing field |
| 4 | Enter text in a numeric field | Validation error: "Must be a number" |

### TC-INS-04: Render inspection form offline
- **User Story:** US-INS-03
- **Type:** I | **Priority:** P0
- **Precondition:** Inspection pre-loaded, device is offline

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Go offline, open assigned inspection | Form renders fully from cached template |
| 2 | Fill out all fields | All field types work |
| 3 | Save locally | Saved to IndexedDB with sync status "pending" |

### TC-INS-05: Submit inspection online
- **User Story:** US-INS-04
- **Type:** F | **Priority:** P0
- **Precondition:** Technician has completed an inspection form

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Fill all required fields | Form validates |
| 2 | Click "Submit" | Inspection submitted with timestamp, technician ID, asset ID, form data |
| 3 | Verify in backend | Record exists in database with all data intact |

### TC-INS-06: Submit inspection offline — queued for sync
- **User Story:** US-INS-04
- **Type:** I | **Priority:** P0
- **Precondition:** Device is offline

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Fill and submit inspection offline | Record saved locally, status "pending" |
| 2 | Verify record in local storage | Present in IndexedDB |
| 3 | Come back online | Sync triggers automatically |
| 4 | Verify in backend after sync | Record exists in database |

### TC-INS-07: Idempotent submission — no duplicates
- **User Story:** US-INS-04
- **Type:** I | **Priority:** P0
- **Precondition:** Inspection submitted but network is unstable

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Submit inspection | Client generates unique ID for the record |
| 2 | Network drops during submission, app retries | Same record sent again with same client ID |
| 3 | Verify in backend | Exactly one record exists (not two) |

### TC-INS-08: View inspection history for an asset
- **User Story:** US-INS-05
- **Type:** F | **Priority:** P1
- **Precondition:** Asset has multiple completed inspections

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open asset detail → Inspections tab | List of inspections in reverse chronological order |
| 2 | Verify each entry shows date, technician, status, defect count | All columns present |
| 3 | Click an inspection | Full record opens with form data and evidence |

---

## 4. Offline Mobile Capture

### TC-OFF-01: App detects connectivity loss
- **User Story:** US-OFF-01
- **Type:** F | **Priority:** P0
- **Precondition:** App is open and online

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Disable network on device | Offline indicator appears on screen |
| 2 | Fill out an inspection form | Works without error |
| 3 | Capture a photo | Works without error |
| 4 | Verify data stored in IndexedDB | All data present locally |

### TC-OFF-02: Pre-load data before site visit
- **User Story:** US-OFF-02
- **Type:** I | **Priority:** P0
- **Precondition:** Technician has assigned inspections

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | While online, trigger pre-load | App downloads assigned inspections, asset data, templates, reference materials |
| 2 | Verify pre-load indicator | Shows which data is available offline |
| 3 | Go offline | All pre-loaded data remains accessible |
| 4 | Open a pre-loaded inspection | Form renders fully from cached data |

### TC-OFF-03: Automatic sync on reconnect
- **User Story:** US-OFF-03
- **Type:** I | **Priority:** P0
- **Precondition:** Technician has pending offline records

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Go online with pending records | Sync starts automatically |
| 2 | Monitor sync status per record | Status transitions: pending → syncing → synced |
| 3 | Verify failed sync handling | Failed records show "failed" with retry option |
| 4 | Verify retry behavior | Failed records retry with exponential backoff |

### TC-OFF-04: Field-level merge on sync conflict
- **User Story:** US-OFF-04
- **Type:** I | **Priority:** P0
- **Precondition:** Technician edits a field offline; another user edits a different field on the same record online

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Technician edits Field A offline | Local change saved |
| 2 | QA reviewer edits Field B on server | Server record updated |
| 3 | Technician comes online, sync triggers | Field A merged (technician's change), Field B preserved (reviewer's change) |
| 4 | Verify no data loss | Both changes present in final record |

### TC-OFF-05: Safety-critical data conflict rejection
- **User Story:** US-OFF-04
- **Type:** I | **Priority:** P0
- **Precondition:** Safety-critical field has sequence number versioning

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Technician edits safety field offline with version 5 | Local change saved |
| 2 | Server version is now 6 (another user changed it) | Version mismatch |
| 3 | Technician syncs | Sync rejected for that record |
| 4 | Verify flagging | Record flagged for immediate dispatcher/reviewer review |
| 5 | Verify audit trail | Conflict event logged |

### TC-OFF-06: Duplicate submission never creates duplicate
- **User Story:** US-OFF-05
- **Type:** I | **Priority:** P0
- **Precondition:** Network is intermittent

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Submit an inspection | Client generates unique client ID |
| 2 | Simulate network retry (same payload sent 3 times) | Server processes once |
| 3 | Verify backend | Exactly one record with that client ID |
| 4 | Verify response | Server returns success (not error) for duplicate attempts |

---

## 5. Evidence Management

### TC-EVID-01: Capture photo from inspection form
- **User Story:** US-EVID-01
- **Type:** F | **Priority:** P0
- **Precondition:** Technician is filling out an inspection form

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Tap camera button on form | Device camera opens |
| 2 | Take a photo | Photo captured and attached to the form |
| 3 | Verify auto-tagging | Photo tagged with asset ID, inspection ID, timestamp, technician ID |
| 4 | Submit inspection with photo | Photo queued for upload |
| 5 | Verify upload | Photo stored in S3, linked to inspection |

### TC-EVID-02: Capture video from inspection form
- **User Story:** US-EVID-02
- **Type:** F | **Priority:** P0
- **Precondition:** Technician is filling out an inspection form

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Tap video button on form | Video recorder opens |
| 2 | Record a video (under 500 MB) | Video captured and attached |
| 3 | Submit inspection | Video queued for upload |
| 4 | Verify server processing | Original stored + 720p preview generated |

### TC-EVID-03: Upload existing file
- **User Story:** US-EVID-03
- **Type:** F | **Priority:** P0
- **Precondition:** Technician has a file to upload

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Tap "Attach File" on form | File picker opens |
| 2 | Select a supported file (JPEG, PNG, MP4, PDF) | File attached to the form |
| 3 | Verify upload progress | Progress bar visible during upload |
| 4 | Verify failed upload retry | If upload fails, automatic retry occurs |

### TC-EVID-04: Reject unsupported file type
- **User Story:** US-EVID-03
- **Type:** F | **Priority:** P1
- **Precondition:** Technician attempts to upload an unsupported file

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Select an .exe or .zip file | File rejected with error: "Unsupported file type" |
| 2 | Verify only JPEG, PNG, MP4, PDF accepted | Other types rejected |

### TC-EVID-05: Reject oversized file
- **User Story:** US-EVID-01, US-EVID-02
- **Type:** F | **Priority:** P1
- **Precondition:** Technician has an oversized file

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Upload an image > 50 MB | Rejected: "Image exceeds 50 MB limit" |
| 2 | Upload a video > 500 MB | Rejected: "Video exceeds 500 MB limit" |

### TC-EVID-06: Annotate an evidence image
- **User Story:** US-EVID-04
- **Type:** F | **Priority:** P1
- **Precondition:** Evidence image exists

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open evidence viewer | Image displayed with zoom/pan |
| 2 | Add annotation (arrow, circle, text label) | Annotation drawn on image |
| 3 | Save annotation | Annotation saved as separate overlay data, original image unmodified |
| 4 | Open evidence as another user | Annotations visible |

### TC-EVID-07: Search evidence library
- **User Story:** US-EVID-05
- **Type:** F | **Priority:** P1
- **Precondition:** Evidence library contains multiple items

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open evidence search | Search bar and filters displayed |
| 2 | Search by asset ID | Results show only evidence linked to that asset |
| 3 | Filter by media type "photo" | Only photos shown |
| 4 | Filter by date range | Only evidence within range shown |
| 5 | Click a result | Full evidence item opens with linked record context |

### TC-EVID-08: Evidence version history
- **User Story:** US-EVID-06
- **Type:** F | **Priority:** P2
- **Precondition:** Evidence item has been annotated and approved

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open evidence detail | Version history tab available |
| 2 | View version history | Shows: upload event, annotation event, approval event with author and timestamp |
| 3 | Verify original file preserved | Original image downloadable, separate from annotations |

---

## 6. Ticket & Work Order Management

### TC-TKT-01: Create ticket from defect
- **User Story:** US-TKT-01
- **Type:** E2E | **Priority:** P0
- **Precondition:** QA reviewer is viewing an inspection with a defect

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open inspection, find a defect | Defect details visible |
| 2 | Click "Create Ticket" | Ticket creation form pre-populated with asset link, defect description, severity, evidence |
| 3 | Verify pre-populated fields | Asset ID, description, severity, and evidence are auto-filled |
| 4 | Submit ticket | Ticket created with status "New" |
| 5 | Verify audit trail | Ticket creation event logged |

### TC-TKT-02: Ticket status transitions — valid path
- **User Story:** US-TKT-02
- **Type:** F | **Priority:** P0
- **Precondition:** Ticket exists in status "New"

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Move to "Triaged" | Transition succeeds |
| 2 | Move to "Assigned" | Transition succeeds |
| 3 | Move to "In Progress" | Transition succeeds |
| 4 | Move to "Pending Review" | Transition succeeds |
| 5 | Move to "Closed" | Transition succeeds |
| 6 | Verify each transition in history | Each shows who, when, and any notes |

### TC-TKT-03: Ticket status transitions — invalid path rejected
- **User Story:** US-TKT-02
- **Type:** F | **Priority:** P0
- **Precondition:** Ticket is in status "New"

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Attempt to move directly to "Closed" (skip states) | Transition rejected: "Invalid status transition" |
| 2 | Attempt to move to "In Progress" from "New" | Transition rejected |
| 3 | Verify state machine enforcement | Only valid next states are available in the UI |

### TC-TKT-04: Assign ticket to technician
- **User Story:** US-TKT-03
- **Type:** F | **Priority:** P0
- **Precondition:** Ticket is "Triaged", technicians are available

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open ticket, click "Assign" | Available technicians listed |
| 2 | Select a technician and confirm | Ticket status → "Assigned" |
| 3 | Verify technician notification | Technician receives notification of new assignment |
| 4 | Verify audit trail | Assignment logged with dispatcher ID and timestamp |

### TC-TKT-05: Update ticket priority and severity
- **User Story:** US-TKT-04
- **Type:** F | **Priority:** P0
- **Precondition:** Ticket exists

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Change priority to "Critical" | Priority updated, displayed in red |
| 2 | Change severity to "High" | Severity updated |
| 3 | Verify audit trail | Changes logged |
| 4 | Verify escalation for "Critical" | Escalation notification sent to operations manager |

### TC-TKT-06: Add resolution notes and submit for review
- **User Story:** US-TKT-05
- **Type:** F | **Priority:** P0
- **Precondition:** Ticket is "In Progress", technician is assigned

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Add resolution notes (rich text) | Notes saved |
| 2 | Attach completion evidence | Evidence linked |
| 3 | Click "Submit for Review" | Ticket status → "Pending Review" |
| 4 | Verify reviewer notification | QA reviewer notified |

### TC-TKT-07: Close a ticket via QA review
- **User Story:** US-TKT-05
- **Type:** F | **Priority:** P0
- **Precondition:** Ticket is "Pending Review"

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | QA reviewer opens ticket in review queue | Ticket details shown |
| 2 | Click "Approve and Close" | Ticket status → "Closed" |
| 3 | Verify audit trail | Closure approved by reviewer, logged |

### TC-TKT-08: Reopen a closed ticket
- **User Story:** US-TKT-06
- **Type:** F | **Priority:** P0
- **Precondition:** Ticket is "Closed"

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Reopen" | Prompt for reason |
| 2 | Enter reason and confirm | Ticket status → "Reopened" |
| 3 | Verify on dashboard | Reopened ticket appears on dashboards and dispatcher board |
| 4 | Verify audit trail | Reopen event logged with reason |

### TC-TKT-09: Link evidence to ticket
- **User Story:** US-TKT-07
- **Type:** F | **Priority:** P1
- **Precondition:** Ticket and evidence items exist

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open ticket, click "Link Evidence" | Evidence library picker opens |
| 2 | Select evidence items | Items linked with "linked by" and "linked at" metadata |
| 3 | Verify on ticket detail | Linked evidence visible and accessible |

### TC-TKT-10: Create work order from ticket
- **User Story:** US-TKT-08
- **Type:** F | **Priority:** P1
- **Precondition:** Ticket exists with asset and assignee

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open ticket, click "Create Work Order" | Work order form pre-populated |
| 2 | Set due date and save | Work order created, linked to ticket and asset |
| 3 | Verify on technician's task list | Work order appears |

---

## 7. Technician Availability & Absence

### TC-AVAIL-01: Technician sets own status
- **User Story:** US-AVAIL-01
- **Type:** F | **Priority:** P0
- **Precondition:** Technician is logged in

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open status selector | All status options visible: Available, Assigned, Traveling, On-site, On break, Sick, Training, Leave, Unavailable |
| 2 | Set status to "Sick" | Status updated immediately |
| 3 | Verify dispatcher sees change | Dispatcher board reflects new status |
| 4 | Verify timestamp logged | Status change logged with timestamp |

### TC-AVAIL-02: Dispatcher views team availability
- **User Story:** US-AVAIL-02
- **Type:** F | **Priority:** P0
- **Precondition:** Multiple technicians with varying statuses

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Dispatcher opens availability board | All technicians listed with status, location, skills, active assignments |
| 2 | Filter by skill "Blade Repair" | Only technicians with that skill shown |
| 3 | Filter by location "Site A" | Only technicians at/near Site A shown |
| 4 | Verify color coding | Status colors clearly distinguish available/unavailable/assigned |

### TC-AVAIL-03: Mark technician absent (dispatcher)
- **User Story:** US-AVAIL-03
- **Type:** F | **Priority:** P0
- **Precondition:** Technician has open assignments

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Select technician, click "Mark Absent" | Absence form displayed |
| 2 | Enter reason, start time, expected return, notes | Fields populated |
| 3 | Save | Technician status → unavailable |
| 4 | Verify open assignments flagged | All open assignments flagged for reassignment |
| 5 | Verify audit trail | Absence event logged |

### TC-AVAIL-04: Technician self-reports sick
- **User Story:** US-AVAIL-04
- **Type:** F | **Priority:** P0
- **Precondition:** Technician has open assignments

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Technician sets status to "Sick" with reason | Status updated |
| 2 | Verify dispatcher notification | Dispatcher receives notification |
| 3 | Verify assignments flagged | Open assignments flagged for reassignment |

### TC-AVAIL-05: View absence history
- **User Story:** US-AVAIL-05
- **Type:** F | **Priority:** P2
- **Precondition:** Team has absence records

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open absence history view | Records listed per technician |
| 2 | Filter by date range | Only absences within range shown |
| 3 | Filter by reason "Sick" | Only sick absences shown |
| 4 | Verify each record shows duration and assignment impact | All fields present |

---

## 8. Replacement Suggestions

### TC-REPL-01: System suggests ranked replacements
- **User Story:** US-REPL-01
- **Type:** I | **Priority:** P0
- **Precondition:** Technician marked absent with open assignments

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Dispatcher opens replacement view for absent technician | Candidates listed, ranked by score |
| 2 | Verify score breakdown per candidate | Shows: skill match %, cert match %, proximity %, workload %, familiarity % |
| 3 | Verify weighted calculation | Weighted total matches: skill 30% + cert 25% + proximity 20% + workload 15% + familiarity 10% |
| 4 | Verify reason codes | Each candidate explains why they are suitable |
| 5 | Verify threshold flagging | Candidates below 60% flagged for escalation |

### TC-REPL-02: Reassign all open assignments
- **User Story:** US-REPL-02
- **Type:** I | **Priority:** P0
- **Precondition:** Replacement candidates available

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Select a candidate | Candidate highlighted |
| 2 | Click "Reassign All" | Confirmation prompt shown |
| 3 | Confirm | All open assignments transfer to replacement |
| 4 | Verify notifications | Both original and replacement technician notified |
| 5 | Verify replacement sees new assignments | Assignments appear on replacement's home screen |

### TC-REPL-03: Escalation when no qualified replacement
- **User Story:** US-REPL-03
- **Type:** I | **Priority:** P0
- **Precondition:** No candidate scores above 60%

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | System detects no qualified replacement | Escalation notification sent to operations manager |
| 2 | Verify escalation content | Includes affected assignments, required skills/certs |
| 3 | Verify audit trail | Escalation logged |

### TC-REPL-04: Technician accepts substitute assignment
- **User Story:** US-REPL-04
- **Type:** F | **Priority:** P0
- **Precondition:** Technician received a reassignment notification

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open notification | Assignment details displayed |
| 2 | Click "Accept" | Assignment confirmed, appears on task list |
| 3 | Verify dispatcher view | Assignment shows as accepted |

### TC-REPL-05: Technician declines substitute assignment
- **User Story:** US-REPL-04
- **Type:** F | **Priority:** P1
- **Precondition:** Technician received a reassignment notification

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open notification, click "Decline" | Prompt for reason |
| 2 | Enter reason and confirm | Decline recorded |
| 3 | Verify dispatcher notification | Dispatcher notified of decline with reason |
| 4 | Verify dispatcher can choose another candidate | Replacement view remains accessible |

---

## 9. Dispatcher Board

### TC-DISP-01: Coverage board — filter and view
- **User Story:** US-DISP-01
- **Type:** F | **Priority:** P0
- **Precondition:** Assignments and technicians exist across multiple sites

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open dispatch board | Coverage view displayed |
| 2 | Filter by day | Shows assignments and availability for selected day |
| 3 | Filter by site | Shows only that site's assignments |
| 4 | Filter by skill "Electrical" | Shows only technicians/assignments requiring that skill |
| 5 | Verify coverage gaps highlighted | Gaps clearly visible with color coding |

### TC-DISP-02: Identify SLA risk from absences
- **User Story:** US-DISP-02
- **Type:** I | **Priority:** P0
- **Precondition:** Technician with SLA-bound assignment is marked absent

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | View dispatch board | Absent technician's assignments flagged with SLA risk indicator |
| 2 | Verify SLA details | Shows time remaining before breach |
| 3 | Click flagged assignment | Opens replacement suggestions |

### TC-DISP-03: Assign inspection from board
- **User Story:** US-DISP-03
- **Type:** F | **Priority:** P1
- **Precondition:** Unassigned inspection exists, technicians available

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Drag inspection to a technician | Assignment created |
| 2 | Verify skill/cert check | System warns if technician lacks required skills |
| 3 | Confirm assignment | Technician notified |

---

## 10. Dashboard & Reporting

### TC-DASH-01: Operational dashboard loads correctly
- **User Story:** US-DASH-01
- **Type:** F | **Priority:** P0
- **Precondition:** System has data across sites

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open dashboard | All KPIs displayed: open ticket count, ticket aging, SLA compliance, sync failure rate, defect trends, coverage gaps |
| 2 | Filter by site | Metrics update for selected site |
| 3 | Filter by date range | Metrics update for selected range |
| 4 | Verify near real-time updates | Metrics refresh without page reload |

### TC-DASH-02: Ticket aging report
- **User Story:** US-DASH-02
- **Type:** F | **Priority:** P0
- **Precondition:** Tickets in various statuses with varying ages

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open ticket aging view | Tickets grouped by age in each status |
| 2 | Verify SLA highlighting | Tickets near or past SLA targets are highlighted |
| 3 | Click a ticket | Opens ticket detail view |

### TC-DASH-03: Defect trend chart
- **User Story:** US-DASH-03
- **Type:** F | **Priority:** P1
- **Precondition:** Defect data across multiple assets and time periods

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open defect trends view | Chart shows defect count by asset class over time |
| 2 | Change date range | Chart updates |
| 3 | Click on a data point | Filtered defect list opens for that asset class and period |
| 4 | Click "Export" | Data downloads for external analysis |

### TC-DASH-04: Export report as PDF
- **User Story:** US-DASH-04
- **Type:** F | **Priority:** P1
- **Precondition:** Report data exists

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Select report type and date range | Report preview generated |
| 2 | Click "Export PDF" | PDF downloaded |
| 3 | Verify PDF content | Contains data snapshot and evidence as of export date |
| 4 | Re-export same report later | Report is reproducible from stored data |

### TC-DASH-05: Sync health monitoring
- **User Story:** US-DASH-05
- **Type:** F | **Priority:** P0
- **Precondition:** Technicians have been syncing data

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open sync health view | Sync success rate per technician displayed |
| 2 | Click a failed sync entry | Error details shown |
| 3 | Verify sync events traceable | Each event logged with timestamps |

---

## 11. Search & Audit Trail

### TC-SEARCH-01: Global search
- **User Story:** US-SEARCH-01
- **Type:** F | **Priority:** P0
- **Precondition:** Assets, tickets, and evidence exist

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Type a turbine ID in global search | Results grouped by: assets, tickets, evidence |
| 2 | Filter by date range | Results narrow |
| 3 | Filter by status "Open" | Only open tickets shown |
| 4 | Combine filters (site + severity + date) | Results match all criteria |

### TC-SEARCH-02: Filter ticket list
- **User Story:** US-SEARCH-02
- **Type:** F | **Priority:** P0
- **Precondition:** Multiple tickets exist

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open ticket list, apply status filter "In Progress" | Only in-progress tickets shown |
| 2 | Add priority filter "Critical" | Only critical, in-progress tickets shown |
| 3 | Navigate away and return | Filters preserved |

### TC-AUDIT-01: View audit trail for a ticket
- **User Story:** US-AUDIT-01
- **Type:** F | **Priority:** P0
- **Precondition:** Ticket has been through multiple status changes

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open ticket detail, click "Audit Trail" | All events listed chronologically |
| 2 | Verify each event shows: timestamp, user, action, before/after | All columns present |
| 3 | Verify audit trail is read-only | No edit or delete buttons available |

### TC-AUDIT-02: Export audit trail
- **User Story:** US-AUDIT-02
- **Type:** F | **Priority:** P1
- **Precondition:** Audit data exists

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Select scope (e.g., a specific asset, date range) | Scope applied |
| 2 | Click "Export CSV" | CSV downloaded with all audit events |
| 3 | Verify export logged | Export event appears in audit trail |

---

## 12. Technician Mobile Workflow

### TC-MOB-01: Assigned inspections on home screen
- **User Story:** US-MOB-01
- **Type:** F | **Priority:** P0
- **Precondition:** Technician has assigned inspections

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open app (home screen) | Assigned inspections listed, sorted by due date |
| 2 | Verify each card | Shows turbine name, inspection type, status |
| 3 | Verify sync indicator | Offline/sync status visible on home screen |

### TC-MOB-02: One-tap start inspection
- **User Story:** US-MOB-02
- **Type:** F | **Priority:** P0
- **Precondition:** Inspection is pre-loaded

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Tap an assigned inspection card | Inspection form opens immediately |
| 2 | Verify start time recorded | Start timestamp logged |
| 3 | Verify works offline | Form loads from cached template |

### TC-MOB-03: Complete and submit inspection from mobile
- **User Story:** US-MOB-03
- **Type:** F | **Priority:** P0
- **Precondition:** Technician has filled out an inspection form

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Fill all required fields | Form validates successfully |
| 2 | Click "Submit" | Success confirmation shown |
| 3 | Verify completion time recorded | Timestamp logged |
| 4 | Verify online vs. offline behavior | Online: submits immediately. Offline: queued, shows "pending" |

### TC-MOB-04: QR code scan for asset identification
- **User Story:** US-MOB-04
- **Type:** F | **Priority:** P2
- **Precondition:** Assets have QR codes

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Tap QR scan button | Camera opens in scan mode |
| 2 | Scan turbine QR code | Asset resolved and displayed |
| 3 | Tap "Start Inspection" from scanned asset | Inspection form opens pre-linked to that asset |
| 4 | Tap "Create Ticket" from scanned asset | Ticket form opens pre-linked to that asset |

### TC-MOB-05: View sync status summary
- **User Story:** US-MOB-05
- **Type:** F | **Priority:** P0
- **Precondition:** Technician has records in various sync states

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open sync status view | Summary shows count of pending, synced, failed records |
| 2 | Verify per-record indicators | Each record shows icon: pending/synced/failed/conflict |
| 3 | Tap a failed record | Retry action available |

### TC-MOB-06: Install PWA to home screen
- **User Story:** US-MOB-06
- **Type:** F | **Priority:** P1
- **Precondition:** App loaded in mobile browser

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open app in mobile browser | "Add to Home Screen" prompt appears |
| 2 | Accept prompt | App installed |
| 3 | Open from home screen | Opens in fullscreen mode (no browser chrome) |
| 4 | Verify icon and splash | Branded icon and splash screen displayed |

---

## 13. Admin Settings

### TC-ADMIN-01: Create and deactivate user
- **User Story:** US-ADMIN-01
- **Type:** F | **Priority:** P0
- **Precondition:** Administrator is logged in

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open user management, click "Add User" | User form displayed |
| 2 | Enter name, email, role, skills | All fields saved |
| 3 | Save | User created, visible in user list |
| 4 | Deactivate user | User cannot log in, but history preserved |

### TC-ADMIN-02: Change user role
- **User Story:** US-ADMIN-01
- **Type:** F | **Priority:** P0
- **Precondition:** User exists with role "Technician"

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Edit user, change role to "Dispatcher" | Role updated |
| 2 | Verify on next login | User sees Dispatcher screens |

### TC-ADMIN-03: Manage skills and certifications
- **User Story:** US-ADMIN-02
- **Type:** F | **Priority:** P0
- **Precondition:** Administrator is logged in

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create skill "Blade Repair" with category "Maintenance" | Skill created |
| 2 | Assign skill to technician with proficiency level and date | Assignment saved |
| 3 | Create certification "GWO Working at Heights" with validity period | Certification created |
| 4 | Assign cert to technician with issue date, expiry, certificate URL | Assignment saved |
| 5 | Verify expired cert flagging | Expired certifications highlighted in red |

### TC-ADMIN-04: Configure workflow rules
- **User Story:** US-ADMIN-03
- **Type:** F | **Priority:** P1
- **Precondition:** Administrator is logged in

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open workflow configuration | Current transitions and rules displayed |
| 2 | Define allowed transition: "New → Triaged" | Saved |
| 3 | Define escalation rule for Critical tickets | Saved |
| 4 | Configure notification trigger for assignment events | Saved |

### TC-ADMIN-05: Template builder — drag and drop
- **User Story:** US-ADMIN-04
- **Type:** F | **Priority:** P0
- **Precondition:** Administrator is logged in

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open template builder | Field type palette displayed |
| 2 | Drag "Text" field onto canvas | Field added |
| 3 | Drag "Numeric" field, set min/max | Field added with constraints |
| 4 | Drag "Pass/Fail" toggle | Field added |
| 5 | Drag "Photo" capture field | Field added |
| 6 | Click "Preview" | Form shown as technician would see it |
| 7 | Save template with scope | Template saved and available for use |

---

## 14. Non-Functional Tests

### TC-NFR-01: Image compression before upload
- **User Story:** US-NFR-01
- **Type:** NF | **Priority:** P0
- **Precondition:** Large image file ready

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Upload a 10 MB JPEG | Client compresses before upload |
| 2 | Verify upload payload size | Compressed size significantly smaller than original |
| 3 | Verify server stores original + thumbnail | Original preserved, 800px thumbnail generated |

### TC-NFR-02: S3 presigned URL upload
- **User Story:** US-NFR-01
- **Type:** NF | **Priority:** P0
- **Precondition:** File ready for upload

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Upload a video file | Client gets presigned URL, uploads directly to S3 |
| 2 | Verify no server bottleneck | Upload goes directly to S3, not through API server |
| 3 | Verify progress bar | Upload progress displayed accurately |

### TC-NFR-03: Data persists across app restart
- **User Story:** US-NFR-02
- **Type:** NF | **Priority:** P0
- **Precondition:** Technician has unsynced data

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create records offline | Data stored in IndexedDB |
| 2 | Close and reopen app | All offline data still present |
| 3 | Kill app process and reopen | All offline data still present |

### TC-NFR-04: Sync retry with backoff
- **User Story:** US-NFR-02
- **Type:** NF | **Priority:** P0
- **Precondition:** Sync fails due to server error

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Submit data, simulate server 500 error | Sync fails, record shows "failed" |
| 2 | Wait and observe retry behavior | Retry after delay, then longer delay (exponential backoff) |
| 3 | Fix server, verify eventual success | Record syncs successfully |

### TC-NFR-05: Local storage encryption
- **User Story:** US-NFR-03
- **Type:** NF | **Priority:** P1
- **Precondition:** App has cached data

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Inspect IndexedDB contents | Data is encrypted, not plaintext |
| 2 | Log out and log in as different user | Cannot see previous user's data |
| 3 | Log back in as original user | Offline cache restored |

### TC-NFR-06: Page load performance
- **User Story:** US-NFR-04
- **Type:** NF | **Priority:** P1
- **Precondition:** System has data

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Load login page | Under 3 seconds |
| 2 | Load dashboard with 10,000 records | Under 5 seconds |
| 3 | Execute a search query | Results under 2 seconds |
| 4 | Load evidence thumbnails | Progressive loading, no blocking |

---

## 15. QA Review Workflow

### TC-QA-01: Review submitted inspection
- **User Story:** US-QA-01
- **Type:** F | **Priority:** P0
- **Precondition:** Inspection submitted by technician

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open QA review queue | Submitted inspections listed |
| 2 | Open an inspection | All form data, evidence, and metadata visible |
| 3 | Click "Approve" | Inspection marked as approved |
| 4 | Click "Reject" with comments | Inspection returned to technician with comments |

### TC-QA-02: Approve or flag evidence
- **User Story:** US-QA-02
- **Type:** F | **Priority:** P0
- **Precondition:** Evidence items pending review

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open evidence review queue | Items with status "pending" listed |
| 2 | Approve an evidence item | Status → "approved", available for reports |
| 3 | Flag an evidence item with comments | Status → "flagged", returned to technician with comments |

### TC-QA-03: Approve or reject ticket closure
- **User Story:** US-QA-03
- **Type:** F | **Priority:** P0
- **Precondition:** Tickets in "Pending Review" status

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open ticket review queue | Tickets in "Pending Review" listed |
| 2 | Approve closure | Ticket → "Closed" |
| 3 | Reopen with comments | Ticket → "Reopened", technician notified |
| 4 | Verify audit trail | Approval/rejection logged |

---

## End-to-End Test Scenarios

### E2E-01: Full inspection-to-ticket flow
- **Stories covered:** US-INS-03, US-INS-04, US-OFF-01, US-EVID-01, US-TKT-01, US-QA-01, US-TKT-06, US-QA-03
- **Priority:** P0

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Technician pre-loads assignments (online) | Data cached locally |
| 2 | Go offline, open assigned inspection | Form renders from cache |
| 3 | Fill form, capture photos, save locally | All data stored in IndexedDB |
| 4 | Come online, sync triggers | Data uploaded successfully |
| 5 | QA reviewer opens submitted inspection | All data and evidence visible |
| 6 | QA creates ticket from defect | Ticket created with status "New" |
| 7 | Dispatcher assigns ticket to technician | Ticket → "Assigned" |
| 8 | Technician adds resolution notes and evidence | Ticket → "Pending Review" |
| 9 | QA approves closure | Ticket → "Closed" |
| 10 | Verify full audit trail | Every step traceable with timestamps and users |

### E2E-02: Absence-to-reassignment flow
- **Stories covered:** US-AVAIL-04, US-AVAIL-03, US-REPL-01, US-REPL-02, US-REPL-04, US-DISP-02
- **Priority:** P0

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Technician marks self sick from mobile | Status updated, dispatcher notified |
| 2 | Dispatcher opens replacement view | Ranked candidates with score breakdown |
| 3 | Dispatcher selects top candidate | Candidate profile and reason codes displayed |
| 4 | Reassign all open assignments | Assignments transferred |
| 5 | Replacement technician accepts | Assignment confirmed on home screen |
| 6 | Verify SLA risk resolved | Flagged assignments no longer at risk |
| 7 | Verify full audit trail | Absence, suggestions, reassignment all logged |

### E2E-03: Offline evidence capture and sync flow
- **Stories covered:** US-OFF-02, US-EVID-01, US-EVID-02, US-OFF-03, US-OFF-05, US-EVID-06
- **Priority:** P0

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Pre-load inspection data | All data cached |
| 2 | Go offline | Offline indicator visible |
| 3 | Complete inspection with 5 photos and 1 video | All captured locally with tags |
| 4 | Submit offline | Status "pending" |
| 5 | Come online | Sync triggers automatically |
| 6 | Verify all evidence uploaded | Photos and video in S3, thumbnails generated |
| 7 | Verify version history | Upload events recorded with timestamps |

---

## 16. User Acceptance Testing

### TC-UAT-01: Technician completes a full inspection day
- **User Story:** US-MOB-01, US-INS-03, US-OFF-01, US-EVID-01
- **Type:** UAT | **Priority:** P2
- **Precondition:** Real technician logged in on own device, assigned a real inspection

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open app, verify assigned inspections visible | Home screen shows today's work |
| 2 | Go offline (airplane mode), open inspection | Form loads, all field types work |
| 3 | Fill form, capture 3 photos, 1 video, submit | Saved locally, status "pending" |
| 4 | Come online, wait for sync | All data syncs, photos appear in evidence library |
| 5 | Technician confirms: "I could do this on a real turbine without help" | Pass/Fail |

### TC-UAT-02: Dispatcher handles technician absence
- **User Story:** US-AVAIL-03, US-REPL-01, US-REPL-02, US-DISP-02
- **Type:** UAT | **Priority:** P2
- **Precondition:** Real dispatcher logged in, test technician marked absent

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Receive absence notification | Notification arrives within 30 seconds |
| 2 | Open replacement suggestions | Ranked candidates with score breakdown visible |
| 3 | Review reason codes, pick best candidate | Understandable without training |
| 4 | Reassign all open work | Assignments transfer, replacement notified |
| 5 | Dispatcher confirms: "I could handle a sick call at 6 AM without confusion" | Pass/Fail |

### TC-UAT-03: QA reviewer approves inspection and creates ticket
- **User Story:** US-QA-01, US-QA-02, US-TKT-01
- **Type:** UAT | **Priority:** P2
- **Precondition:** Real QA reviewer logged in, submitted inspection with defects

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open review queue, select inspection | All data and evidence visible |
| 2 | Zoom into photos, review annotations | Image viewer works smoothly |
| 3 | Approve evidence, reject one photo with comment | Statuses update correctly |
| 4 | Create ticket from defect | Ticket pre-populated with all context |
| 5 | Reviewer confirms: "I can validate quality faster than in our current spreadsheet process" | Pass/Fail |

### TC-UAT-04: Operations manager monitors fleet status
- **User Story:** US-DASH-01, US-DASH-02, US-DASH-05
- **Type:** UAT | **Priority:** P2
- **Precondition:** Real operations manager logged in, live system with data

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open dashboard | All KPIs load within 5 seconds |
| 2 | Identify SLA-risk tickets | Color coding clearly highlights at-risk items |
| 3 | Check sync health across technicians | Failed syncs visible with technician names |
| 4 | Filter by site and date | Filters respond instantly |
| 5 | Manager confirms: "This gives me visibility I don't have today" | Pass/Fail |

---

## Test Data & Fixtures

### Seed Dataset

The following test data must be loaded before test execution:

#### Organizations & Sites
| Entity | Name | Details |
|--------|------|---------|
| Organization | North Sea Wind Corp | Multi-site customer |
| Organization | Baltic Energy Ltd | Single-site customer |
| Site | Hornsea Reef (North Sea Wind Corp) | 54.1°N, 1.5°E, 45 turbines |
| Site | Riga Bay (Baltic Energy Ltd) | 56.9°N, 24.1°E, 12 turbines |

#### Turbines & Assets
| Entity | ID | Parent | Details |
|--------|-----|--------|---------|
| Turbine | WTG-HR-01 | Hornsea Reef | Vestas V164, active |
| Turbine | WTG-HR-22 | Hornsea Reef | Siemens SG 14-222, active |
| Turbine | WTG-RB-05 | Riga Bay | Vestas V164, active |
| Subsystem | Blade Assembly | WTG-HR-01 | — |
| Subsystem | Gearbox | WTG-HR-22 | — |
| Component | Trailing Edge | Blade Assembly (WTG-HR-01) | — |
| Component | Main Bearing | Gearbox (WTG-HR-22) | — |

#### Users
| Role | Name | Email | Skills | Certifications |
|------|------|-------|--------|----------------|
| Field Technician | Alex Petrov | alex@test.com | Blade Repair (Expert), Rope Access (Advanced) | GWO Working at Heights (exp. 2027-03), GWO First Aid (exp. 2026-11) |
| Field Technician | Maria Santos | maria@test.com | Blade Repair (Intermediate), Electrical (Basic) | GWO Working at Heights (exp. 2027-06) |
| Field Technician | Jan Kowalski | jan@test.com | Gearbox Specialist (Expert), Vibration Analysis (Advanced) | GWO Working at Heights (exp. 2027-01), LOTO Certified (exp. 2026-09) |
| Field Technician | Sam Chen | sam@test.com | Electrical (Expert), Drone Pilot (Advanced) | GWO First Aid (exp. 2027-05), Drone License (exp. 2027-08) |
| QA Reviewer | Lena Berg | lena@test.com | — | — |
| Dispatcher / Planner | Tom Miller | tom@test.com | — | — |
| Operations Manager | Priya Sharma | priya@test.com | — | — |
| Administrator | Admin User | admin@test.com | — | — |

#### Inspection Templates
| Template | Version | Scope | Fields |
|----------|---------|-------|--------|
| Blade Inspection v1 | 1 | All sites, all turbine models | 12 fields: 4× text, 2× numeric (mm), 2× pass/fail, 2× photo, 1× dropdown, 1× signature |
| Gearbox Inspection v1 | 1 | All sites, all turbine models | 10 fields: 3× text, 3× numeric, 1× pass/fail, 1× photo, 1× dropdown, 1× annotation |

#### Pre-Created Data
| Entity | Count | Purpose |
|--------|-------|---------|
| Completed inspections (various assets) | 15 | Dashboard metrics, history views, search |
| Open tickets (across all statuses) | 10 | Ticket lifecycle, dispatcher board, SLA testing |
| Defects (varying severity) | 8 | Ticket creation, defect trends |
| Evidence items (photos + 2 videos) | 25 | Evidence library, search, sync testing |
| Absence records | 3 | Absence history, replacement testing |

#### Edge Case Scenarios
| Scenario | Setup |
|----------|-------|
| Two technicians with identical skills | Maria and Alex both have Blade Repair — test replacement ranking tie-breaking |
| Technician goes offline mid-inspection | Alex starts inspection, then airplane mode — test data preservation |
| Ticket from partially synced record | Sync inspection but not evidence — test ticket creation with missing data |
| Replacement with insufficient certification | Only Sam available for Blade Repair task (no Blade skill) — test escalation |
| Expired certification | Jan's LOTO cert expired — test expired cert flagging |
| Oversized video upload | 600 MB MP4 file — test file size rejection |
| Concurrent edits on same ticket | Two users edit same ticket simultaneously — test conflict handling |

---

## Traceability Matrix

### User Story → Test Case Coverage

| User Story | Test Case(s) | Priority |
|------------|-------------|----------|
| US-AUTH-01 | TC-AUTH-01, TC-AUTH-02, TC-AUTH-03 | P0/P1 |
| US-AUTH-02 | TC-AUTH-04, TC-AUTH-05, TC-AUTH-06 | P0/P1 |
| US-AUTH-03 | TC-AUTH-07, TC-AUTH-08 | P0/P1 |
| US-ASSET-01 | TC-ASSET-01, TC-ASSET-02 | P0 |
| US-ASSET-02 | TC-ASSET-03 | P0 |
| US-ASSET-03 | TC-ASSET-04 | P0 |
| US-ASSET-04 | TC-ASSET-05 | P0 |
| US-ASSET-05 | TC-ASSET-06 | P0 |
| US-ASSET-06 | TC-ASSET-07 | P0 |
| US-ASSET-07 | TC-ASSET-08 | P1 |
| US-ASSET-08 | TC-ASSET-09 | P0 |
| US-INS-01 | TC-INS-01 | P0 |
| US-INS-02 | TC-INS-02 | P1 |
| US-INS-03 | TC-INS-03, TC-INS-04 | P0 |
| US-INS-04 | TC-INS-05, TC-INS-06, TC-INS-07 | P0 |
| US-INS-05 | TC-INS-08 | P1 |
| US-OFF-01 | TC-OFF-01 | P0 |
| US-OFF-02 | TC-OFF-02 | P0 |
| US-OFF-03 | TC-OFF-03 | P0 |
| US-OFF-04 | TC-OFF-04, TC-OFF-05 | P0 |
| US-OFF-05 | TC-OFF-06 | P0 |
| US-EVID-01 | TC-EVID-01, TC-EVID-05 | P0/P1 |
| US-EVID-02 | TC-EVID-02, TC-EVID-05 | P0/P1 |
| US-EVID-03 | TC-EVID-03, TC-EVID-04 | P0/P1 |
| US-EVID-04 | TC-EVID-06 | P1 |
| US-EVID-05 | TC-EVID-07 | P1 |
| US-EVID-06 | TC-EVID-08 | P2 |
| US-TKT-01 | TC-TKT-01 | P0 |
| US-TKT-02 | TC-TKT-02, TC-TKT-03 | P0 |
| US-TKT-03 | TC-TKT-04 | P0 |
| US-TKT-04 | TC-TKT-05 | P0 |
| US-TKT-05 | TC-TKT-06, TC-TKT-07 | P0 |
| US-TKT-06 | TC-TKT-08 | P0 |
| US-TKT-07 | TC-TKT-09 | P1 |
| US-TKT-08 | TC-TKT-10 | P1 |
| US-AVAIL-01 | TC-AVAIL-01 | P0 |
| US-AVAIL-02 | TC-AVAIL-02 | P0 |
| US-AVAIL-03 | TC-AVAIL-03 | P0 |
| US-AVAIL-04 | TC-AVAIL-04 | P0 |
| US-AVAIL-05 | TC-AVAIL-05 | P2 |
| US-REPL-01 | TC-REPL-01 | P0 |
| US-REPL-02 | TC-REPL-02 | P0 |
| US-REPL-03 | TC-REPL-03 | P0 |
| US-REPL-04 | TC-REPL-04, TC-REPL-05 | P0/P1 |
| US-DISP-01 | TC-DISP-01 | P0 |
| US-DISP-02 | TC-DISP-02 | P0 |
| US-DISP-03 | TC-DISP-03 | P1 |
| US-DASH-01 | TC-DASH-01 | P0 |
| US-DASH-02 | TC-DASH-02 | P0 |
| US-DASH-03 | TC-DASH-03 | P1 |
| US-DASH-04 | TC-DASH-04 | P1 |
| US-DASH-05 | TC-DASH-05 | P0 |
| US-SEARCH-01 | TC-SEARCH-01 | P0 |
| US-SEARCH-02 | TC-SEARCH-02 | P0 |
| US-AUDIT-01 | TC-AUDIT-01 | P0 |
| US-AUDIT-02 | TC-AUDIT-02 | P1 |
| US-MOB-01 | TC-MOB-01 | P0 |
| US-MOB-02 | TC-MOB-02 | P0 |
| US-MOB-03 | TC-MOB-03 | P0 |
| US-MOB-04 | TC-MOB-04 | P2 |
| US-MOB-05 | TC-MOB-05 | P0 |
| US-MOB-06 | TC-MOB-06 | P1 |
| US-ADMIN-01 | TC-ADMIN-01, TC-ADMIN-02 | P0 |
| US-ADMIN-02 | TC-ADMIN-03 | P0 |
| US-ADMIN-03 | TC-ADMIN-04 | P1 |
| US-ADMIN-04 | TC-ADMIN-05 | P0 |
| US-NFR-01 | TC-NFR-01, TC-NFR-02 | P0 |
| US-NFR-02 | TC-NFR-03, TC-NFR-04 | P0 |
| US-NFR-03 | TC-NFR-05 | P1 |
| US-NFR-04 | TC-NFR-06 | P1 |
| US-QA-01 | TC-QA-01 | P0 |
| US-QA-02 | TC-QA-02 | P0 |
| US-QA-03 | TC-QA-03 | P0 |

---

## Summary

| Metric | Count |
|--------|-------|
| **User Stories** | 52 |
| **Test Cases** | 76 |
| **E2E Scenarios** | 3 |
| **UAT Scenarios** | 4 |
| **P0 (Critical)** | 54 test cases |
| **P1 (High)** | 14 test cases |
| **P2 (Medium)** | 8 test cases |
| **Coverage** | 100% (all user stories traced to test cases) |
