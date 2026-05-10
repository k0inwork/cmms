# MVP Database Schema

## 1. Overview

### Database & ORM

PostgreSQL 15+ is the primary data store. It provides relational integrity for the asset hierarchy, JSONB columns for flexible inspection form data, and full-text search for assets, tickets, and evidence.

Prisma ORM manages the schema as code. It provides type-safe queries, declarative migrations, and a single source of truth for the data model. Developers work with generated TypeScript types that are always in sync with the database.

### Naming Conventions

| Element | Convention | Example |
|---|---|---|
| Table names | snake_case, plural | `organizations`, `inspection_records` |
| Column names | snake_case | `created_at`, `asset_id` |
| Prisma model names | PascalCase, singular | `Organization`, `InspectionRecord` |
| Enum names | PascalCase | `TicketStatus`, `Priority` |
| Enum values | SCREAMING_SNAKE_CASE | `IN_PROGRESS`, `PENDING_REVIEW` |
| Foreign key columns | `{referenced_table_singular}_id` | `site_id`, `turbine_id` |
| Join table models | Concatenated singular names | `UserSkill`, `TicketEvidence` |
| Index names | `idx_{table}_{columns}` | `idx_tickets_status_assignee` |

Prisma's `@@map("table_name")` and `@map("column_name")` annotations map PascalCase models to snake_case database objects.

### Soft Delete Pattern

All core business entities use soft deletes via a `deleted_at` column (nullable timestamp). Queries use a global Prisma middleware or scope to exclude `WHERE deleted_at IS NULL`. Soft-deleted records remain for audit traceability and can be restored.

Hard delete is used only for ephemeral data: sync events past retention period, expired sessions, and temporary upload tokens.

### Audit Trail Approach

Application-level audit via an `AuditEvent` table. Every state mutation on a tracked entity writes a row with:

- `entity_type` and `entity_id` (polymorphic reference)
- `action` (enum: CREATE, UPDATE, DELETE, STATUS_CHANGE, ASSIGN, APPROVE, REJECT, SYNC, LOGIN, LOGOUT)
- `before_state` and `after_state` (JSONB snapshots of changed fields only)
- `user_id` (who performed the action)
- `timestamp`

This approach keeps audit logic in the application layer (accessible, testable) rather than database triggers (opaque, harder to debug). A Prisma `@prisma/client` extension or middleware intercepts writes and emits audit events.

Audit events are append-only. No UPDATE or DELETE is permitted on the `audit_events` table; enforce with database-level trigger or RLS policy.

---

## 2. Enums

```prisma
enum Role {
  TECHNICIAN
  DISPATCHER
  QA_REVIEWER
  OPERATIONS_MANAGER
  ADMINISTRATOR
}

enum AssetStatus {
  ACTIVE
  DECOMMISSIONED
  MAINTENANCE
  PLANNED
}

enum InspectionStatus {
  ASSIGNED
  IN_PROGRESS
  SUBMITTED
  APPROVED
  REJECTED
  CHANGES_REQUESTED
}

enum TicketStatus {
  NEW
  TRIAGED
  ASSIGNED
  IN_PROGRESS
  PENDING_REVIEW
  CLOSED
  REOPENED
}

enum Priority {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

enum Severity {
  COSMETIC
  MINOR
  MAJOR
  CRITICAL
  SAFETY
}

enum TechnicianStatus {
  AVAILABLE
  ASSIGNED
  TRAVELING
  ON_SITE
  ON_BREAK
  SICK
  TRAINING
  LEAVE
  UNAVAILABLE
}

enum EvidenceType {
  PHOTO
  VIDEO
  PDF
  DOCUMENT
  SENSOR_EXPORT
}

enum EvidenceStatus {
  PENDING
  APPROVED
  FLAGGED
}

enum SyncStatus {
  PENDING
  SYNCING
  SYNCED
  FAILED
  CONFLICT
}

enum AbsenceReason {
  SICK
  PERSONAL_LEAVE
  TRAINING
  VACATION
  OTHER
}

enum FieldType {
  TEXT
  NUMERIC
  PASS_FAIL
  DROPDOWN
  PHOTO
  VIDEO
  ANNOTATION
  SIGNATURE
}

enum AuditAction {
  CREATE
  UPDATE
  DELETE
  STATUS_CHANGE
  ASSIGN
  APPROVE
  REJECT
  SYNC
  LOGIN
  LOGOUT
}
```

---

## 3. Complete Prisma Schema

```prisma
// schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─── Enums ────────────────────────────────────────────────────────────────────

enum Role {
  TECHNICIAN
  DISPATCHER
  QA_REVIEWER
  OPERATIONS_MANAGER
  ADMINISTRATOR
}

enum AssetStatus {
  ACTIVE
  DECOMMISSIONED
  MAINTENANCE
  PLANNED
}

enum InspectionStatus {
  ASSIGNED
  IN_PROGRESS
  SUBMITTED
  APPROVED
  REJECTED
  CHANGES_REQUESTED
}

enum TicketStatus {
  NEW
  TRIAGED
  ASSIGNED
  IN_PROGRESS
  PENDING_REVIEW
  CLOSED
  REOPENED
}

enum Priority {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

enum Severity {
  COSMETIC
  MINOR
  MAJOR
  CRITICAL
  SAFETY
}

enum TechnicianStatus {
  AVAILABLE
  ASSIGNED
  TRAVELING
  ON_SITE
  ON_BREAK
  SICK
  TRAINING
  LEAVE
  UNAVAILABLE
}

enum EvidenceType {
  PHOTO
  VIDEO
  PDF
  DOCUMENT
  SENSOR_EXPORT
}

enum EvidenceStatus {
  PENDING
  APPROVED
  FLAGGED
}

enum SyncStatus {
  PENDING
  SYNCING
  SYNCED
  FAILED
  CONFLICT
}

enum AbsenceReason {
  SICK
  PERSONAL_LEAVE
  TRAINING
  VACATION
  OTHER
}

enum FieldType {
  TEXT
  NUMERIC
  PASS_FAIL
  DROPDOWN
  PHOTO
  VIDEO
  ANNOTATION
  SIGNATURE
}

enum AuditAction {
  CREATE
  UPDATE
  DELETE
  STATUS_CHANGE
  ASSIGN
  APPROVE
  REJECT
  SYNC
  LOGIN
  LOGOUT
}

// ─── Asset Hierarchy ──────────────────────────────────────────────────────────

model Organization {
  id          String   @id @default(uuid()) @db.Uuid
  name        String   @unique
  description String?
  created_at  DateTime @default(now()) @map("created_at")
  updated_at  DateTime @updatedAt @map("updated_at")
  deleted_at  DateTime? @map("deleted_at")

  sites Site[]

  @@map("organizations")
}

model Site {
  id              String       @id @default(uuid()) @db.Uuid
  organization_id String       @map("organization_id") @db.Uuid
  name            String
  latitude        Float?
  longitude       Float?
  time_zone       String       @default("UTC")
  created_at      DateTime     @default(now()) @map("created_at")
  updated_at      DateTime     @updatedAt @map("updated_at")
  deleted_at      DateTime?    @map("deleted_at")

  organization Organization @relation(fields: [organization_id], references: [id])
  turbines     Turbine[]

  @@unique([organization_id, name])
  @@map("sites")
}

model Turbine {
  id          String       @id @default(uuid()) @db.Uuid
  site_id     String       @map("site_id") @db.Uuid
  name        String       // IEC 61400-25 / RDS-PP identifier (e.g., "WTG-001")
  status      AssetStatus  @default(ACTIVE)
  model       String?      // Turbine model (e.g., "Vestas V90-2.0MW")
  latitude    Float?
  longitude   Float?
  created_at  DateTime     @default(now()) @map("created_at")
  updated_at  DateTime     @updatedAt @map("updated_at")
  deleted_at  DateTime?    @map("deleted_at")

  site       Site        @relation(fields: [site_id], references: [id])
  subsystems Subsystem[]

  @@unique([site_id, name])
  @@map("turbines")
}

model Subsystem {
  id          String      @id @default(uuid()) @db.Uuid
  turbine_id  String      @map("turbine_id") @db.Uuid
  name        String      // e.g., "Gearbox", "Blade", "Yaw System"
  type        String?     // Classification or category
  created_at  DateTime    @default(now()) @map("created_at")
  updated_at  DateTime    @updatedAt @map("updated_at")
  deleted_at  DateTime?   @map("deleted_at")

  turbine   Turbine     @relation(fields: [turbine_id], references: [id])
  components Component[]

  @@unique([turbine_id, name])
  @@map("subsystems")
}

model Component {
  id          String      @id @default(uuid()) @db.Uuid
  subsystem_id String     @map("subsystem_id") @db.Uuid
  name        String      // e.g., "Bearing", "Trailing Edge"
  status      AssetStatus @default(ACTIVE)
  created_at  DateTime    @default(now()) @map("created_at")
  updated_at  DateTime    @updatedAt @map("updated_at")
  deleted_at  DateTime?   @map("deleted_at")

  subsystem Subsystem @relation(fields: [subsystem_id], references: [id])

  defects           Defect[]
  inspection_records InspectionRecord[]
  tickets           Ticket[]
  work_orders       WorkOrder[]
  evidence_items    EvidenceItem[]

  @@unique([subsystem_id, name])
  @@map("components")
}

// ─── User & Auth ──────────────────────────────────────────────────────────────

model User {
  id            String           @id @default(uuid()) @db.Uuid
  email         String           @unique
  password_hash String           @map("password_hash")
  first_name    String           @map("first_name")
  last_name     String           @map("last_name")
  role          Role
  status        TechnicianStatus @default(AVAILABLE)
  is_active     Boolean          @default(true) @map("is_active")
  organization_id String        @map("organization_id") @db.Uuid
  created_at    DateTime         @default(now()) @map("created_at")
  updated_at    DateTime         @updatedAt @map("updated_at")
  deleted_at    DateTime?        @map("deleted_at")

  organization Organization @relation(fields: [organization_id], references: [id])

  // Relations
  user_skills           UserSkill[]
  user_certifications   UserCertification[]
  inspection_records    InspectionRecord[]
  assigned_tickets      Ticket[]             @relation("TicketAssignee")
  created_tickets       Ticket[]             @relation("TicketCreator")
  assigned_work_orders  WorkOrder[]          @relation("WorkOrderAssignee")
  created_work_orders   WorkOrder[]          @relation("WorkOrderCreator")
  evidence_items        EvidenceItem[]
  availability_slots    AvailabilitySlot[]
  absence_records       AbsenceRecord[]
  assignments           Assignment[]
  audit_events          AuditEvent[]
  sync_events           SyncEvent[]

  @@map("users")
}

model Skill {
  id          String   @id @default(uuid()) @db.Uuid
  name        String   @unique
  category    String?  // e.g., "Electrical", "Mechanical", "Inspection"
  description String?
  created_at  DateTime @default(now()) @map("created_at")
  updated_at  DateTime @updatedAt @map("updated_at")

  user_skills UserSkill[]

  @@map("skills")
}

model Certification {
  id            String   @id @default(uuid()) @db.Uuid
  name          String   @unique
  issuing_body  String?  @map("issuing_body")
  validity_months Int?   @map("validity_months") // null = does not expire
  description   String?
  created_at    DateTime @default(now()) @map("created_at")
  updated_at    DateTime @updatedAt @map("updated_at")

  user_certifications UserCertification[]

  @@map("certifications")
}

model UserSkill {
  id               String   @id @default(uuid()) @db.Uuid
  user_id          String   @map("user_id") @db.Uuid
  skill_id         String   @map("skill_id") @db.Uuid
  proficiency_level Int     // 1-5 scale
  acquired_date    DateTime @map("acquired_date")
  created_at       DateTime @default(now()) @map("created_at")
  updated_at       DateTime @updatedAt @map("updated_at")

  user User  @relation(fields: [user_id], references: [id])
  skill Skill @relation(fields: [skill_id], references: [id])

  @@unique([user_id, skill_id])
  @@map("user_skills")
}

model UserCertification {
  id              String    @id @default(uuid()) @db.Uuid
  user_id         String    @map("user_id") @db.Uuid
  certification_id String   @map("certification_id") @db.Uuid
  issued_date     DateTime  @map("issued_date")
  expiry_date     DateTime? @map("expiry_date") // null = does not expire
  certificate_url String?   @map("certificate_url")
  created_at      DateTime  @default(now()) @map("created_at")
  updated_at      DateTime  @updatedAt @map("updated_at")

  user          User          @relation(fields: [user_id], references: [id])
  certification Certification @relation(fields: [certification_id], references: [id])

  @@unique([user_id, certification_id])
  @@map("user_certifications")
}

// ─── Inspection Templates & Records ──────────────────────────────────────────

model InspectionTemplate {
  id              String   @id @default(uuid()) @db.Uuid
  name            String
  description     String?
  inspection_type String?  @map("inspection_type") // e.g., "Visual", "Thermographic"
  turbine_model   String?  @map("turbine_model")   // Scope: specific turbine model
  site_id         String?  @map("site_id") @db.Uuid // Scope: specific site
  is_active       Boolean  @default(true) @map("is_active")
  created_at      DateTime @default(now()) @map("created_at")
  updated_at      DateTime @updatedAt @map("updated_at")
  deleted_at      DateTime? @map("deleted_at")

  versions          InspectionTemplateVersion[]
  inspection_records InspectionRecord[]

  @@map("inspection_templates")
}

model InspectionTemplateVersion {
  id          String   @id @default(uuid()) @db.Uuid
  template_id String   @map("template_id") @db.Uuid
  version     Int      // Auto-incremented per template
  schema      Json     // JSON schema defining fields, types, validation rules
  changelog   String?  // What changed in this version
  created_at  DateTime @default(now()) @map("created_at")
  created_by  String   @map("created_by") @db.Uuid

  template InspectionTemplate @relation(fields: [template_id], references: [id])
  creator  User               @relation(fields: [created_by], references: [id])

  @@unique([template_id, version])
  @@map("inspection_template_versions")
}

model InspectionRecord {
  id                    String            @id @default(uuid()) @db.Uuid
  template_version_id   String            @map("template_version_id") @db.Uuid
  technician_id         String            @map("technician_id") @db.Uuid
  turbine_id            String            @map("turbine_id") @db.Uuid
  component_id          String?           @map("component_id") @db.Uuid // Optional: inspection may target whole turbine
  status                InspectionStatus  @default(ASSIGNED)
  started_at            DateTime?         @map("started_at")
  completed_at          DateTime?         @map("completed_at")
  submitted_at          DateTime?         @map("submitted_at")
  reviewed_at           DateTime?         @map("reviewed_at")
  reviewed_by           String?           @map("reviewed_by") @db.Uuid
  review_notes          String?           @map("review_notes")
  due_date              DateTime?         @map("due_date")
  sync_status           SyncStatus        @default(SYNCED)
  client_id             String?           @unique @map("client_id") // Client-generated UUID for idempotent sync
  created_at            DateTime          @default(now()) @map("created_at")
  updated_at            DateTime          @updatedAt @map("updated_at")
  deleted_at            DateTime?         @map("deleted_at")

  template_version InspectionTemplateVersion @relation(fields: [template_version_id], references: [id])
  technician       User                      @relation(fields: [technician_id], references: [id])
  turbine          Turbine                   @relation(fields: [turbine_id], references: [id]) // via implicit relation
  reviewer         User?                     @relation(fields: [reviewed_by], references: [id])

  field_data  InspectionFieldData[]
  defects     Defect[]
  evidence    EvidenceItem[]

  @@index([technician_id])
  @@index([turbine_id])
  @@index([status])
  @@index([sync_status])
  @@index([due_date])
  @@index([component_id])
  @@map("inspection_records")
}

model InspectionFieldData {
  id                 String   @id @default(uuid()) @db.Uuid
  inspection_id      String   @map("inspection_id") @db.Uuid
  field_key          String   @map("field_key")  // Matches key in template schema
  field_type         FieldType @map("field_type")
  value_string       String?  @map("value_string")
  value_numeric      Float?   @map("value_numeric")
  value_boolean      Boolean? @map("value_boolean")
  value_json         Json?    @map("value_json") // For complex data (dropdowns, annotations, signatures)
  created_at         DateTime @default(now()) @map("created_at")
  updated_at         DateTime @updatedAt @map("updated_at")

  inspection InspectionRecord @relation(fields: [inspection_id], references: [id], onDelete: Cascade)

  @@unique([inspection_id, field_key])
  @@map("inspection_field_data")
}

// ─── Defects & Tickets ───────────────────────────────────────────────────────

model Defect {
  id               String   @id @default(uuid()) @db.Uuid
  inspection_id    String   @map("inspection_id") @db.Uuid
  component_id     String   @map("component_id") @db.Uuid
  description      String
  severity         Severity
  location_detail  String?  @map("location_detail") // Free-text location within component
  notes            String?
  created_at       DateTime @default(now()) @map("created_at")
  updated_at       DateTime @updatedAt @map("updated_at")
  deleted_at       DateTime? @map("deleted_at")

  inspection InspectionRecord @relation(fields: [inspection_id], references: [id])
  component  Component        @relation(fields: [component_id], references: [id])

  tickets Ticket[]

  @@index([component_id])
  @@index([severity])
  @@map("defects")
}

model Ticket {
  id              String       @id @default(uuid()) @db.Uuid
  defect_id       String?      @map("defect_id") @db.Uuid // Optional: ticket may originate from a defect
  turbine_id      String?      @map("turbine_id") @db.Uuid
  component_id    String?      @map("component_id") @db.Uuid
  title           String
  description     String
  priority        Priority     @default(MEDIUM)
  severity        Severity?    // Copied from defect or set manually
  status          TicketStatus @default(NEW)
  assignee_id     String?      @map("assignee_id") @db.Uuid
  created_by      String       @map("created_by") @db.Uuid
  due_date        DateTime?    @map("due_date")
  sla_target_date DateTime?    @map("sla_target_date")
  resolution_notes String?     @map("resolution_notes") @db.Text
  root_cause      String?      @map("root_cause")
  closed_at       DateTime?    @map("closed_at")
  sync_status     SyncStatus   @default(SYNCED)
  client_id       String?      @unique @map("client_id")
  created_at      DateTime     @default(now()) @map("created_at")
  updated_at      DateTime     @updatedAt @map("updated_at")
  deleted_at      DateTime?    @map("deleted_at")

  defect     Defect?   @relation(fields: [defect_id], references: [id])
  turbine    Turbine?  @relation(fields: [turbine_id], references: [id]) // via implicit relation
  component  Component? @relation(fields: [component_id], references: [id])
  assignee   User?     @relation("TicketAssignee", fields: [assignee_id], references: [id])
  creator    User      @relation("TicketCreator", fields: [created_by], references: [id])

  work_orders     WorkOrder[]
  ticket_evidence TicketEvidence[]

  @@index([status])
  @@index([assignee_id])
  @@index([priority])
  @@index([due_date])
  @@index([defect_id])
  @@index([created_by])
  @@map("tickets")
}

model WorkOrder {
  id            String       @id @default(uuid()) @db.Uuid
  ticket_id     String       @map("ticket_id") @db.Uuid
  turbine_id    String?      @map("turbine_id") @db.Uuid
  component_id  String?      @map("component_id") @db.Uuid
  assignee_id   String?      @map("assignee_id") @db.Uuid
  created_by    String       @map("created_by") @db.Uuid
  title         String
  description   String
  priority      Priority     @default(MEDIUM)
  status        TicketStatus @default(NEW) // Reuses TicketStatus lifecycle
  due_date      DateTime?    @map("due_date")
  started_at    DateTime?    @map("started_at")
  completed_at  DateTime?    @map("completed_at")
  resolution_notes String?   @map("resolution_notes") @db.Text
  sync_status   SyncStatus   @default(SYNCED)
  client_id     String?      @unique @map("client_id")
  created_at    DateTime     @default(now()) @map("created_at")
  updated_at    DateTime     @updatedAt @map("updated_at")
  deleted_at    DateTime?    @map("deleted_at")

  ticket    Ticket  @relation(fields: [ticket_id], references: [id])
  turbine   Turbine? @relation(fields: [turbine_id], references: [id]) // via implicit relation
  component Component? @relation(fields: [component_id], references: [id])
  assignee  User?   @relation("WorkOrderAssignee", fields: [assignee_id], references: [id])
  creator   User    @relation("WorkOrderCreator", fields: [created_by], references: [id])

  work_order_evidence WorkOrderEvidence[]

  @@index([ticket_id])
  @@index([assignee_id])
  @@index([status])
  @@index([due_date])
  @@map("work_orders")
}

// ─── Evidence ─────────────────────────────────────────────────────────────────

model EvidenceItem {
  id             String        @id @default(uuid()) @db.Uuid
  media_type     EvidenceType  @map("media_type")
  status         EvidenceStatus @default(PENDING)
  file_url       String        @map("file_url") // S3 key or URL
  thumbnail_url  String?       @map("thumbnail_url")
  file_size_bytes Int          @map("file_size_bytes")
  mime_type      String        @map("mime_type")
  version        Int           @default(1)
  uploaded_by    String        @map("uploaded_by") @db.Uuid
  asset_id       String?       @map("asset_id") @db.Uuid // Generic asset reference (turbine)
  inspection_id  String?       @map("inspection_id") @db.Uuid
  component_id   String?       @map("component_id") @db.Uuid
  description    String?
  metadata       Json?         // EXIF, duration, dimensions, device info
  sync_status    SyncStatus    @default(SYNCED)
  client_id      String?       @unique @map("client_id")
  created_at     DateTime      @default(now()) @map("created_at")
  updated_at     DateTime      @updatedAt @map("updated_at")
  deleted_at     DateTime?     @map("deleted_at")

  uploader   User             @relation(fields: [uploaded_by], references: [id])
  component  Component?       @relation(fields: [component_id], references: [id])
  inspection InspectionRecord? @relation(fields: [inspection_id], references: [id])

  annotations      EvidenceAnnotation[]
  ticket_evidence  TicketEvidence[]
  work_order_evidence WorkOrderEvidence[]

  @@index([uploaded_by])
  @@index([media_type])
  @@index([status])
  @@index([inspection_id])
  @@index([component_id])
  @@index([created_at])
  @@map("evidence_items")
}

model EvidenceAnnotation {
  id           String   @id @default(uuid()) @db.Uuid
  evidence_id  String   @map("evidence_id") @db.Uuid
  author_id    String   @map("author_id") @db.Uuid
  annotation_type String @map("annotation_type") // "arrow", "circle", "text_label", "freehand"
  data         Json     // Overlay coordinates, dimensions, text content
  version      Int      @default(1)
  created_at   DateTime @default(now()) @map("created_at")
  updated_at   DateTime @updatedAt @map("updated_at")

  evidence EvidenceItem @relation(fields: [evidence_id], references: [id], onDelete: Cascade)
  author   User         @relation(fields: [author_id], references: [id])

  @@index([evidence_id])
  @@map("evidence_annotations")
}

model TicketEvidence {
  id         String   @id @default(uuid()) @db.Uuid
  ticket_id  String   @map("ticket_id") @db.Uuid
  evidence_id String  @map("evidence_id") @db.Uuid
  linked_by  String   @map("linked_by") @db.Uuid
  linked_at  DateTime @default(now()) @map("linked_at")

  ticket   Ticket       @relation(fields: [ticket_id], references: [id], onDelete: Cascade)
  evidence EvidenceItem @relation(fields: [evidence_id], references: [id])

  @@unique([ticket_id, evidence_id])
  @@index([ticket_id])
  @@index([evidence_id])
  @@map("ticket_evidence")
}

model WorkOrderEvidence {
  id           String   @id @default(uuid()) @db.Uuid
  work_order_id String  @map("work_order_id") @db.Uuid
  evidence_id  String   @map("evidence_id") @db.Uuid
  linked_by    String   @map("linked_by") @db.Uuid
  linked_at    DateTime @default(now()) @map("linked_at")

  work_order WorkOrder    @relation(fields: [work_order_id], references: [id], onDelete: Cascade)
  evidence   EvidenceItem @relation(fields: [evidence_id], references: [id])

  @@unique([work_order_id, evidence_id])
  @@index([work_order_id])
  @@index([evidence_id])
  @@map("work_order_evidence")
}

// ─── Availability & Dispatch ──────────────────────────────────────────────────

model AvailabilitySlot {
  id          String           @id @default(uuid()) @db.Uuid
  user_id     String           @map("user_id") @db.Uuid
  status      TechnicianStatus @default(AVAILABLE)
  start_time  DateTime         @map("start_time")
  end_time    DateTime         @map("end_time")
  site_id     String?          @map("site_id") @db.Uuid // Planned site location
  notes       String?
  created_at  DateTime         @default(now()) @map("created_at")
  updated_at  DateTime         @updatedAt @map("updated_at")

  user User @relation(fields: [user_id], references: [id])

  @@index([user_id])
  @@index([start_time, end_time])
  @@index([status])
  @@map("availability_slots")
}

model AbsenceRecord {
  id                String        @id @default(uuid()) @db.Uuid
  user_id           String        @map("user_id") @db.Uuid
  reason            AbsenceReason
  start_date        DateTime      @map("start_date")
  expected_return_date DateTime?  @map("expected_return_date")
  actual_return_date DateTime?    @map("actual_return_date")
  is_approved       Boolean       @default(false) @map("is_approved")
  approved_by       String?       @map("approved_by") @db.Uuid
  notes             String?
  created_at        DateTime      @default(now()) @map("created_at")
  updated_at        DateTime      @updatedAt @map("updated_at")

  user     User  @relation(fields: [user_id], references: [id])
  approver User? @relation(fields: [approved_by], references: [id])

  replacement_suggestions ReplacementSuggestion[]

  @@index([user_id])
  @@index([start_date])
  @@index([is_approved])
  @@map("absence_records")
}

model Assignment {
  id              String           @id @default(uuid()) @db.Uuid
  user_id         String           @map("user_id") @db.Uuid
  inspection_id   String?          @map("inspection_id") @db.Uuid
  work_order_id   String?          @map("work_order_id") @db.Uuid
  status          TechnicianStatus @default(ASSIGNED)
  assigned_by     String           @map("assigned_by") @db.Uuid
  assigned_at     DateTime         @default(now()) @map("assigned_at")
  accepted_at     DateTime?        @map("accepted_at")
  declined_at     DateTime?        @map("declined_at")
  decline_reason  String?          @map("decline_reason")
  created_at      DateTime         @default(now()) @map("created_at")
  updated_at      DateTime         @updatedAt @map("updated_at")

  user        User         @relation(fields: [user_id], references: [id])
  inspection  InspectionRecord? @relation(fields: [inspection_id], references: [id])
  work_order  WorkOrder?   @relation(fields: [work_order_id], references: [id])
  assigner    User         @relation(fields: [assigned_by], references: [id])

  @@index([user_id])
  @@index([inspection_id])
  @@index([work_order_id])
  @@index([status])
  @@map("assignments")
}

model ReplacementSuggestion {
  id               String  @id @default(uuid()) @db.Uuid
  absence_record_id String  @map("absence_record_id") @db.Uuid
  suggested_user_id String  @map("suggested_user_id") @db.Uuid
  skill_match_score Float   @map("skill_match_score")     // 0-1, weight 30%
  cert_match_score  Float   @map("cert_match_score")      // 0-1, weight 25%
  proximity_score   Float   @map("proximity_score")       // 0-1, weight 20%
  workload_score    Float   @map("workload_score")         // 0-1, weight 15%
  familiarity_score Float   @map("familiarity_score")     // 0-1, weight 10%
  total_score       Float   @map("total_score")           // Weighted total 0-1
  is_above_threshold Boolean @default(false) @map("is_above_threshold") // >= 0.60
  created_at        DateTime @default(now()) @map("created_at")

  absence_record AbsenceRecord @relation(fields: [absence_record_id], references: [id])
  suggested_user User          @relation(fields: [suggested_user_id], references: [id])

  @@index([absence_record_id])
  @@index([total_score(sort: Desc)])
  @@index([suggested_user_id])
  @@map("replacement_suggestions")
}

// ─── Audit & Sync ─────────────────────────────────────────────────────────────

model AuditEvent {
  id           String      @id @default(uuid()) @db.Uuid
  entity_type  String      @map("entity_type")   // "Ticket", "InspectionRecord", "EvidenceItem", etc.
  entity_id    String      @map("entity_id") @db.Uuid
  action       AuditAction
  user_id      String?     @map("user_id") @db.Uuid // null for system actions
  before_state Json?       @map("before_state") // JSONB: changed fields before
  after_state  Json?       @map("after_state")  // JSONB: changed fields after
  metadata     Json?       // Additional context (IP, user agent, etc.)
  created_at   DateTime    @default(now()) @map("created_at")

  user User? @relation(fields: [user_id], references: [id])

  @@index([entity_type, entity_id])
  @@index([action])
  @@index([user_id])
  @@index([created_at])
  @@map("audit_events")
}

model SyncEvent {
  id            String     @id @default(uuid()) @db.Uuid
  user_id       String     @map("user_id") @db.Uuid
  entity_type   String     @map("entity_type")
  entity_id     String     @map("entity_id") @db.Uuid
  sync_status   SyncStatus
  conflict_data Json?      @map("conflict_data") // JSONB: conflict details for QA resolution
  error_message String?    @map("error_message")
  retry_count   Int        @default(0) @map("retry_count")
  synced_at     DateTime?  @map("synced_at")
  created_at    DateTime   @default(now()) @map("created_at")

  user User @relation(fields: [user_id], references: [id])

  @@index([user_id])
  @@index([entity_type, entity_id])
  @@index([sync_status])
  @@index([created_at])
  @@map("sync_events")
}
```

### Implicit relations (add to models above)

The following reverse relation fields should be added to models that are referenced but don't yet have the corresponding `@relation` annotation. In the full schema above these are included via the `[].` array fields. For clarity:

```prisma
// On Turbine model, add:
inspection_records InspectionRecord[]
tickets           Ticket[]
work_orders       WorkOrder[]

// On Site model, add:
// (already has turbines Turbine[])

// On User model, add:
reviewed_inspections  InspectionRecord[]  @relation("InspectionReviewer")
template_versions     InspectionTemplateVersion[]
approved_absences     AbsenceRecord[]     @relation("AbsenceApprover")
assignments_as_assigner Assignment[]       @relation("AssignmentAssigner")
```

---

## 4. Indexes

Below is a consolidated summary of all indexes. Primary key indexes are created automatically by Prisma (`@id`). The `@@unique` constraints also create unique indexes.

### organizations
| Index | Type | Purpose |
|---|---|---|
| `id` | Primary key | Lookup by ID |
| `name` | Unique | Prevent duplicate org names |

### sites
| Index | Type | Purpose |
|---|---|---|
| `id` | Primary key | Lookup by ID |
| `organization_id` | Non-unique (FK) | Join to organizations |
| `(organization_id, name)` | Unique | Prevent duplicate site names within org |

### turbines
| Index | Type | Purpose |
|---|---|---|
| `id` | Primary key | Lookup by ID |
| `site_id` | Non-unique (FK) | Join to sites |
| `(site_id, name)` | Unique | Prevent duplicate turbine names within site |
| `status` | Non-unique | Filter by status |

### subsystems
| Index | Type | Purpose |
|---|---|---|
| `id` | Primary key | Lookup by ID |
| `turbine_id` | Non-unique (FK) | Join to turbines |
| `(turbine_id, name)` | Unique | Prevent duplicate subsystem names within turbine |

### components
| Index | Type | Purpose |
|---|---|---|
| `id` | Primary key | Lookup by ID |
| `subsystem_id` | Non-unique (FK) | Join to subsystems |
| `(subsystem_id, name)` | Unique | Prevent duplicate component names within subsystem |
| `status` | Non-unique | Filter by status |

### users
| Index | Type | Purpose |
|---|---|---|
| `id` | Primary key | Lookup by ID |
| `email` | Unique | Login lookup |
| `organization_id` | Non-unique (FK) | Join to organizations |
| `role` | Non-unique | Filter by role |
| `status` | Non-unique | Filter by availability |
| `is_active` | Non-unique | Exclude deactivated users |

### user_skills
| Index | Type | Purpose |
|---|---|---|
| `id` | Primary key | Lookup by ID |
| `(user_id, skill_id)` | Unique | Prevent duplicate skill assignments |
| `skill_id` | Non-unique (FK) | Join to skills |

### user_certifications
| Index | Type | Purpose |
|---|---|---|
| `id` | Primary key | Lookup by ID |
| `(user_id, certification_id)` | Unique | Prevent duplicate cert assignments |
| `certification_id` | Non-unique (FK) | Join to certifications |
| `expiry_date` | Non-unique | Find expiring certs |

### inspection_templates
| Index | Type | Purpose |
|---|---|---|
| `id` | Primary key | Lookup by ID |
| `is_active` | Non-unique | Filter active templates |

### inspection_template_versions
| Index | Type | Purpose |
|---|---|---|
| `id` | Primary key | Lookup by ID |
| `template_id` | Non-unique (FK) | Join to templates |
| `(template_id, version)` | Unique | Version uniqueness per template |

### inspection_records
| Index | Type | Purpose |
|---|---|---|
| `id` | Primary key | Lookup by ID |
| `client_id` | Unique | Idempotent sync deduplication |
| `technician_id` | Non-unique | List inspections by technician |
| `turbine_id` | Non-unique | List inspections by turbine |
| `component_id` | Non-unique | List inspections by component |
| `status` | Non-unique | Filter by status (dispatch board) |
| `sync_status` | Non-unique | Monitor sync health |
| `due_date` | Non-unique | Sort/filter by due date |

### inspection_field_data
| Index | Type | Purpose |
|---|---|---|
| `id` | Primary key | Lookup by ID |
| `(inspection_id, field_key)` | Unique | One value per field per inspection |
| `inspection_id` | Non-unique (FK, cascade) | Join to inspection records |

### defects
| Index | Type | Purpose |
|---|---|---|
| `id` | Primary key | Lookup by ID |
| `inspection_id` | Non-unique (FK) | Join to inspection |
| `component_id` | Non-unique (FK) | List defects by component |
| `severity` | Non-unique | Filter by severity |

### tickets
| Index | Type | Purpose |
|---|---|---|
| `id` | Primary key | Lookup by ID |
| `client_id` | Unique | Idempotent sync deduplication |
| `defect_id` | Non-unique (FK) | Trace to originating defect |
| `assignee_id` | Non-unique (FK) | List tickets by assignee |
| `created_by` | Non-unique (FK) | List tickets by creator |
| `status` | Non-unique | Filter by status (dispatch board) |
| `priority` | Non-unique | Sort by priority |
| `due_date` | Non-unique | SLA tracking, aging reports |

### work_orders
| Index | Type | Purpose |
|---|---|---|
| `id` | Primary key | Lookup by ID |
| `client_id` | Unique | Idempotent sync deduplication |
| `ticket_id` | Non-unique (FK) | Join to parent ticket |
| `assignee_id` | Non-unique (FK) | List by assignee |
| `status` | Non-unique | Filter by status |
| `due_date` | Non-unique | Sort by due date |

### evidence_items
| Index | Type | Purpose |
|---|---|---|
| `id` | Primary key | Lookup by ID |
| `client_id` | Unique | Idempotent sync deduplication |
| `uploaded_by` | Non-unique (FK) | List evidence by author |
| `media_type` | Non-unique | Filter by type |
| `status` | Non-unique | Filter by approval status |
| `inspection_id` | Non-unique (FK) | Join to inspection |
| `component_id` | Non-unique (FK) | Filter by component |
| `created_at` | Non-unique | Date range search |

### evidence_annotations
| Index | Type | Purpose |
|---|---|---|
| `id` | Primary key | Lookup by ID |
| `evidence_id` | Non-unique (FK, cascade) | Join to evidence item |

### ticket_evidence
| Index | Type | Purpose |
|---|---|---|
| `id` | Primary key | Lookup by ID |
| `(ticket_id, evidence_id)` | Unique | Prevent duplicate links |
| `ticket_id` | Non-unique | List evidence for ticket |
| `evidence_id` | Non-unique | List tickets for evidence |

### work_order_evidence
| Index | Type | Purpose |
|---|---|---|
| `id` | Primary key | Lookup by ID |
| `(work_order_id, evidence_id)` | Unique | Prevent duplicate links |
| `work_order_id` | Non-unique | List evidence for work order |
| `evidence_id` | Non-unique | List work orders for evidence |

### availability_slots
| Index | Type | Purpose |
|---|---|---|
| `id` | Primary key | Lookup by ID |
| `user_id` | Non-unique (FK) | List slots by user |
| `(start_time, end_time)` | Non-unique | Time range queries for coverage |
| `status` | Non-unique | Filter by status |

### absence_records
| Index | Type | Purpose |
|---|---|---|
| `id` | Primary key | Lookup by ID |
| `user_id` | Non-unique (FK) | List absences by user |
| `start_date` | Non-unique | Date range queries |
| `is_approved` | Non-unique | Filter pending approvals |

### assignments
| Index | Type | Purpose |
|---|---|---|
| `id` | Primary key | Lookup by ID |
| `user_id` | Non-unique (FK) | List assignments by user |
| `inspection_id` | Non-unique | Find assignment for inspection |
| `work_order_id` | Non-unique | Find assignment for work order |
| `status` | Non-unique | Filter by status |

### replacement_suggestions
| Index | Type | Purpose |
|---|---|---|
| `id` | Primary key | Lookup by ID |
| `absence_record_id` | Non-unique (FK) | List suggestions for absence |
| `suggested_user_id` | Non-unique (FK) | Find suggestions mentioning user |
| `total_score DESC` | Non-unique | Rank candidates |

### audit_events
| Index | Type | Purpose |
|---|---|---|
| `id` | Primary key | Lookup by ID |
| `(entity_type, entity_id)` | Non-unique | Audit trail for any record |
| `action` | Non-unique | Filter by action type |
| `user_id` | Non-unique (FK) | Filter by user |
| `created_at` | Non-unique | Date range queries |

### sync_events
| Index | Type | Purpose |
|---|---|---|
| `id` | Primary key | Lookup by ID |
| `user_id` | Non-unique (FK) | List sync events by user |
| `(entity_type, entity_id)` | Non-unique | Sync status for any record |
| `sync_status` | Non-unique | Find failed/conflicted syncs |
| `created_at` | Non-unique | Date range queries |

### Full-text search

Add PostgreSQL full-text indexes via a migration for these columns:

```sql
-- Tickets: search by title and description
CREATE INDEX idx_tickets_fts ON tickets
  USING gin(to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, '')));

-- Evidence: search by description
CREATE INDEX idx_evidence_items_fts ON evidence_items
  USING gin(to_tsvector('english', coalesce(description, '')));

-- Components: search by name
CREATE INDEX idx_components_fts ON components
  USING gin(to_tsvector('english', coalesce(name, '')));

-- Turbines: search by name
CREATE INDEX idx_turbines_fts ON turbines
  USING gin(to_tsvector('english', coalesce(name, '')));
```

---

## 5. Migration Order

Migrations must respect foreign key dependencies. Tables are created in dependency order so that referenced tables exist before referencing tables.

### Migration 01: Foundation

Tables with no foreign keys or self-contained FKs:

| Table | Depends On |
|---|---|
| `organizations` | — |
| `skills` | — |
| `certifications` | — |

### Migration 02: Asset Hierarchy

| Table | Depends On |
|---|---|
| `sites` | `organizations` |
| `turbines` | `sites` |
| `subsystems` | `turbines` |
| `components` | `subsystems` |

### Migration 03: Users

| Table | Depends On |
|---|---|
| `users` | `organizations` |
| `user_skills` | `users`, `skills` |
| `user_certifications` | `users`, `certifications` |

### Migration 04: Inspection Templates

| Table | Depends On |
|---|---|
| `inspection_templates` | — |
| `inspection_template_versions` | `inspection_templates`, `users` |

### Migration 05: Inspections & Field Data

| Table | Depends On |
|---|---|
| `inspection_records` | `inspection_template_versions`, `users`, `turbines`, `components` |
| `inspection_field_data` | `inspection_records` |

### Migration 06: Defects & Tickets

| Table | Depends On |
|---|---|
| `defects` | `inspection_records`, `components` |
| `tickets` | `defects`, `turbines`, `components`, `users` (assignee, creator) |
| `work_orders` | `tickets`, `turbines`, `components`, `users` (assignee, creator) |

### Migration 07: Evidence

| Table | Depends On |
|---|---|
| `evidence_items` | `users`, `components`, `inspection_records` |
| `evidence_annotations` | `evidence_items`, `users` |
| `ticket_evidence` | `tickets`, `evidence_items`, `users` |
| `work_order_evidence` | `work_orders`, `evidence_items`, `users` |

### Migration 08: Availability & Dispatch

| Table | Depends On |
|---|---|
| `availability_slots` | `users`, `sites` |
| `absence_records` | `users` |
| `assignments` | `users`, `inspection_records`, `work_orders` |
| `replacement_suggestions` | `absence_records`, `users` |

### Migration 09: Audit & Sync

| Table | Depends On |
|---|---|
| `audit_events` | `users` |
| `sync_events` | `users` |

### Migration 10: Full-text Indexes

Add PostgreSQL GIN indexes for full-text search (raw SQL migration, not managed by Prisma schema).

---

## 6. Seed Data Guidance

### Organizations & Sites

```json
{
  "organizations": [
    { "name": "AeroWind Services GmbH" }
  ],
  "sites": [
    { "name": "North Sea Wind Farm Alpha", "organization": "AeroWind Services GmbH", "latitude": 53.5, "longitude": 7.0 },
    { "name": "Baltic Coast Wind Farm Beta", "organization": "AeroWind Services GmbH", "latitude": 54.3, "longitude": 10.1 }
  ]
}
```

### Turbines (5 per site, 10 total)

Each turbine uses IEC 61400-25 / RDS-PP naming: `WTG-{site_prefix}-{nn}`

```
North Sea:  WTG-NSA-01 through WTG-NSA-05  (model: "Vestas V90-2.0MW")
Baltic Coast: WTG-BCB-01 through WTG-BCB-05  (model: "Siemens SG 2.1-114")
```

### Subsystems (per turbine)

Each turbine gets 5 subsystems:
- Gearbox
- Blade (x3, named "Blade A", "Blade B", "Blade C")
- Yaw System
- Generator
- Nacelle

### Components (per subsystem, examples)

| Subsystem | Components |
|---|---|
| Gearbox | Main Bearing, Planetary Gear Stage 1, Planetary Gear Stage 2, High-Speed Shaft, Oil Filter |
| Blade A/B/C | Leading Edge, Trailing Edge, Root Joint, Tip, Lightning Receptor |
| Yaw System | Yaw Bearing, Yaw Motor, Yaw Brake, Yaw Encoder |
| Generator | Stator, Rotor, Slip Rings, Cooling Fan, Main Shaft Coupling |
| Nacelle | Main Frame, Crane Rail, Weather Station, Lightning Protection, Fire Suppression |

### Users (one per role)

| Name | Email | Role |
|---|---|---|
| Jan Technician | jan.tech@aerowind.dev | TECHNICIAN |
| Anna Dispatcher | anna.dispatch@aerowind.dev | DISPATCHER |
| Max QA | max.qa@aerowind.dev | QA_REVIEWER |
| Sarah Ops | sarah.ops@aerowind.dev | OPERATIONS_MANAGER |
| Admin User | admin@aerowind.dev | ADMINISTRATOR |

All passwords: use a known test hash (e.g., bcrypt of `password123`).

### Skills

| Skill | Category |
|---|---|
| Blade Inspection | Inspection |
| Gearbox Maintenance | Mechanical |
| Electrical Testing | Electrical |
| Rope Access | Safety |
| Thermographic Analysis | Inspection |
| Vibration Analysis | Condition Monitoring |

### Certifications

| Certification | Issuing Body | Validity |
|---|---|---|
| GWO Basic Safety Training | Global Wind Organisation | 24 months |
| GWO Advanced Rescue Training | Global Wind Organisation | 24 months |
| IRATA Level 1 | IRATA | 36 months |
| Thermography Level 1 | ASNT | 60 months |
| Electrical Safety Authorized Person | Internal | 12 months |

Assign skills and certifications to Jan Technician (TECHNICIAN role) with varying proficiency and dates. Include one expired certification to test expiry flagging.

### Inspection Templates

1. **Visual Blade Inspection** — fields: blade position (dropdown), leading edge condition (pass_fail), trailing edge condition (pass_fail), surface damage (text), damage length mm (numeric), photo evidence (photo)
2. **Gearbox Oil Analysis** — fields: oil sample date (text), viscosity (numeric), particle count (numeric), metal content ppm (numeric), filter condition (pass_fail), sample photo (photo)
3. **General Turbine Walkdown** — fields: nacelle condition (dropdown), tower condition (dropdown), foundation visual (pass_fail), safety equipment check (pass_fail), anomalies (text), overall photo (photo), video walkthrough (video)

Each template should have at least 2 versions to test versioning.

### Sample Data Totals

| Entity | Count |
|---|---|
| Organizations | 1 |
| Sites | 2 |
| Turbines | 10 |
| Subsystems | 50 |
| Components | ~100-150 |
| Users | 5 |
| Skills | 6 |
| Certifications | 5 |
| UserSkill entries | 10-15 |
| UserCertification entries | 8-10 |
| Inspection Templates | 3 (with 2 versions each) |

---

## 7. Data Integrity Rules

### Unique Constraints

| Table | Constraint | Rationale |
|---|---|---|
| `organizations` | `name` UNIQUE | No duplicate org names (US-ASSET-01) |
| `sites` | `(organization_id, name)` UNIQUE | No duplicate site names within org (US-ASSET-02) |
| `turbines` | `(site_id, name)` UNIQUE | No duplicate turbine IDs at same site, IEC 61400-25 compliance (US-ASSET-03, US-ASSET-08) |
| `subsystems` | `(turbine_id, name)` UNIQUE | No duplicate subsystem names within turbine (US-ASSET-04) |
| `components` | `(subsystem_id, name)` UNIQUE | No duplicate component names within subsystem (US-ASSET-05, US-ASSET-08) |
| `users` | `email` UNIQUE | Login uniqueness |
| `skills` | `name` UNIQUE | No duplicate skills |
| `certifications` | `name` UNIQUE | No duplicate certifications |
| `user_skills` | `(user_id, skill_id)` UNIQUE | One proficiency record per user-skill pair |
| `user_certifications` | `(user_id, certification_id)` UNIQUE | One cert record per user-certification pair |
| `inspection_field_data` | `(inspection_id, field_key)` UNIQUE | One value per field per inspection |
| `inspection_template_versions` | `(template_id, version)` UNIQUE | Version uniqueness per template |
| `inspection_records` | `client_id` UNIQUE | Idempotent sync (US-OFF-05) |
| `tickets` | `client_id` UNIQUE | Idempotent sync |
| `work_orders` | `client_id` UNIQUE | Idempotent sync |
| `evidence_items` | `client_id` UNIQUE | Idempotent sync |
| `ticket_evidence` | `(ticket_id, evidence_id)` UNIQUE | No duplicate evidence links |
| `work_order_evidence` | `(work_order_id, evidence_id)` UNIQUE | No duplicate evidence links |

### Cascading Deletes vs Soft Deletes

| Model | Delete Strategy | Rationale |
|---|---|---|
| `Organization` | Soft delete (`deleted_at`) | Preserve all historical data |
| `Site` | Soft delete | Preserve asset hierarchy history |
| `Turbine` | Soft delete | Preserve inspection history |
| `Subsystem` | Soft delete | Preserve component history |
| `Component` | Soft delete | Preserve defect/ticket traceability |
| `User` | Soft delete + `is_active = false` | Preserve audit trail, reassign history |
| `Skill` | Soft delete | Preserve user-skill records |
| `Certification` | Soft delete | Preserve user-certification records |
| `InspectionTemplate` | Soft delete | Preserve template versions |
| `InspectionTemplateVersion` | Hard delete (cascade from template) | Versions are owned by template |
| `InspectionRecord` | Soft delete | Preserve field data, defects, evidence |
| `InspectionFieldData` | Hard delete (cascade from inspection) | Owned by inspection record |
| `Defect` | Soft delete | Preserve ticket traceability |
| `Ticket` | Soft delete | Preserve full lifecycle audit |
| `WorkOrder` | Soft delete | Preserve work history |
| `EvidenceItem` | Soft delete | Preserve annotations and linked records |
| `EvidenceAnnotation` | Hard delete (cascade from evidence) | Owned by evidence item |
| `TicketEvidence` | Hard delete (cascade from ticket) | Join table, no independent value |
| `WorkOrderEvidence` | Hard delete (cascade from work order) | Join table, no independent value |
| `AvailabilitySlot` | Hard delete | Ephemeral scheduling data |
| `AbsenceRecord` | Hard delete | Ephemeral, but audit trail captures changes |
| `Assignment` | Hard delete | Ephemeral, audit trail captures changes |
| `ReplacementSuggestion` | Hard delete | Ephemeral, can be regenerated |
| `AuditEvent` | Never delete | Append-only, tamper-evident (US-AUDIT-01) |
| `SyncEvent` | Hard delete after 90-day retention | Ephemeral operational data |

### Nullable vs Required Fields

**Always required** (non-nullable):
- All `id`, `created_at`, `updated_at` columns
- All foreign keys on mandatory relationships (e.g., `organization_id` on `Site`)
- `status` fields (with default values)
- `email`, `password_hash`, `first_name`, `last_name`, `role` on `User`
- `name` on all asset hierarchy entities
- `title`, `description`, `status`, `priority`, `created_by` on `Ticket`
- `file_url`, `media_type`, `uploaded_by` on `EvidenceItem`
- `action`, `entity_type`, `entity_id` on `AuditEvent`

**Nullable** (optional):
- `deleted_at` on all soft-delete models
- `description` fields on most entities
- `due_date`, `sla_target_date`, `closed_at`, `resolution_notes`, `root_cause` on `Ticket`
- `assignee_id` on `Ticket` and `WorkOrder` (unassigned state)
- `defect_id` on `Ticket` (tickets can be created independently)
- `component_id` on `InspectionRecord` (may inspect whole turbine)
- `reviewed_by`, `review_notes`, `reviewed_at`, `started_at`, `completed_at`, `submitted_at` on `InspectionRecord`
- `latitude`, `longitude` on `Site` and `Turbine`
- `expiry_date` on `UserCertification` (some certs don't expire)
- `certificate_url` on `UserCertification`
- `conflict_data`, `error_message`, `synced_at` on `SyncEvent`
- `client_id` on syncable entities (set only for mobile-originated records)

### JSONB Columns

| Table | Column | Purpose | Structure |
|---|---|---|---|
| `inspection_template_versions` | `schema` | Template field definitions | `{ "fields": [{ "key": "blade_position", "type": "DROPDOWN", "label": "Blade Position", "required": true, "options": ["A", "B", "C"] }] }` |
| `inspection_field_data` | `value_json` | Complex field values | Dropdown selections, annotation data, signature data |
| `evidence_items` | `metadata` | Media metadata | `{ "width": 4000, "height": 3000, "duration_s": null, "device": "iPhone 15", "exif": { ... } }` |
| `evidence_annotations` | `data` | Annotation overlay | `{ "type": "arrow", "x1": 120, "y1": 80, "x2": 200, "y2": 150, "color": "#FF0000" }` |
| `audit_events` | `before_state` | Pre-change snapshot | `{ "status": "NEW", "priority": "MEDIUM" }` |
| `audit_events` | `after_state` | Post-change snapshot | `{ "status": "ASSIGNED", "priority": "HIGH" }` |
| `audit_events` | `metadata` | Additional context | `{ "ip": "192.168.1.42", "user_agent": "Mozilla/5.0..." }` |
| `sync_events` | `conflict_data` | Conflict details for QA | `{ "local_value": "ASSIGNED", "server_value": "IN_PROGRESS", "field": "status", "resolution": null }` |
