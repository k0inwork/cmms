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

export interface Turbine {
  id: string;
  site_id: string;
  name: string;
  status: string;
  model?: string;
  created_at: string;
  updated_at: string;
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

// ─── Reports ────────────────────────────────────────────────────────────────────

export interface ReportFilters {
  dateFrom: string | null;
  dateTo: string | null;
  orgId: string | null;
  siteId: string | null;
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
  data: Array<{
    technician_id: string;
    name: string;
    email: string;
    work_orders_completed: number;
    inspections_completed: number;
  }>;
}

// ─── Search ─────────────────────────────────────────────────────────────────────

export type SearchEntityType = "TICKET" | "WORK_ORDER" | "INSPECTION" | "TURBINE" | "COMPONENT";

export interface SearchHit {
  id: string;
  type: SearchEntityType;
  title: string;
  description: string | null;
  status: string | null;
  priority: string | null;
  createdAt: string;
  updatedAt: string;
  assignee: { id: string; firstName: string; lastName: string } | null;
  turbine: { id: string; name: string } | null;
  site: { id: string; name: string } | null;
}

export interface SearchResponse {
  data: SearchHit[];
  pagination: { next_cursor: string | null; has_more: boolean };
}
