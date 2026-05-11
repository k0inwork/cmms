// ─── Auth ──────────────────────────────────────────────────────────────────────

export type Role =
  | "TECHNICIAN"
  | "DISPATCHER"
  | "QA_REVIEWER"
  | "OPERATIONS_MANAGER"
  | "ADMINISTRATOR";

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  isActive: boolean;
  organizationId: string;
  createdAt: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
}

// ─── API ───────────────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    next_cursor: string | null;
    has_more: boolean;
  };
}

export interface ApiError {
  error: string;
  code?: string;
  details?: Record<string, string[]>;
}

// ─── Domain ────────────────────────────────────────────────────────────────────

export interface Organization {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface Site {
  id: string;
  organization_id: string;
  name: string;
  latitude?: number;
  longitude?: number;
  time_zone: string;
  created_at: string;
  updated_at: string;
}

export type TurbineStatus = "ACTIVE" | "DECOMMISSIONED" | "MAINTENANCE" | "PLANNED";

export interface Turbine {
  id: string;
  site_id: string;
  name: string;
  status: TurbineStatus;
  model?: string;
  latitude?: number;
  longitude?: number;
  created_at: string;
  updated_at: string;
}

export interface Subsystem {
  id: string;
  turbine_id: string;
  name: string;
  type?: string;
  created_at: string;
  updated_at: string;
}

export interface Component {
  id: string;
  subsystem_id: string;
  name: string;
  status: TurbineStatus;
  created_at: string;
  updated_at: string;
}

export type AssetType = "organization" | "site" | "turbine" | "subsystem" | "component";

export interface AssetLookupResult {
  type: "Turbine" | "Subsystem" | "Component";
  id: string;
  name: string;
  status?: string;
  site?: { id: string; name: string; organization_id: string };
  turbine?: { id: string; name: string; site: { id: string; name: string; organization_id: string } };
  subsystem?: { id: string; name: string; turbine: { id: string; name: string; site: { id: string; name: string; organization_id: string } } };
}

export type TicketStatus =
  | "NEW"
  | "TRIAGED"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "PENDING_REVIEW"
  | "CLOSED"
  | "REOPENED";

export type Priority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type Severity = "COSMETIC" | "MINOR" | "MAJOR" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | "SAFETY";

export interface Ticket {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  status: TicketStatus;
  assignee_id?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface TicketUser {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

export interface TicketAuditEvent {
  id: string;
  action: string;
  performed_by: string;
  userName?: string;
  performer?: TicketUser;
  timestamp: string;
  created_at: string;
  changes?: Record<string, unknown>;
}

export interface TicketDetail extends Ticket {
  severity?: string;
  resolution_notes?: string;
  root_cause?: string;
  sla_target_date?: string;
  due_date?: string;
  closed_at?: string;
  turbine?: { id: string; name: string };
  component?: { id: string; name: string };
  assignee?: TicketUser;
  creator: TicketUser;
  audit_events: TicketAuditEvent[];
  ticket_evidence: { id: string; evidence: { media_type: string; file_url: string; thumbnail_url: string | null; description: string | null } }[];
}

export type InspectionStatus =
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "SUBMITTED"
  | "APPROVED"
  | "REJECTED"
  | "CHANGES_REQUESTED";

export interface Inspection {
  id: string;
  status: InspectionStatus;
  started_at?: string;
  completed_at?: string;
  due_date?: string;
  created_at: string;
  updated_at: string;
}

export interface WorkOrder {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  status: TicketStatus;
  assignee_id?: string;
  created_by: string;
  due_date?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export type EvidenceMediaType = "PHOTO" | "VIDEO" | "PDF" | "DOCUMENT" | "SENSOR_EXPORT";
export type EvidenceStatus = "PENDING" | "APPROVED" | "FLAGGED";

export interface EvidenceItem {
  id: string;
  media_type: EvidenceMediaType;
  status: EvidenceStatus;
  file_url: string;
  thumbnail_url: string | null;
  file_size_bytes: number;
  mime_type: string;
  version: number;
  uploaded_by: string;
  asset_id: string | null;
  inspection_id: string | null;
  component_id: string | null;
  description: string | null;
  metadata: any | null;
  created_at: string;
  updated_at: string;
  uploader?: User;
  annotations?: EvidenceAnnotation[];
}

export interface EvidenceAnnotation {
  id: string;
  evidence_id: string;
  author_id: string;
  annotation_type: "ARROW" | "CIRCLE" | "TEXT";
  data: any;
  version: number;
  created_at: string;
}

// ─── Dispatch ───────────────────────────────────────────────────────────────

export type TechnicianStatus =
  | "AVAILABLE"
  | "ASSIGNED"
  | "TRAVELING"
  | "ON_SITE"
  | "ON_BREAK"
  | "SICK"
  | "TRAINING"
  | "LEAVE"
  | "UNAVAILABLE";

export interface TechnicianListItem {
  id: string;
  name: string;
  email: string;
  status: TechnicianStatus;
  skills: { id: string; name: string; proficiencyLevel: string | null }[];
  certifications: { id: string; name: string; isValid: boolean }[];
  activeAssignments: number;
  lastStatusChange: string;
}

export interface CoverageTechnician {
  id: string;
  name: string;
  status: string;
  assignments: { id: string; type: "INSPECTION" | "WORK_ORDER"; title: string | null }[];
  coverageGaps: unknown[];
}

export interface CoverageResponse {
  date: string;
  siteId: string | null;
  technicians: CoverageTechnician[];
  gaps: unknown[];
}

export interface SlaRiskItem {
  id: string;
  type: "TICKET" | "WORK_ORDER";
  title: string;
  assigneeId: string | null;
  assigneeName: string | null;
  slaTarget: string | null;
  slaRemainingMs: number;
  riskLevel: "CRITICAL" | "HIGH" | "MEDIUM";
}

export interface SlaRiskResponse {
  atRisk: SlaRiskItem[];
}

export interface Assignment {
  id: string;
  status: string;
  assignedAt: string;
  acceptedAt: string | null;
  type: "INSPECTION" | "WORK_ORDER";
  reference: { id: string; status: string; title?: string } | null;
}

export interface AbsenceRecord {
  id: string;
  user_id: string;
  reason: "SICK" | "PERSONAL_LEAVE" | "TRAINING" | "VACATION" | "OTHER";
  start_date: string;
  expected_return_date: string | null;
  notes: string | null;
  is_approved: boolean;
  created_at: string;
}

export interface AbsenceResponse {
  id: string;
  technicianId: string;
  reason: string;
  startDate: string;
  expectedReturnDate: string | null;
  approvalStatus: string;
  affectedAssignments: number;
  replacementSuggestionsAvailable: boolean;
}

export interface ReplacementCandidate {
  technicianId: string;
  name: string;
  totalScore: number;
  scoreBreakdown: {
    skillMatch: number;
    certificationMatch: number;
    proximity: number;
    workloadCapacity: number;
    siteFamiliarity: number;
  };
  currentStatus: string;
  currentAssignments: number;
  isAboveThreshold: boolean;
}

export interface ReplacementSuggestionsResponse {
  absentTechnicianId: string;
  absenceId: string | null;
  affectedAssignments: { id: string; type: string; title: string | null }[];
  candidates: ReplacementCandidate[];
  escalationRequired: boolean;
}
