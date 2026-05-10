import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import prisma from "./helpers/db.js";
import { cleanDatabase } from "./helpers/db.js";
import { createOrg, createSite, createTurbine, createSubsystem, createComponent, createSkill, createCertification, createInspectionTemplate } from "./helpers/fixtures.js";
import { createTestUser } from "./helpers/auth.js";

describe("Database constraints", () => {
  let orgId: string;

  beforeAll(async () => {
    await cleanDatabase();
    const org = await createOrg("Constraint Test Org");
    orgId = org.id;
  });

  afterEach(async () => {
    // Clean most tables but keep org for reuse
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "inspection_field_data" CASCADE`);
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "inspection_records" CASCADE`);
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "inspection_template_versions" CASCADE`);
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "inspection_templates" CASCADE`);
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "work_order_evidence" CASCADE`);
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "ticket_evidence" CASCADE`);
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "evidence_annotations" CASCADE`);
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "evidence_items" CASCADE`);
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "work_orders" CASCADE`);
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "tickets" CASCADE`);
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "defects" CASCADE`);
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "assignments" CASCADE`);
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "absence_records" CASCADE`);
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "availability_slots" CASCADE`);
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "replacement_suggestions" CASCADE`);
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "user_certifications" CASCADE`);
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "user_skills" CASCADE`);
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "refresh_tokens" CASCADE`);
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "users" CASCADE`);
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "skills" CASCADE`);
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "certifications" CASCADE`);
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "components" CASCADE`);
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "subsystems" CASCADE`);
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "turbines" CASCADE`);
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "sites" CASCADE`);
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "audit_events" CASCADE`);
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "sync_events" CASCADE`);
  });

  afterAll(async () => {
    await cleanDatabase();
    await prisma.$disconnect();
  });

  // ── Unique constraints ─────────────────────────────────────────────────────

  describe("unique constraints", () => {
    it("rejects duplicate organization names", async () => {
      await createOrg("Unique Org Name");
      await expect(createOrg("Unique Org Name")).rejects.toThrow(/unique/i);
    });

    it("allows same site name in different orgs", async () => {
      const org2 = await createOrg("Second Org");
      const site1 = await createSite(orgId, "Shared Site Name");
      const site2 = await createSite(org2.id, "Shared Site Name");
      expect(site1.id).not.toBe(site2.id);
    });

    it("rejects duplicate site name within same org", async () => {
      await createSite(orgId, "Dup Site");
      await expect(createSite(orgId, "Dup Site")).rejects.toThrow(/unique/i);
    });

    it("allows same turbine name in different sites", async () => {
      const site1 = await createSite(orgId, "Site A");
      const site2 = await createSite(orgId, "Site B");
      const t1 = await createTurbine(site1.id, "T-001");
      const t2 = await createTurbine(site2.id, "T-001");
      expect(t1.id).not.toBe(t2.id);
    });

    it("rejects duplicate turbine name within same site", async () => {
      const site = await createSite(orgId, "Turb Site");
      await createTurbine(site.id, "T-Dup");
      await expect(createTurbine(site.id, "T-Dup")).rejects.toThrow(/unique/i);
    });

    it("rejects duplicate subsystem name within same turbine", async () => {
      const site = await createSite(orgId, "Sub Site");
      const turbine = await createTurbine(site.id);
      await createSubsystem(turbine.id, "Sub-Dup");
      await expect(createSubsystem(turbine.id, "Sub-Dup")).rejects.toThrow(/unique/i);
    });

    it("rejects duplicate component name within same subsystem", async () => {
      const site = await createSite(orgId, "Comp Site");
      const turbine = await createTurbine(site.id);
      const subsystem = await createSubsystem(turbine.id);
      await createComponent(subsystem.id, "Comp-Dup");
      await expect(createComponent(subsystem.id, "Comp-Dup")).rejects.toThrow(/unique/i);
    });

    it("rejects duplicate user email", async () => {
      await createTestUser({ email: "dup@test.com", organizationId: orgId });
      await expect(createTestUser({ email: "dup@test.com", organizationId: orgId })).rejects.toThrow(/unique/i);
    });

    it("rejects duplicate skill name", async () => {
      await createSkill("Unique Skill");
      await expect(createSkill("Unique Skill")).rejects.toThrow(/unique/i);
    });

    it("rejects duplicate certification name", async () => {
      await createCertification("Unique Cert");
      await expect(createCertification("Unique Cert")).rejects.toThrow(/unique/i);
    });

    it("rejects duplicate user+skill pair", async () => {
      const { user } = await createTestUser({ organizationId: orgId });
      const skill = await createSkill();
      await prisma.userSkill.create({
        data: { user_id: user.id, skill_id: skill.id, proficiency_level: 3, acquired_date: new Date() },
      });
      await expect(
        prisma.userSkill.create({
          data: { user_id: user.id, skill_id: skill.id, proficiency_level: 4, acquired_date: new Date() },
        }),
      ).rejects.toThrow(/unique/i);
    });

    it("rejects duplicate user+certification pair", async () => {
      const { user } = await createTestUser({ organizationId: orgId });
      const cert = await createCertification();
      await prisma.userCertification.create({
        data: { user_id: user.id, certification_id: cert.id, issued_date: new Date() },
      });
      await expect(
        prisma.userCertification.create({
          data: { user_id: user.id, certification_id: cert.id, issued_date: new Date() },
        }),
      ).rejects.toThrow(/unique/i);
    });
  });

  // ── Foreign key constraints ────────────────────────────────────────────────

  describe("foreign key constraints", () => {
    it("rejects site with non-existent org", async () => {
      await expect(
        prisma.site.create({ data: { name: "Ghost", organization_id: crypto.randomUUID() } }),
      ).rejects.toThrow(/foreign key/i);
    });

    it("rejects turbine with non-existent site", async () => {
      await expect(
        prisma.turbine.create({ data: { name: "Ghost T", site_id: crypto.randomUUID() } }),
      ).rejects.toThrow(/foreign key/i);
    });

    it("rejects user with non-existent org", async () => {
      await expect(
        prisma.user.create({
          data: {
            email: "ghost@test.com",
            password_hash: "x",
            first_name: "G",
            last_name: "H",
            role: "TECHNICIAN",
            organization_id: crypto.randomUUID(),
          },
        }),
      ).rejects.toThrow(/foreign key/i);
    });

    it("rejects work order with non-existent ticket", async () => {
      await expect(
        prisma.workOrder.create({
          data: {
            ticket_id: crypto.randomUUID(),
            created_by: crypto.randomUUID(),
            title: "WO",
            description: "test",
          },
        }),
      ).rejects.toThrow(/foreign key/i);
    });

    it("rejects inspection with non-existent template version", async () => {
      const { user } = await createTestUser({ organizationId: orgId });
      const site = await createSite(orgId);
      const turbine = await createTurbine(site.id);
      await expect(
        prisma.inspectionRecord.create({
          data: {
            template_version_id: crypto.randomUUID(),
            technician_id: user.id,
            turbine_id: turbine.id,
          },
        }),
      ).rejects.toThrow(/foreign key/i);
    });
  });

  // ── Cascading deletes ──────────────────────────────────────────────────────

  describe("cascading deletes", () => {
    it("deletes refresh tokens when user is deleted", async () => {
      const { user } = await createTestUser({ organizationId: orgId });
      await prisma.refreshToken.create({
        data: {
          token_hash: `hash-${crypto.randomUUID()}`,
          user_id: user.id,
          expires_at: new Date(Date.now() + 86400000),
        },
      });

      const before = await prisma.refreshToken.count({ where: { user_id: user.id } });
      expect(before).toBe(1);

      await prisma.user.delete({ where: { id: user.id } });
      const after = await prisma.refreshToken.count({ where: { user_id: user.id } });
      expect(after).toBe(0);
    });

    it("deletes inspection field data when inspection is deleted", async () => {
      const { user } = await createTestUser({ organizationId: orgId });
      const site = await createSite(orgId);
      const turbine = await createTurbine(site.id);
      const tpl = await createInspectionTemplate();
      const version = await prisma.inspectionTemplateVersion.create({
        data: { template_id: tpl.id, version: 1, schema: {}, created_by: user.id },
      });
      const inspection = await prisma.inspectionRecord.create({
        data: { template_version_id: version.id, technician_id: user.id, turbine_id: turbine.id },
      });
      await prisma.inspectionFieldData.create({
        data: {
          inspection_id: inspection.id,
          field_key: "temp",
          field_type: "NUMERIC",
          value_numeric: 42.5,
        },
      });

      const before = await prisma.inspectionFieldData.count({ where: { inspection_id: inspection.id } });
      expect(before).toBe(1);

      await prisma.inspectionRecord.delete({ where: { id: inspection.id } });
      const after = await prisma.inspectionFieldData.count({ where: { inspection_id: inspection.id } });
      expect(after).toBe(0);
    });

    it("deletes evidence annotations when evidence is deleted", async () => {
      const { user } = await createTestUser({ organizationId: orgId });
      const evidence = await prisma.evidenceItem.create({
        data: {
          media_type: "PHOTO",
          file_url: "https://example.com/img.jpg",
          file_size_bytes: 1024,
          mime_type: "image/jpeg",
          uploaded_by: user.id,
        },
      });
      await prisma.evidenceAnnotation.create({
        data: {
          evidence_id: evidence.id,
          author_id: user.id,
          annotation_type: "marker",
          data: { x: 10, y: 20 },
        },
      });

      const before = await prisma.evidenceAnnotation.count({ where: { evidence_id: evidence.id } });
      expect(before).toBe(1);

      await prisma.evidenceItem.delete({ where: { id: evidence.id } });
      const after = await prisma.evidenceAnnotation.count({ where: { evidence_id: evidence.id } });
      expect(after).toBe(0);
    });

    it("deletes ticket evidence when ticket is deleted", async () => {
      const { user, token } = await createTestUser({ organizationId: orgId, role: "DISPATCHER" });
      const ticket = await prisma.ticket.create({
        data: { title: "T", description: "D", created_by: user.id },
      });
      const evidence = await prisma.evidenceItem.create({
        data: {
          media_type: "PHOTO",
          file_url: "https://example.com/img.jpg",
          file_size_bytes: 512,
          mime_type: "image/jpeg",
          uploaded_by: user.id,
        },
      });
      await prisma.ticketEvidence.create({
        data: { ticket_id: ticket.id, evidence_id: evidence.id, linked_by: user.id },
      });

      const before = await prisma.ticketEvidence.count({ where: { ticket_id: ticket.id } });
      expect(before).toBe(1);

      await prisma.ticket.delete({ where: { id: ticket.id } });
      const after = await prisma.ticketEvidence.count({ where: { ticket_id: ticket.id } });
      expect(after).toBe(0);
    });

    it("deletes work order evidence when work order is deleted", async () => {
      const { user } = await createTestUser({ organizationId: orgId });
      const ticket = await prisma.ticket.create({
        data: { title: "T", description: "D", created_by: user.id },
      });
      const wo = await prisma.workOrder.create({
        data: { ticket_id: ticket.id, created_by: user.id, title: "WO", description: "D" },
      });
      const evidence = await prisma.evidenceItem.create({
        data: {
          media_type: "PHOTO",
          file_url: "https://example.com/img.jpg",
          file_size_bytes: 256,
          mime_type: "image/jpeg",
          uploaded_by: user.id,
        },
      });
      await prisma.workOrderEvidence.create({
        data: { work_order_id: wo.id, evidence_id: evidence.id, linked_by: user.id },
      });

      const before = await prisma.workOrderEvidence.count({ where: { work_order_id: wo.id } });
      expect(before).toBe(1);

      await prisma.workOrder.delete({ where: { id: wo.id } });
      const after = await prisma.workOrderEvidence.count({ where: { work_order_id: wo.id } });
      expect(after).toBe(0);
    });
  });

  // ── NOT NULL constraints ───────────────────────────────────────────────────

  describe("not null constraints", () => {
    it("rejects organization without name (null)", async () => {
      await expect(
        prisma.organization.create({ data: { name: null } } as any),
      ).rejects.toThrow();
    });

    it("rejects ticket without title", async () => {
      const { user } = await createTestUser({ organizationId: orgId });
      await expect(
        prisma.ticket.create({ data: { description: "D", created_by: user.id } } as any),
      ).rejects.toThrow();
    });

    it("rejects ticket without description", async () => {
      const { user } = await createTestUser({ organizationId: orgId });
      await expect(
        prisma.ticket.create({ data: { title: "T", created_by: user.id } } as any),
      ).rejects.toThrow();
    });
  });
});
