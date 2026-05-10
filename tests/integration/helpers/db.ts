import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export { prisma };
export default prisma;

const TABLES = [
  "audit_events",
  "sync_events",
  "replacement_suggestions",
  "assignments",
  "absence_records",
  "availability_slots",
  "work_order_evidence",
  "ticket_evidence",
  "evidence_annotations",
  "evidence_items",
  "work_orders",
  "tickets",
  "defects",
  "inspection_field_data",
  "inspection_records",
  "inspection_template_versions",
  "inspection_templates",
  "user_certifications",
  "user_skills",
  "refresh_tokens",
  "users",
  "certifications",
  "skills",
  "components",
  "subsystems",
  "turbines",
  "sites",
  "organizations",
];

export async function cleanDatabase(): Promise<void> {
  for (const table of TABLES) {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE`);
  }
}
