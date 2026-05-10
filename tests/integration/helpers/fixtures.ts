import { prisma } from "./db.js";

export async function createOrg(name?: string) {
  return prisma.organization.create({
    data: { name: name || `Org-${crypto.randomUUID().slice(0, 8)}` },
  });
}

export async function createSite(organizationId: string, name?: string) {
  return prisma.site.create({
    data: {
      name: name || `Site-${crypto.randomUUID().slice(0, 8)}`,
      organization_id: organizationId,
    },
  });
}

export async function createTurbine(siteId: string, name?: string) {
  return prisma.turbine.create({
    data: {
      name: name || `T-${crypto.randomUUID().slice(0, 8)}`,
      site_id: siteId,
    },
  });
}

export async function createSubsystem(turbineId: string, name?: string) {
  return prisma.subsystem.create({
    data: {
      name: name || `Sub-${crypto.randomUUID().slice(0, 8)}`,
      turbine_id: turbineId,
    },
  });
}

export async function createComponent(subsystemId: string, name?: string) {
  return prisma.component.create({
    data: {
      name: name || `Comp-${crypto.randomUUID().slice(0, 8)}`,
      subsystem_id: subsystemId,
    },
  });
}

export async function createFullHierarchy() {
  const org = await createOrg();
  const site = await createSite(org.id);
  const turbine = await createTurbine(site.id);
  const subsystem = await createSubsystem(turbine.id);
  const component = await createComponent(subsystem.id);
  return { org, site, turbine, subsystem, component };
}

export async function createSkill(name?: string) {
  return prisma.skill.create({
    data: { name: name || `Skill-${crypto.randomUUID().slice(0, 8)}`, category: "electrical" },
  });
}

export async function createCertification(name?: string) {
  return prisma.certification.create({
    data: { name: name || `Cert-${crypto.randomUUID().slice(0, 8)}` },
  });
}

export async function createInspectionTemplate(name?: string) {
  return prisma.inspectionTemplate.create({
    data: { name: name || `Tpl-${crypto.randomUUID().slice(0, 8)}` },
  });
}

export async function createTemplateVersion(templateId: string, createdBy: string, version = 1) {
  return prisma.inspectionTemplateVersion.create({
    data: {
      template_id: templateId,
      version,
      schema: { fields: [] },
      created_by: createdBy,
    },
  });
}
