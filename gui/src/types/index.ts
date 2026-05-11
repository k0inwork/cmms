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
export type Severity = "COSMETIC" | "MINOR" | "MAJOR" | "CRITICAL" | "SAFETY";

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
}

export interface TicketEvidence {
  id: string;
  media_type: string;
  thumbnail_url: string | null;
}

export interface TicketEvidenceLink {
  id: string;
  evidence: TicketEvidence;
}

export interface TicketAuditEvent {
  id: string;
  userName?: string;
  action: string;
  timestamp: string;
}

export interface TicketDetail {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  status: TicketStatus;
  severity?: Severity;
  resolution_notes?: string;
  root_cause?: string;
  due_date?: string;
  sla_target_date?: string;
  closed_at?: string;
  created_at: string;
  updated_at: string;
  assignee: TicketUser | null;
  creator: TicketUser;
  turbine: { id: string; name: string } | null;
  component: { id: string; name: string } | null;
  defect: { id: string; severity: string; description: string } | null;
  ticket_evidence: TicketEvidenceLink[];
  audit_events: TicketAuditEvent[];
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

// ─── Admin ──────────────────────────────────────────────────────────────────────

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

export interface AdminUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: Role;
  is_active: boolean;
  status: TechnicianStatus;
  organization_id: string;
  created_at: string;
  updated_at: string;
  user_skills?: UserSkill[];
  user_certifications?: UserCertification[];
}

export interface Skill {
  id: string;
  name: string;
  category?: string | null;
  description?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Certification {
  id: string;
  name: string;
  issuing_body?: string | null;
  validity_months?: number | null;
  description?: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserSkill {
  id: string;
  user_id: string;
  skill_id: string;
  proficiency_level: number;
  acquired_date: string;
  skill: Skill;
}

export interface UserCertification {
  id: string;
  user_id: string;
  certification_id: string;
  issued_date: string;
  expiry_date?: string | null;
  certificate_url?: string | null;
  certification: Certification;
}

export interface WorkflowRule {
  id: string;
  name: string;
  description?: string;
  trigger: string;
  conditions?: Record<string, unknown>;
  actions?: Record<string, unknown>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Audit ──────────────────────────────────────────────────────────────────────

export type AuditAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "STATUS_CHANGE"
  | "ASSIGN"
  | "APPROVE"
  | "REJECT"
  | "SYNC"
  | "LOGIN"
  | "LOGOUT";

export interface AuditEvent {
  id: string;
  entity_type: string;
  entity_id: string;
  action: AuditAction;
  user_id: string;
  before_state?: any;
  after_state?: any;
  metadata?: any;
  created_at: string;
  user?: { id: string; first_name: string; last_name: string; email: string };
}

// ─── Reports ────────────────────────────────────────────────────────────────────

export interface ReportFilters {
  dateFrom?: string;
  dateTo?: string;
  orgId?: string;
  siteId?: string;
}

export interface ComplianceReport {
  report_type: "compliance";
  generated_at: string;
  filters: ReportFilters;
  summary: {
    total_inspections: number;
    completed: number;
    rejected: number;
    overdue: number;
    approval_rate: number;
    rejection_rate: number;
  };
  by_status: Record<string, number>;
}

export interface InspectionsReport {
  report_type: "inspections";
  generated_at: string;
  filters: ReportFilters;
  summary: { total: number; avg_completion_hours: number | null };
  by_status: Record<string, number>;
}

export interface WorkOrdersReport {
  report_type: "work-orders";
  generated_at: string;
  filters: ReportFilters;
  summary: { total: number; closed: number; avg_completion_hours: number | null };
  by_status: Record<string, number>;
  by_priority: Record<string, number>;
}

export interface TechnicianProductivityReport {
  report_type: "technician-productivity";
  generated_at: string;
  filters: ReportFilters;
  data: {
    technician_id: string;
    name: string;
    email: string;
    work_orders_completed: number;
    inspections_completed: number;
  }[];
}
