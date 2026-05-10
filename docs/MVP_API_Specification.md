# MVP API Specification

## 1. Overview

| Property | Value |
|----------|-------|
| Base URL | `https://api.cmms.example.com/v1` |
| Protocol | HTTPS only |
| Content-Type | `application/json` |
| Versioning | URL path (`/v1/`) |
| Auth | JWT Bearer token in `Authorization` header |
| Idempotency | `X-Idempotency-Key` header on POST/PUT |
| Rate Limit | 100 req/min per user; headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` |

### Common Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | Yes (except login) | `Bearer <jwt_token>` |
| `Content-Type` | Yes (write ops) | `application/json` |
| `X-Idempotency-Key` | Recommended | Client-generated UUID for idempotent writes |
| `X-Request-ID` | No | Trace ID for debugging |

---

## 2. Authentication

### POST /auth/login

Authenticate and receive JWT tokens.

**Request:**
```json
{
  "email": "string",
  "password": "string"
}
```

**Response 200:**
```json
{
  "accessToken": "string (JWT, 15min TTL)",
  "refreshToken": "string (JWT, 7d TTL)",
  "expiresIn": 900,
  "user": {
    "id": "uuid",
    "email": "string",
    "name": "string",
    "role": "TECHNICIAN | DISPATCHER | QA_REVIEWER | OPERATIONS_MANAGER | ADMINISTRATOR"
  }
}
```

**Errors:** 401 AUTH_001 (invalid credentials), 429 RATE_001 (too many attempts)

### POST /auth/refresh

Refresh access token.

**Request:**
```json
{
  "refreshToken": "string"
}
```

**Response 200:** Same as login response.

**Errors:** 401 AUTH_002 (invalid/expired refresh token)

### POST /auth/logout

Invalidate current tokens.

**Request:** (empty body, uses Bearer token)

**Response 204:** No content.

### GET /auth/me

Get current user profile with role and permissions.

**Response 200:**
```json
{
  "id": "uuid",
  "email": "string",
  "name": "string",
  "role": "string",
  "skills": [{ "id": "uuid", "name": "string", "proficiencyLevel": "string", "acquiredDate": "date" }],
  "certifications": [{ "id": "uuid", "name": "string", "issuedDate": "date", "expiryDate": "date", "isValid": true }]
}
```

---

## 3. Common Patterns

### Pagination (cursor-based)

**Query params:** `?cursor=<id>&limit=25`

**Response envelope:**
```json
{
  "data": [],
  "pagination": {
    "cursor": "string | null",
    "limit": 25,
    "hasMore": true
  }
}
```

### Filtering & Sorting

- Filters: `?status=OPEN&priority=HIGH&assigneeId=uuid`
- Sort: `?sort=createdAt&order=desc`
- Date ranges: `?createdAfter=2025-01-01&createdBefore=2025-12-31`

### Error Response Format

```json
{
  "error": {
    "code": "ASSET_001",
    "message": "Human-readable description",
    "details": {}
  }
}
```

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 204 | No content (success, no body) |
| 400 | Validation error |
| 401 | Unauthorized |
| 403 | Forbidden (role insufficient) |
| 404 | Not found |
| 409 | Conflict (duplicate, state mismatch) |
| 422 | Unprocessable entity |
| 429 | Rate limited |
| 500 | Internal server error |

---

## 4. Role Access Matrix

| Endpoint Group | Technician | Dispatcher | QA Reviewer | Ops Manager | Admin |
|---------------|-----------|-----------|-------------|-------------|-------|
| Auth | R/W own | R/W own | R/W own | R/W own | R/W own |
| Assets | R | R | R | R | R/W |
| Inspection Templates | R | R | R | R | R/W |
| Inspections | R/W own | R | R/W assigned | R | R |
| Evidence | R/W own | R | R/W | R | R |
| Tickets | R assigned | R/W | R/W review | R | R/W |
| Work Orders | R assigned | R/W | R | R | R |
| Availability | R/W own | R all | — | R all | R/W all |
| Replacements | R own assignments | R/W | — | R | — |
| Dispatch Board | — | R/W | — | R | — |
| Dashboard | — | — | — | R | R |
| Search | R | R | R | R | R |
| Audit Trail | R own | R assigned | R assigned | R all | R all |
| Admin (users, skills, certs, rules) | — | — | — | — | R/W |
| Sync | R/W own | — | — | R stats | — |

---

## 5. Assets

### Organizations

#### GET /organizations
List organizations (paginated).

**Query:** `?cursor=&limit=25&search=`

**Response 200:**
```json
{
  "data": [{
    "id": "uuid",
    "name": "string",
    "createdAt": "datetime",
    "siteCount": 5
  }],
  "pagination": {}
}
```

#### POST /organizations
Create organization. **Admin only.**

**Request:** `{ "name": "string" }`

**Response 201:** `{ "id": "uuid", "name": "string", "createdAt": "datetime" }`

**Errors:** 409 ASSET_001 (duplicate name)

#### GET /organizations/:id
**Response 200:**
```json
{
  "id": "uuid",
  "name": "string",
  "createdAt": "datetime",
  "sites": [{ "id": "uuid", "name": "string", "turbineCount": 12 }]
}
```

#### PUT /organizations/:id
**Request:** `{ "name": "string" }`

**Response 200:** Updated organization object.

#### DELETE /organizations/:id
Soft delete. Sets `deletedAt`. **Admin only.**

**Response 204.**

**Errors:** 409 ASSET_002 (has child sites)

### Sites

#### GET /organizations/:orgId/sites
#### POST /organizations/:orgId/sites
**Request:**
```json
{
  "name": "string",
  "latitude": 54.1,
  "longitude": 1.5
}
```
**Errors:** 409 ASSET_003 (duplicate site name in org)

#### GET /sites/:id
#### PUT /sites/:id
#### DELETE /sites/:id

### Turbines

#### GET /sites/:siteId/turbines
#### POST /sites/:siteId/turbines
**Request:**
```json
{
  "externalId": "WTG-HR-01",
  "name": "string",
  "model": "Vestas V164",
  "status": "ACTIVE",
  "ownerId": "uuid"
}
```
Validates `externalId` against IEC 61400-25 / RDS-PP naming rules.
**Errors:** 400 ASSET_004 (invalid naming format), 409 ASSET_005 (duplicate externalId at site)

#### GET /turbines/:id
#### PUT /turbines/:id
#### DELETE /turbines/:id

### Subsystems

#### GET /turbines/:turbineId/subsystems
#### POST /turbines/:turbineId/subsystems
**Request:** `{ "name": "Gearbox", "type": "DRIVE_TRAIN" }`

#### GET /subsystems/:id
#### PUT /subsystems/:id
#### DELETE /subsystems/:id

### Components

#### GET /subsystems/:subsystemId/components
#### POST /subsystems/:subsystemId/components
**Request:** `{ "name": "Main Bearing", "status": "ACTIVE" }`

#### GET /components/:id
#### PUT /components/:id
#### DELETE /components/:id

### Asset History

#### GET /assets/:id/history
Get full history for any asset (organization, site, turbine, subsystem, component).

**Query:** `?cursor=&limit=25&type=INSPECTION|DEFECT|TICKET|WORK_ORDER`

**Response 200:**
```json
{
  "data": [{
    "id": "uuid",
    "type": "INSPECTION",
    "summary": "Blade inspection completed — 2 defects found",
    "date": "datetime",
    "userId": "uuid",
    "userName": "string"
  }],
  "pagination": {}
}
```

---

## 6. Inspection Templates

#### GET /templates
List templates. **Query:** `?scope=BLADE&version=latest`

#### POST /templates
**Admin only.**

**Request:**
```json
{
  "name": "Blade Inspection",
  "description": "string",
  "scope": { "inspectionType": "BLADE", "turbineModel": null, "siteId": null },
  "fields": [
    { "name": "trailing_edge_damage", "label": "Trailing Edge Damage", "type": "PASS_FAIL", "required": true, "options": null },
    { "name": "crack_length_mm", "label": "Crack Length (mm)", "type": "NUMERIC", "required": false, "options": { "min": 0, "max": 5000 } },
    { "name": "notes", "label": "Notes", "type": "TEXT", "required": false, "options": null },
    { "name": "damage_photo", "label": "Damage Photo", "type": "PHOTO", "required": true, "options": null },
    { "name": "severity", "label": "Severity", "type": "DROPDOWN", "required": true, "options": { "choices": ["COSMETIC", "MINOR", "MAJOR", "CRITICAL"] } },
    { "name": "inspector_signature", "label": "Signature", "type": "SIGNATURE", "required": true, "options": null }
  ]
}
```

**Response 201:** Template object with `version: 1`.

#### GET /templates/:id
Returns latest version. **Query:** `?version=2` for specific version.

#### GET /templates/:id/versions
List all versions.

#### POST /templates/:id/versions
Create new version from current. **Admin only.**

**Request:**
```json
{
  "fields": [/* updated field array */],
  "changeNote": "Added LiDAR measurement field"
}
```

#### PUT /templates/:id
Updates metadata only (name, description, scope). Does not change fields — use versions for that.

#### DELETE /templates/:id
Soft delete. **Admin only.**

---

## 7. Inspections

#### GET /inspections
List inspections. **Query:** `?assigneeId=uuid&assetId=uuid&status=SUBMITTED&createdAfter=&createdBefore=&cursor=&limit=25&sort=createdAt&order=desc`

**Response 200:**
```json
{
  "data": [{
    "id": "uuid",
    "templateId": "uuid",
    "templateName": "Blade Inspection",
    "templateVersion": 2,
    "assigneeId": "uuid",
    "assigneeName": "string",
    "assetId": "uuid",
    "assetName": "WTG-HR-01 — Trailing Edge",
    "status": "SUBMITTED",
    "defectCount": 2,
    "createdAt": "datetime",
    "submittedAt": "datetime"
  }],
  "pagination": {}
}
```

#### POST /inspections
Create and optionally submit.

**Request:**
```json
{
  "templateId": "uuid",
  "assigneeId": "uuid",
  "assetId": "uuid",
  "scheduledDate": "date",
  "clientId": "uuid (client-generated for idempotency)"
}
```

**Response 201:**
```json
{
  "id": "uuid",
  "status": "ASSIGNED",
  "syncStatus": "SYNCED",
  "createdAt": "datetime"
}
```

#### GET /inspections/:id
Full inspection record.

**Response 200:**
```json
{
  "id": "uuid",
  "templateId": "uuid",
  "templateVersion": 2,
  "assignee": { "id": "uuid", "name": "string" },
  "asset": { "id": "uuid", "name": "string", "path": "Org > Site > WTG > Subsystem > Component" },
  "status": "SUBMITTED",
  "syncStatus": "SYNCED",
  "fieldData": {
    "trailing_edge_damage": { "value": "FAIL", "type": "PASS_FAIL" },
    "crack_length_mm": { "value": 145, "type": "NUMERIC" },
    "notes": { "value": "Visible crack with delamination", "type": "TEXT" }
  },
  "evidence": [{ "id": "uuid", "type": "PHOTO", "thumbnailUrl": "string" }],
  "defects": [{ "id": "uuid", "severity": "MAJOR", "description": "string" }],
  "reviewNotes": "string",
  "reviewedBy": { "id": "uuid", "name": "string" },
  "createdAt": "datetime",
  "submittedAt": "datetime",
  "reviewedAt": "datetime"
}
```

#### PUT /inspections/:id
Update field data. Allowed only if status is `ASSIGNED` or `IN_PROGRESS` or `CHANGES_REQUESTED`.

**Request:**
```json
{
  "fieldData": { "crack_length_mm": { "value": 152 } },
  "status": "IN_PROGRESS"
}
```

#### POST /inspections/:id/submit
Submit for review. Status → `SUBMITTED`.

**Request:** `{ "notes": "string" }`

**Errors:** 422 INSP_001 (required fields missing), 409 INSP_002 (already submitted)

#### POST /inspections/:id/approve
QA approve. **QA Reviewer only.** Status → `APPROVED`.

**Request:** `{ "notes": "string" }`

#### POST /inspections/:id/reject
QA reject. **QA Reviewer only.** Status → `REJECTED` or `CHANGES_REQUESTED`.

**Request:**
```json
{
  "action": "REJECT | REQUEST_CHANGES",
  "notes": "Missing crack measurement, please re-inspect"
}
```

---

## 8. Sync

### POST /sync/push
Push local changes to server. Supports batch.

**Request:**
```json
{
  "changes": [
    {
      "entityType": "INSPECTION",
      "entityId": "uuid",
      "clientId": "uuid",
      "version": 5,
      "data": { "fieldData": {} },
      "timestamp": "datetime"
    }
  ]
}
```

**Response 200:**
```json
{
  "results": [
    {
      "entityType": "INSPECTION",
      "entityId": "uuid",
      "status": "SYNCED | CONFLICT | REJECTED",
      "serverVersion": 6,
      "conflicts": null
    },
    {
      "entityType": "INSPECTION",
      "entityId": "uuid",
      "status": "CONFLICT",
      "serverVersion": 7,
      "conflicts": [
        { "field": "safetyStatus", "clientValue": "CLEAR", "serverValue": "FLAGGED", "resolution": "MANUAL_REVIEW_REQUIRED" }
      ]
    }
  ]
}
```

**Errors:** 409 SYNC_001 (version mismatch on safety data — sync rejected)

### GET /sync/pull
Pull changes since last sync.

**Query:** `?since=2025-05-01T00:00:00Z&entityTypes=INSPECTION,TICKET,EVIDENCE`

**Response 200:**
```json
{
  "changes": [{
    "entityType": "INSPECTION",
    "entityId": "uuid",
    "action": "UPDATE",
    "version": 6,
    "data": {},
    "timestamp": "datetime"
  }],
  "serverTime": "datetime",
  "hasMore": false
}
```

### GET /sync/status
Get sync status for current user's records.

**Response 200:**
```json
{
  "pending": 3,
  "synced": 45,
  "failed": 1,
  "conflicts": 0,
  "failedRecords": [{ "entityType": "string", "entityId": "uuid", "error": "string", "lastAttempt": "datetime" }]
}
```

---

## 9. Evidence

### POST /evidence/upload-url
Get S3 presigned URL for direct upload.

**Request:**
```json
{
  "fileName": "blade_damage_01.jpg",
  "fileType": "PHOTO",
  "fileSize": 4500000,
  "mimeType": "image/jpeg"
}
```

**Response 200:**
```json
{
  "uploadUrl": "https://s3.example.com/presigned-url...",
  "evidenceId": "uuid",
  "fields": { "key": "string", "policy": "string", "signature": "string" }
}
```

**Errors:** 400 EVID_001 (unsupported file type), 400 EVID_002 (file too large)

### POST /evidence
Confirm upload and create metadata record.

**Request:**
```json
{
  "id": "uuid (from upload-url response)",
  "fileName": "blade_damage_01.jpg",
  "fileType": "PHOTO",
  "fileSize": 4500000,
  "mimeType": "image/jpeg",
  "assetId": "uuid",
  "inspectionId": "uuid",
  "ticketId": null,
  "capturedAt": "datetime",
  "deviceSource": "iPhone 15 Pro",
  "clientId": "uuid"
}
```

**Response 201:** Full evidence item object.

### GET /evidence
Search evidence library.

**Query:** `?assetId=&siteId=&turbineId=&componentId=&inspectionId=&ticketId=&mediaType=PHOTO|VIDEO|PDF&authorId=&createdAfter=&createdBefore=&approvalStatus=PENDING|APPROVED|FLAGGED&cursor=&limit=25`

### GET /evidence/:id
**Response 200:**
```json
{
  "id": "uuid",
  "fileName": "blade_damage_01.jpg",
  "fileType": "PHOTO",
  "fileSize": 4500000,
  "mimeType": "image/jpeg",
  "url": "string (original)",
  "thumbnailUrl": "string (800px)",
  "assetId": "uuid",
  "assetName": "string",
  "inspectionId": "uuid",
  "ticketId": null,
  "authorId": "uuid",
  "authorName": "string",
  "capturedAt": "datetime",
  "deviceSource": "string",
  "approvalStatus": "PENDING",
  "syncStatus": "SYNCED",
  "annotations": [],
  "version": 1,
  "versions": [
    { "version": 1, "action": "UPLOAD", "author": "string", "timestamp": "datetime" }
  ],
  "createdAt": "datetime"
}
```

### POST /evidence/:id/annotations
Add annotation overlay.

**Request:**
```json
{
  "annotations": [
    {
      "type": "ARROW | CIRCLE | TEXT",
      "data": { "x": 120, "y": 340, "width": 80, "height": 40, "text": "Crack origin" },
      "color": "#FF0000"
    }
  ]
}
```

### PUT /evidence/:id/approve
**QA Reviewer only.** Sets approvalStatus → `APPROVED`.

### PUT /evidence/:id/flag
**QA Reviewer only.** Sets approvalStatus → `FLAGGED`.

**Request:** `{ "reason": "Blurry image, please recapture" }`

---

## 10. Tickets

#### GET /tickets
**Query:** `?status=OPEN&priority=HIGH&severity=MAJOR&assigneeId=&assetId=&siteId=&createdAfter=&createdBefore=&cursor=&limit=25&sort=createdAt&order=desc`

#### POST /tickets
Create ticket. Optionally from a defect.

**Request:**
```json
{
  "defectId": "uuid | null",
  "assetId": "uuid",
  "title": "string",
  "description": "string",
  "priority": "HIGH",
  "severity": "MAJOR",
  "category": "BLADE_DAMAGE",
  "dueDate": "date",
  "slaTarget": "datetime",
  "evidenceIds": ["uuid"]
}
```

**Response 201:**
```json
{
  "id": "uuid",
  "status": "NEW",
  "ticketNumber": "TKT-2025-0042",
  "defectId": "uuid",
  "assetId": "uuid",
  "title": "string",
  "priority": "HIGH",
  "severity": "MAJOR",
  "assigneeId": null,
  "createdAt": "datetime"
}
```

#### GET /tickets/:id
Full ticket detail including status history, evidence, audit events.

**Response 200:**
```json
{
  "id": "uuid",
  "ticketNumber": "TKT-2025-0042",
  "defectId": "uuid",
  "asset": { "id": "uuid", "name": "string", "path": "string" },
  "title": "string",
  "description": "string",
  "priority": "HIGH",
  "severity": "MAJOR",
  "category": "string",
  "status": "ASSIGNED",
  "assignee": { "id": "uuid", "name": "string" },
  "dueDate": "date",
  "slaTarget": "datetime",
  "slaRemaining": "P2DT5H",
  "rootCause": null,
  "resolutionNotes": null,
  "evidence": [{ "id": "uuid", "type": "PHOTO", "thumbnailUrl": "string" }],
  "statusHistory": [
    { "from": "NEW", "to": "TRIAGED", "userId": "uuid", "userName": "string", "timestamp": "datetime", "notes": null }
  ],
  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

#### PATCH /tickets/:id/status
Transition ticket status. Validates against state machine.

**Request:** `{ "status": "TRIAGED", "notes": "string" }`

**Valid transitions:**
```
NEW → TRIAGED → ASSIGNED → IN_PROGRESS → PENDING_REVIEW → CLOSED
                                                  ↑_____________|
CLOSED → REOPENED → TRIAGED
```

**Errors:** 422 TKT_001 (invalid transition), 409 TKT_002 (conflict — status changed by another user)

#### POST /tickets/:id/assign
**Request:** `{ "assigneeId": "uuid" }`

Status → `ASSIGNED`. Validates assignee has required skills.

**Errors:** 422 TKT_003 (assignee lacks required skills/certs)

#### POST /tickets/:id/close
Submit for closure. Status → `PENDING_REVIEW`.

**Request:**
```json
{
  "resolutionNotes": "string (rich text)",
  "rootCause": "string",
  "evidenceIds": ["uuid"]
}
```

#### POST /tickets/:id/reopen
**Request:** `{ "reason": "string" }`

Status → `REOPENED`. **Errors:** 422 TKT_004 (ticket not in CLOSED status)

#### POST /tickets/:id/evidence
Link existing evidence to ticket.

**Request:** `{ "evidenceIds": ["uuid"] }`

#### GET /tickets/:id/audit-trail
Full audit events for this ticket.

**Response 200:**
```json
{
  "data": [{
    "id": "uuid",
    "action": "STATUS_CHANGE",
    "userId": "uuid",
    "userName": "string",
    "details": { "from": "NEW", "to": "TRIAGED" },
    "timestamp": "datetime"
  }]
}
```

---

## 11. Work Orders

#### GET /work-orders
**Query:** `?ticketId=&assigneeId=&assetId=&status=&cursor=&limit=25`

#### POST /work-orders
Create work order from ticket.

**Request:**
```json
{
  "ticketId": "uuid",
  "assetId": "uuid",
  "assigneeId": "uuid",
  "title": "string",
  "description": "string",
  "dueDate": "date",
  "priority": "HIGH"
}
```

**Response 201:** Work order object.

#### GET /work-orders/:id
#### PUT /work-orders/:id
#### PATCH /work-orders/:id/status
#### DELETE /work-orders/:id

Work orders share similar lifecycle patterns with tickets.

---

## 12. Technician Availability

#### GET /technicians
List technicians with current status.

**Query:** `?status=AVAILABLE&skillId=&certificationId=&siteId=&shiftWindow=&cursor=&limit=25`

**Response 200:**
```json
{
  "data": [{
    "id": "uuid",
    "name": "string",
    "email": "string",
    "status": "AVAILABLE",
    "siteId": "uuid",
    "siteName": "string",
    "skills": [{ "id": "uuid", "name": "Blade Repair", "proficiencyLevel": "EXPERT" }],
    "certifications": [{ "id": "uuid", "name": "GWO Working at Heights", "isValid": true }],
    "activeAssignments": 2,
    "lastStatusChange": "datetime"
  }],
  "pagination": {}
}
```

#### PATCH /technicians/:id/status
Update technician status. Technician can update own status; dispatcher/admin can update any.

**Request:**
```json
{
  "status": "SICK",
  "notes": "Feeling unwell, expected return tomorrow"
}
```

**Response 200:** Updated technician status.

#### POST /technicians/:id/absence
Record absence.

**Request:**
```json
{
  "reason": "SICK",
  "startDate": "datetime",
  "expectedReturnDate": "date",
  "notes": "string"
}
```

**Response 201:**
```json
{
  "id": "uuid",
  "technicianId": "uuid",
  "reason": "SICK",
  "startDate": "datetime",
  "expectedReturnDate": "date",
  "approvalStatus": "PENDING",
  "affectedAssignments": 3,
  "replacementSuggestionsAvailable": true
}
```

#### GET /technicians/:id/absence-history
**Query:** `?reason=&createdAfter=&createdBefore=`

#### GET /technicians/:id/assignments
List active assignments for a technician.

---

## 13. Replacement Suggestions

#### GET /technicians/:id/replacement-suggestions
Get ranked replacement candidates for an absent technician.

**Response 200:**
```json
{
  "absentTechnicianId": "uuid",
  "absenceId": "uuid",
  "affectedAssignments": [
    { "id": "uuid", "type": "INSPECTION", "title": "string", "dueDate": "date", "slaTarget": "datetime" }
  ],
  "candidates": [
    {
      "technicianId": "uuid",
      "name": "string",
      "totalScore": 0.85,
      "scoreBreakdown": {
        "skillMatch": 0.90,
        "certificationMatch": 0.80,
        "proximity": 0.95,
        "workloadCapacity": 0.75,
        "siteFamiliarity": 0.80
      },
      "reasonCodes": [
        "Has Blade Repair skill (Expert)",
        "GWO Working at Heights valid until 2027-06",
        "Currently at Hornsea Reef site",
        "Has capacity: 2 of 5 assignments used"
      ],
      "warnings": [],
      "currentStatus": "AVAILABLE",
      "currentAssignments": 2
    }
  ],
  "escalationRequired": false
}
```

#### POST /replacements
Execute reassignment.

**Request:**
```json
{
  "absenceId": "uuid",
  "candidateId": "uuid",
  "assignmentIds": ["uuid", "uuid"],
  "reason": "Technician sick, reassigning to top candidate"
}
```

**Response 201:**
```json
{
  "id": "uuid",
  "status": "PENDING_ACCEPTANCE",
  "reassignedCount": 2,
  "candidate": { "id": "uuid", "name": "string" },
  "assignments": [{ "id": "uuid", "type": "INSPECTION", "status": "REASSIGNED" }]
}
```

#### POST /replacements/:id/accept
Replacement accepts. **By replacement technician only.**

**Response 200:** `{ "status": "ACCEPTED" }`

#### POST /replacements/:id/decline
Replacement declines.

**Request:** `{ "reason": "string" }`

**Response 200:** `{ "status": "DECLINED" }`

---

## 14. Dispatch Board

#### GET /dispatch/coverage
Coverage view by filters.

**Query:** `?date=2025-05-09&siteId=&teamId=&skillId=&view=DAY|WEEK`

**Response 200:**
```json
{
  "date": "date",
  "siteId": "uuid",
  "technicians": [
    {
      "id": "uuid",
      "name": "string",
      "status": "ASSIGNED",
      "assignments": [
        { "id": "uuid", "type": "INSPECTION", "title": "string", "assetName": "string", "timeWindow": "08:00-12:00" }
      ],
      "coverageGaps": []
    }
  ],
  "gaps": [
    { "skill": "Blade Repair", "site": "Hornsea Reef", "timeWindow": "08:00-16:00", "severity": "HIGH" }
  ]
}
```

#### GET /dispatch/sla-risk
Tickets and assignments at SLA risk.

**Response 200:**
```json
{
  "atRisk": [
    {
      "id": "uuid",
      "type": "TICKET",
      "ticketNumber": "TKT-2025-0042",
      "title": "string",
      "assigneeId": "uuid",
      "assigneeName": "string",
      "slaTarget": "datetime",
      "slaRemaining": "PT3H25M",
      "riskLevel": "HIGH",
      "absenceRelated": true,
      "replacementSuggestionUrl": "/v1/technicians/uuid/replacement-suggestions"
    }
  ]
}
```

#### POST /dispatch/assign
Assign inspection or work order to technician.

**Request:**
```json
{
  "assignmentType": "INSPECTION",
  "assignmentId": "uuid",
  "technicianId": "uuid"
}
```

**Errors:** 422 DISP_001 (technician lacks required skills), 422 DISP_002 (technician unavailable)

---

## 15. Dashboard

#### GET /dashboard/metrics
Aggregate KPIs.

**Query:** `?siteId=&teamId=&createdAfter=&createdBefore=`

**Response 200:**
```json
{
  "openTickets": 24,
  "ticketAging": { "avgDays": 5.2, "maxDays": 32 },
  "slaCompliance": 0.87,
  "syncSuccessRate": 0.98,
  "defectTrends": {
    "period": "2025-04-01 to 2025-05-01",
    "byAssetClass": {
      "BLADE": { "count": 12, "trend": "UP" },
      "GEARBOX": { "count": 8, "trend": "DOWN" }
    }
  },
  "coverageGaps": 3,
  "fieldProductivity": { "inspectionsCompleted": 45, "avgCompletionTimeMinutes": 42 },
  "periodStart": "datetime",
  "periodEnd": "datetime"
}
```

#### GET /dashboard/ticket-aging
**Response 200:**
```json
{
  "aging": [
    { "status": "NEW", "count": 5, "avgAgeDays": 1.2, "maxAgeDays": 3 },
    { "status": "TRIAGED", "count": 3, "avgAgeDays": 2.1, "maxAgeDays": 5 },
    { "status": "ASSIGNED", "count": 8, "avgAgeDays": 4.5, "maxAgeDays": 15 },
    { "status": "IN_PROGRESS", "count": 6, "avgAgeDays": 3.8, "maxAgeDays": 12 },
    { "status": "PENDING_REVIEW", "count": 2, "avgAgeDays": 1.0, "maxAgeDays": 2 }
  ],
  "slaBreached": 2,
  "slaAtRisk": 4
}
```

#### GET /dashboard/defect-trends
**Query:** `?period=MONTH&months=6&assetClass=`

**Response 200:**
```json
{
  "trends": [
    { "period": "2024-12", "assetClass": "BLADE", "count": 10 },
    { "period": "2025-01", "assetClass": "BLADE", "count": 12 },
    { "period": "2025-02", "assetClass": "BLADE", "count": 8 }
  ]
}
```

#### GET /dashboard/sync-health
**Response 200:**
```json
{
  "overallSuccessRate": 0.98,
  "technicians": [
    { "id": "uuid", "name": "string", "syncSuccessRate": 1.0, "pendingCount": 0, "failedCount": 0 },
    { "id": "uuid", "name": "string", "syncSuccessRate": 0.92, "pendingCount": 1, "failedCount": 2, "lastFailure": "datetime", "lastFailureError": "Network timeout" }
  ]
}
```

#### GET /dashboard/coverage-gaps
**Response 200:**
```json
{
  "gaps": [
    { "siteId": "uuid", "siteName": "string", "skill": "Blade Repair", "date": "date", "severity": "HIGH", "affectedAssignments": 3 }
  ]
}
```

---

## 16. Search

#### GET /search
Global search across assets, tickets, and evidence.

**Query:** `?q=WTG-HR-01+blade&type=ASSET,TICKET,EVIDENCE&status=&priority=&severity=&siteId=&assigneeId=&createdAfter=&createdBefore=&cursor=&limit=25`

**Response 200:**
```json
{
  "data": {
    "assets": [{ "id": "uuid", "name": "WTG-HR-01", "type": "TURBINE", "path": "Org > Site > WTG" }],
    "tickets": [{ "id": "uuid", "ticketNumber": "TKT-2025-0042", "title": "string", "status": "OPEN", "priority": "HIGH" }],
    "evidence": [{ "id": "uuid", "fileName": "string", "type": "PHOTO", "thumbnailUrl": "string" }]
  },
  "totals": { "assets": 3, "tickets": 7, "evidence": 12 },
  "pagination": {}
}
```

---

## 17. Audit Trail

#### GET /audit
Query audit events.

**Query:** `?entityType=INSPECTION|TICKET|ASSET|USER|EVIDENCE&entityId=uuid&action=CREATE|UPDATE|DELETE|STATUS_CHANGE|ASSIGN|APPROVE|REJECT|SYNC&userId=uuid&createdAfter=&createdBefore=&cursor=&limit=25`

**Response 200:**
```json
{
  "data": [{
    "id": "uuid",
    "entityType": "TICKET",
    "entityId": "uuid",
    "action": "STATUS_CHANGE",
    "userId": "uuid",
    "userName": "string",
    "userRole": "DISPATCHER",
    "details": {
      "from": { "status": "NEW" },
      "to": { "status": "TRIAGED" }
    },
    "timestamp": "datetime"
  }],
  "pagination": {}
}
```

#### GET /audit/export
Export audit events.

**Query:** `?entityType=&entityId=&createdAfter=&createdBefore=&format=CSV|PDF`

**Response:** File download (CSV or PDF).

---

## 18. Admin

### Users

#### GET /admin/users
**Query:** `?role=&status=&search=&cursor=&limit=25`

#### POST /admin/users
**Request:**
```json
{
  "email": "string",
  "name": "string",
  "password": "string",
  "role": "TECHNICIAN",
  "skillIds": ["uuid"],
  "certificationIds": ["uuid"]
}
```

**Response 201:** User object.

#### GET /admin/users/:id
#### PUT /admin/users/:id
**Request:** `{ "name": "string", "role": "DISPATCHER", "skillIds": [], "certificationIds": [] }`

#### PATCH /admin/users/:id/deactivate
Soft deactivate. User cannot log in. History preserved.

#### PATCH /admin/users/:id/activate
Reactivate user.

### Skills

#### GET /admin/skills
#### POST /admin/skills
**Request:** `{ "name": "Blade Repair", "category": "MAINTENANCE" }`

#### PUT /admin/skills/:id
#### DELETE /admin/skills/:id

### Certifications

#### GET /admin/certifications
#### POST /admin/certifications
**Request:**
```json
{
  "name": "GWO Working at Heights",
  "issuingBody": "GWO",
  "validityPeriodMonths": 24
}
```

#### PUT /admin/certifications/:id
#### DELETE /admin/certifications/:id

### Skill Assignments

#### POST /admin/users/:id/skills
**Request:**
```json
{ "skillId": "uuid", "proficiencyLevel": "EXPERT", "acquiredDate": "date" }
```

#### DELETE /admin/users/:id/skills/:skillId

### Certification Assignments

#### POST /admin/users/:id/certifications
**Request:**
```json
{ "certificationId": "uuid", "issuedDate": "date", "expiryDate": "date", "certificateUrl": "string" }
```

#### DELETE /admin/users/:id/certifications/:certificationId

### Workflow Rules

#### GET /admin/workflow-rules
List configured rules.

#### POST /admin/workflow-rules
**Request:**
```json
{
  "name": "Critical ticket escalation",
  "trigger": { "event": "TICKET_CREATED", "conditions": { "priority": "CRITICAL" } },
  "actions": [
    { "type": "NOTIFY", "targets": ["ROLE:OPERATIONS_MANAGER"], "message": "Critical ticket created: {{ticketNumber}}" },
    { "type": "SET_SLA", "targetHours": 4 }
  ],
  "enabled": true
}
```

#### PUT /admin/workflow-rules/:id
#### DELETE /admin/workflow-rules/:id

---

## 19. Enums

### Role
`TECHNICIAN`, `DISPATCHER`, `QA_REVIEWER`, `OPERATIONS_MANAGER`, `ADMINISTRATOR`

### AssetStatus
`ACTIVE`, `DECOMMISSIONED`, `MAINTENANCE`, `PLANNED`

### InspectionStatus
`ASSIGNED`, `IN_PROGRESS`, `SUBMITTED`, `APPROVED`, `REJECTED`, `CHANGES_REQUESTED`

### TicketStatus
`NEW`, `TRIAGED`, `ASSIGNED`, `IN_PROGRESS`, `PENDING_REVIEW`, `CLOSED`, `REOPENED`

### Priority
`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`

### Severity
`COSMETIC`, `MINOR`, `MAJOR`, `CRITICAL`, `SAFETY`

### TechnicianStatus
`AVAILABLE`, `ASSIGNED`, `TRAVELING`, `ON_SITE`, `ON_BREAK`, `SICK`, `TRAINING`, `LEAVE`, `UNAVAILABLE`

### EvidenceType
`PHOTO`, `VIDEO`, `PDF`, `DOCUMENT`, `SENSOR_EXPORT`

### EvidenceApprovalStatus
`PENDING`, `APPROVED`, `FLAGGED`

### SyncStatus
`PENDING`, `SYNCING`, `SYNCED`, `FAILED`, `CONFLICT`

### AbsenceReason
`SICK`, `PERSONAL_LEAVE`, `TRAINING`, `VACATION`, `OTHER`

### FieldType (template)
`TEXT`, `NUMERIC`, `PASS_FAIL`, `DROPDOWN`, `PHOTO`, `VIDEO`, `ANNOTATION`, `SIGNATURE`

### AuditAction
`CREATE`, `UPDATE`, `DELETE`, `STATUS_CHANGE`, `ASSIGN`, `APPROVE`, `REJECT`, `SYNC`, `LOGIN`, `LOGOUT`, `EXPORT`

---

## 20. Error Codes

### Authentication
| Code | HTTP | Message | When |
|------|------|---------|------|
| AUTH_001 | 401 | Invalid email or password | Login with wrong credentials |
| AUTH_002 | 401 | Invalid or expired refresh token | Refresh with bad token |
| AUTH_003 | 401 | Access token expired | Request with expired JWT |
| AUTH_004 | 403 | Insufficient role permissions | Access endpoint outside role |

### Assets
| Code | HTTP | Message | When |
|------|------|---------|------|
| ASSET_001 | 409 | Organization name already exists | Duplicate org name |
| ASSET_002 | 409 | Cannot delete: site has child turbines | Delete org with sites |
| ASSET_003 | 409 | Site name already exists in this organization | Duplicate site |
| ASSET_004 | 400 | Invalid turbine ID format (must follow IEC 61400-25 / RDS-PP) | Bad naming |
| ASSET_005 | 409 | Turbine with this ID already exists at this site | Duplicate turbine |
| ASSET_006 | 404 | Asset not found | Invalid asset ID |

### Inspections
| Code | HTTP | Message | When |
|------|------|---------|------|
| INSP_001 | 422 | Required fields missing: [field list] | Submit with empty required fields |
| INSP_002 | 409 | Inspection already submitted | Submit twice |
| INSP_003 | 409 | Status transition not allowed | Invalid status change |

### Evidence
| Code | HTTP | Message | When |
|------|------|---------|------|
| EVID_001 | 400 | Unsupported file type. Allowed: JPEG, PNG, MP4, PDF | Wrong format |
| EVID_002 | 400 | File too large. Max: 50 MB (image), 500 MB (video) | Oversized |
| EVID_003 | 404 | Evidence not found | Invalid evidence ID |

### Tickets
| Code | HTTP | Message | When |
|------|------|---------|------|
| TKT_001 | 422 | Invalid status transition from {from} to {to} | State machine violation |
| TKT_002 | 409 | Ticket status changed by another user. Refresh and retry | Concurrent edit |
| TKT_003 | 422 | Assignee lacks required skills or certifications for this task | Bad assignee |
| TKT_004 | 422 | Only CLOSED tickets can be reopened | Reopen non-closed |

### Sync
| Code | HTTP | Message | When |
|------|------|---------|------|
| SYNC_001 | 409 | Version mismatch on safety-critical data. Manual review required | Safety conflict |
| SYNC_002 | 400 | Invalid sync payload | Bad sync request |

### Dispatch
| Code | HTTP | Message | When |
|------|------|---------|------|
| DISP_001 | 422 | Technician lacks required skills for this assignment | Bad assignment |
| DISP_002 | 422 | Technician is not available | Assign to unavailable |

### General
| Code | HTTP | Message | When |
|------|------|---------|------|
| RATE_001 | 429 | Rate limit exceeded. Retry after {seconds} | Too many requests |
| VAL_001 | 400 | Validation error: {details} | Bad input |
| SRV_001 | 500 | Internal server error | Unexpected failure |

---

## 21. Webhook Events (Future — Phase 4)

The API will emit webhook events for key lifecycle changes. Events defined here for awareness; implementation is post-MVP.

| Event | Trigger | Payload |
|-------|---------|---------|
| `inspection.submitted` | Inspection submitted | `{ inspectionId, assigneeId, assetId }` |
| `inspection.approved` | QA approved | `{ inspectionId, reviewerId }` |
| `ticket.created` | Ticket created | `{ ticketId, priority, assetId }` |
| `ticket.status_changed` | Ticket status transition | `{ ticketId, from, to, userId }` |
| `ticket.sla_breached` | SLA target passed | `{ ticketId, slaTarget, assigneeId }` |
| `technician.absent` | Technician marked absent | `{ technicianId, absenceId, affectedAssignments }` |
| `replacement.suggested` | Replacement suggestions ready | `{ absenceId, candidateCount }` |
| `sync.conflict` | Sync conflict detected | `{ entityType, entityId, conflictFields }` |
