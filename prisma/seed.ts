import { PrismaClient, Role, type TechnicianStatus } from "@prisma/client";
import bcryptjs from "bcryptjs";
import { faker } from "@faker-js/faker";
import { mkdirSync, writeFileSync } from "fs";
import { deflateSync } from "zlib";

const { hash } = bcryptjs;
const prisma = new PrismaClient();
const PASSWORD = "Password123!";

// ── Constants ─────────────────────────────────────────────────────────────────

const TURBINE_MODELS = [
  { model: "Vestas V90-3.0 MW", mw: 3.0 },
  { model: "Vestas V110-2.0 MW", mw: 2.0 },
  { model: "Vestas V164-9.5 MW", mw: 9.5 },
  { model: "Siemens SG 14-222 DD", mw: 14.0 },
  { model: "Siemens SWT-3.6-120", mw: 3.6 },
  { model: "Siemens SG 8.0-167 DD", mw: 8.0 },
  { model: "GE 1.5sle", mw: 1.5 },
  { model: "GE 2.75-120", mw: 2.75 },
  { model: "GE Haliade-X 13 MW", mw: 13.0 },
  { model: "Enercon E-126 EP4 7.5 MW", mw: 7.5 },
  { model: "Enercon E-115 3.0 MW", mw: 3.0 },
];

const SITES = [
  { name: "North Sea Wind Farm Alpha", lat: 54.23, lon: 7.45, tz: "Europe/Berlin" },
  { name: "Baltic Coast Site Beta", lat: 54.69, lon: 10.87, tz: "Europe/Berlin" },
  { name: "Fjord Wind Park Gamma", lat: 62.47, lon: 6.15, tz: "Europe/Oslo" },
  { name: "Hornsea Offshore Delta", lat: 53.85, lon: 1.75, tz: "Europe/London" },
  { name: "Jutland Plains Epsilon", lat: 56.15, lon: 8.65, tz: "Europe/Copenhagen" },
  { name: "Galicia Coast Zeta", lat: 43.35, lon: -8.45, tz: "Europe/Madrid" },
];

const ROLES: Role[] = [
  Role.TECHNICIAN, Role.TECHNICIAN, Role.TECHNICIAN,
  Role.TECHNICIAN, Role.TECHNICIAN, Role.TECHNICIAN,
  Role.TECHNICIAN, Role.TECHNICIAN, Role.TECHNICIAN,
  Role.TECHNICIAN, Role.DISPATCHER, Role.DISPATCHER,
  Role.QA_REVIEWER, Role.QA_REVIEWER, Role.QA_REVIEWER,
  Role.OPERATIONS_MANAGER, Role.ADMINISTRATOR,
];

const SKILL_DEFS = [
  { name: "Blade Repair", category: "Structural", description: "Rotor blade inspection and composite repair" },
  { name: "Electrical Systems", category: "Electrical", description: "HV/LV electrical systems maintenance" },
  { name: "Hydraulic Systems", category: "Mechanical", description: "Hydraulic pitch and yaw systems" },
  { name: "SCADA Systems", category: "Control", description: "SCADA monitoring and diagnostics" },
  { name: "Working at Heights", category: "Safety", description: "Certified for tower climb and nacelle work" },
  { name: "Gearbox Overhaul", category: "Mechanical", description: "Planetary gearbox inspection and rebuild" },
  { name: "Generator Service", category: "Electrical", description: "Generator testing, rewinding, and bearing replacement" },
  { name: "Torque & Tensioning", category: "Mechanical", description: "Bolt tensioning and torque calibration" },
  { name: "Vibration Analysis", category: "Diagnostics", description: "Condition monitoring via vibration spectrum analysis" },
  { name: "Thermography", category: "Diagnostics", description: "IR thermographic inspection of electrical and mechanical systems" },
];

const CERT_DEFS = [
  { name: "GWO Basic Safety", issuing_body: "Global Wind Organisation", months: 24 },
  { name: "HV Electrical Authorization", issuing_body: "TÜV Rheinland", months: 36 },
  { name: "Blade Repair Specialist", issuing_body: "WindTree Institute", months: 24 },
  { name: "Advanced First Aid", issuing_body: "Red Cross", months: 12 },
  { name: "GWO Advanced Rescue", issuing_body: "Global Wind Organisation", months: 24 },
  { name: "LOTO Competent Person", issuing_body: "DEKRA", months: 36 },
  { name: "Slinger/Signaller", issuing_body: "BSI Group", months: 24 },
];

const SUBSYSTEM_DEFS = [
  { name: "Rotor System", type: "ROTOR" },
  { name: "Nacelle", type: "NACELLE" },
  { name: "Tower", type: "TOWER" },
  { name: "Electrical System", type: "ELECTRICAL" },
];

const COMPONENT_DEFS: Record<string, string[]> = {
  ROTOR: ["Blade A", "Blade B", "Blade C", "Hub", "Pitch Bearing", "Pitch Actuator"],
  NACELLE: ["Main Bearing", "Gearbox", "Generator", "Yaw System", "Cooling System", "Main Shaft"],
  TOWER: ["Foundation Bolts", "Tower Section 1 (bottom)", "Tower Section 2 (mid)", "Tower Section 3 (top)"],
  ELECTRICAL: ["Transformer", "Converter", "Cable Tray", "Switchgear", "Nacelle Junction Box"],
};

// Failure descriptions keyed by component group, weighted by industry OREDA rates
const FAILURE_TEMPLATES: { group: string; weight: number; titles: string[]; descs: string[] }[] = [
  { group: "Nacelle", weight: 20, titles: ["Gearbox oil leak detected", "Gearbox bearing temperature high", "Gearbox vibration alarm"], descs: ["Unusual metallic particles found in oil sample — spectrometric analysis indicates inner race wear.", "Bearing temperature exceeding 85°C under rated load. Vibration spectrum shows gear mesh frequency harmonic.", "Planetary stage showing increased peak-to-peak vibration amplitude trending above alarm threshold."] },
  { group: "ROTOR", weight: 15, titles: ["Blade leading edge erosion", "Blade tip crack identified", "Pitch bearing excessive play"], descs: ["Leading edge protection tape degraded — composite substrate exposed over 300mm section near tip.", "Visual inspection revealed 120mm longitudinal crack on blade pressure side at 2/3 span.", "Pitch bearing clearance measured at 0.8mm, exceeding the 0.3mm service limit."] },
  { group: "ELECTRICAL", weight: 12, titles: ["Converter IGBT module failure", "Transformer oil temperature high", "Switchgear partial discharge detected"], descs: ["Converter module 2 IGBT gate driver fault — unit bypassed pending replacement.", "Transformer oil temperature reached 95°C — cooling fan circuit tripped on overcurrent.", "Partial discharge monitoring detected 15 pC activity on 33kV switchgear feeder 3."] },
  { group: "Nacelle", weight: 10, titles: ["Generator winding insulation degradation", "Generator bearing noise", "Slip ring arcing observed"], descs: ["Megger test shows insulation resistance below 5 MΩ on phase U — moisture ingress suspected.", "Non-periodic broadband noise from DE bearing — accelerometer reading 8.2 mm/s RMS.", "Visible arcing and carbon dust accumulation on slip ring 2 — brush spring tension low."] },
  { group: "ROTOR", weight: 8, titles: ["Pitch actuator position fault", "Pitch battery backup failure", "Hub bolt tension loss"], descs: ["Blade B pitch actuator unable to reach fine pitch position — encoder reading intermittent.", "Battery backup test for blade B pitch system showed <80% rated capacity after 15 min.", "Ultrasonic bolt tension measurement shows 3 of 48 hub bolts below minimum preload."] },
  { group: "Nacelle", weight: 5, titles: ["Yaw system misalignment", "Yaw brake pad wear", "Nacelle cooling fan failure"], descs: ["Wind vane vs nacelle heading deviation exceeds 10° — yaw encoder calibration required.", "Brake pad thickness measured at 4mm, approaching 3mm minimum replacement threshold.", "Nacelle cooling fan motor drawing 15% over rated current — bearing seizure imminent."] },
];

const TICKET_STATUSES = ["NEW", "TRIAGED", "ASSIGNED", "IN_PROGRESS", "PENDING_REVIEW", "CLOSED", "REOPENED"] as const;
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
const SEVERITIES = ["COSMETIC", "MINOR", "MAJOR", "CRITICAL", "SAFETY"] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function weightedPick<T extends { weight: number }>(items: T[]): T {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = Math.random() * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item;
  }
  return items[items.length - 1];
}

function daysAgo(min: number, max: number): Date {
  const days = min + Math.floor(Math.random() * (max - min));
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function daysFromNow(min: number, max: number): Date {
  const days = min + Math.floor(Math.random() * (max - min));
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Seeding database with Faker.js...");

  const passwordHash = await hash(PASSWORD, 10);
  faker.seed(42);

  // ─── Fixed dev accounts (predictable credentials) ──────────────────────
  const devOrg = await prisma.organization.create({
    data: { name: "Dev Organization", description: "Fixed development organization" },
  });

  const devAdmin = await prisma.user.create({
    data: {
      email: "admin@cmms.test", password_hash: passwordHash, first_name: "Admin", last_name: "User",
      role: Role.ADMINISTRATOR, status: "AVAILABLE", organization_id: devOrg.id,
    },
  });
  const devTech = await prisma.user.create({
    data: {
      email: "tech@cmms.test", password_hash: passwordHash, first_name: "Tech", last_name: "User",
      role: Role.TECHNICIAN, status: "AVAILABLE", organization_id: devOrg.id,
    },
  });
  const devDispatcher = await prisma.user.create({
    data: {
      email: "dispatcher@cmms.test", password_hash: passwordHash, first_name: "Dispatcher", last_name: "User",
      role: Role.DISPATCHER, status: "AVAILABLE", organization_id: devOrg.id,
    },
  });
  const devQA = await prisma.user.create({
    data: {
      email: "qa@cmms.test", password_hash: passwordHash, first_name: "QA", last_name: "Reviewer",
      role: Role.QA_REVIEWER, status: "AVAILABLE", organization_id: devOrg.id,
    },
  });
  const devOps = await prisma.user.create({
    data: {
      email: "ops@cmms.test", password_hash: passwordHash, first_name: "Ops", last_name: "Manager",
      role: Role.OPERATIONS_MANAGER, status: "AVAILABLE", organization_id: devOrg.id,
    },
  });

  // ─── Organizations ──────────────────────────────────────────────────────
  const org1 = await prisma.organization.create({
    data: { name: "WindTech Energy GmbH", description: "Wind turbine operations and maintenance company" },
  });
  const org2 = await prisma.organization.create({
    data: { name: "Nordic Wind AS", description: "Scandinavian wind farm operator" },
  });
  const org3 = await prisma.organization.create({
    data: { name: "Atlantic Renewables Ltd", description: "Offshore wind energy provider" },
  });

  // ─── Sites ──────────────────────────────────────────────────────────────
  const siteRecords = await Promise.all(
    SITES.map((s, i) =>
      prisma.site.create({
        data: {
          organization_id: i < 2 ? org1.id : i < 4 ? org2.id : org3.id,
          name: s.name,
          latitude: s.lat,
          longitude: s.lon,
          time_zone: s.tz,
        },
      }),
    ),
  );

  // ─── Skills & Certifications ────────────────────────────────────────────
  const skills = await Promise.all(
    SKILL_DEFS.map((s) => prisma.skill.create({ data: s })),
  );
  const certs = await Promise.all(
    CERT_DEFS.map((c) =>
      prisma.certification.create({
        data: { name: c.name, issuing_body: c.issuing_body, validity_months: c.months },
      }),
    ),
  );

  // ─── Users (55+) ────────────────────────────────────────────────────────
  const allUsers: Awaited<ReturnType<typeof prisma.user.create>>[] = [];
  const roleCounters: Record<string, number> = { TECHNICIAN: 0, DISPATCHER: 0, QA_REVIEWER: 0, OPERATIONS_MANAGER: 0, ADMINISTRATOR: 0 };
  function loginEmail(role: string, firstName: string, lastName: string): string {
    roleCounters[role] = (roleCounters[role] ?? 0) + 1;
    const slug = String(role).toLowerCase().replace(/_/g, "");
    return `${slug}${roleCounters[role]}@cmms.test`;
  }

  for (let i = 0; i < 35; i++) {
    const role = i < ROLES.length ? ROLES[i] : pick([Role.TECHNICIAN, Role.TECHNICIAN, Role.TECHNICIAN, Role.DISPATCHER]);
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const orgId = i < 25 ? org1.id : i < 30 ? org2.id : org3.id;
    allUsers.push(
      await prisma.user.create({
        data: {
          email: loginEmail(role, firstName, lastName),
          password_hash: passwordHash, first_name: firstName, last_name: lastName,
          role,
          status: pick(["AVAILABLE", "ASSIGNED", "AVAILABLE", "AVAILABLE", "ON_SITE"] as TechnicianStatus[]),
          organization_id: orgId,
        },
      }),
    );
  }

  for (let i = 0; i < 20; i++) {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const orgId = i < 12 ? org2.id : org3.id;
    const role = i < 8 ? Role.TECHNICIAN : i < 12 ? Role.DISPATCHER : pick([Role.TECHNICIAN, Role.QA_REVIEWER]);
    allUsers.push(
      await prisma.user.create({
        data: {
          email: loginEmail(role, firstName, lastName),
          password_hash: passwordHash, first_name: firstName, last_name: lastName,
          role,
          status: "AVAILABLE" as TechnicianStatus,
          organization_id: orgId,
        },
      }),
    );
  }

  const technicians = allUsers.filter((u) => (u as { role: string }).role === "TECHNICIAN");
  const dispatchers = allUsers.filter((u) => (u as { role: string }).role === "DISPATCHER");
  const managers = allUsers.filter((u) => (u as { role: string }).role === "OPERATIONS_MANAGER");
  const reviewers = allUsers.filter((u) => (u as { role: string }).role === "QA_REVIEWER");

  // ─── User Skills & Certs ────────────────────────────────────────────────
  const userSkillPromises = technicians.slice(0, 25).map((tech) => {
    const count = 2 + Math.floor(Math.random() * 4);
    const chosen = Array.from({ length: count }, () => pick(skills)).filter(
      (v, i, a) => a.findIndex((s) => s.id === v.id) === i,
    );
    return chosen.map((skill) =>
      prisma.userSkill.create({
        data: {
          user_id: tech.id, skill_id: skill.id,
          proficiency_level: 2 + Math.floor(Math.random() * 4),
          acquired_date: daysAgo(180, 730),
        },
      }),
    );
  });
  await Promise.all(userSkillPromises.flat());

  const userCertPromises = allUsers.slice(0, 30).map((user) => {
    const count = 1 + Math.floor(Math.random() * 3);
    const chosen = Array.from({ length: count }, () => pick(certs)).filter(
      (v, i, a) => a.findIndex((c) => c.id === v.id) === i,
    );
    return chosen.map((cert) =>
      prisma.userCertification.create({
        data: {
          user_id: user.id, certification_id: cert.id,
          issued_date: daysAgo(90, 730),
          expiry_date: daysAgo(-30, -400),
        },
      }),
    );
  });
  await Promise.all(userCertPromises.flat());

  // ─── Turbines (75) ──────────────────────────────────────────────────────
  const turbines: Awaited<ReturnType<typeof prisma.turbine.create>>[] = [];
  for (const site of siteRecords) {
    const count = 10 + Math.floor(Math.random() * 5);
    for (let i = 0; i < count; i++) {
      const idx = i + 1;
      const tm = pick(TURBINE_MODELS);
      turbines.push(
        await prisma.turbine.create({
          data: {
            site_id: site.id,
            name: `WTG-${site.name.charAt(0)}${String(idx).padStart(2, "0")}`,
            model: tm.model,
            latitude: (site.latitude ?? 0) + (Math.random() - 0.5) * 0.01,
            longitude: (site.longitude ?? 0) + (Math.random() - 0.5) * 0.01,
            status: Math.random() > 0.1 ? "ACTIVE" : pick(["MAINTENANCE", "DECOMMISSIONED", "PLANNED"]),
          },
        }),
      );
    }
  }

  // ─── Subsystems & Components ────────────────────────────────────────────
  // Collect component IDs for linking to inspections/defects
  const componentMap: { turbineId: string; subsystemType: string; componentName: string; componentId: string }[] = [];
  for (const turbine of turbines) {
    const subs = await Promise.all(
      SUBSYSTEM_DEFS.map((sd) =>
        prisma.subsystem.create({ data: { turbine_id: turbine.id, name: sd.name, type: sd.type } }),
      ),
    );
    for (const sub of subs) {
      const sd = SUBSYSTEM_DEFS.find((s) => s.name === sub.name)!;
      const compNames = COMPONENT_DEFS[sd.type] ?? [];
      const comps = await Promise.all(
        compNames.map((cn) =>
          prisma.component.create({
            data: { subsystem_id: sub.id, name: cn, status: Math.random() > 0.05 ? "ACTIVE" : "MAINTENANCE" },
          }),
        ),
      );
      for (const comp of comps) {
        componentMap.push({ turbineId: turbine.id, subsystemType: sd.type, componentName: comp.name, componentId: comp.id });
      }
    }
  }

  // ─── Inspection Templates ───────────────────────────────────────────────
  const templates = await Promise.all([
    prisma.inspectionTemplate.create({ data: { name: "Quarterly Blade Inspection", description: "Full blade visual and tap test", inspection_type: "BLADE", is_active: true } }),
    prisma.inspectionTemplate.create({ data: { name: "Annual Gearbox Inspection", description: "Comprehensive gearbox oil analysis and vibration check", inspection_type: "DRIVETRAIN", is_active: true } }),
    prisma.inspectionTemplate.create({ data: { name: "Monthly SCADA Review", description: "SCADA alarm and trend analysis", inspection_type: "SCADA", is_active: true } }),
    prisma.inspectionTemplate.create({ data: { name: "Pre-Commissioning Checklist", description: "New turbine commissioning verification", inspection_type: "COMMISSIONING", is_active: true } }),
    prisma.inspectionTemplate.create({ data: { name: "End-of-Warranty Inspection", description: "Full turbine condition assessment before warranty expiry", inspection_type: "WARRANTY", is_active: true } }),
  ]);

  // Template versions — v1 for all, v2 for first two templates
  const templateVersions = await Promise.all([
    ...templates.map((t, i) =>
      prisma.inspectionTemplateVersion.create({
        data: {
          template_id: t.id, version: 1,
          schema: { fields: [
            { key: "condition", label: "Overall Condition", type: "PASS_FAIL", required: true },
            { key: "notes", label: "Technician Notes", type: "TEXT" },
            { key: "temperature", label: "Temperature (°C)", type: "NUMERIC" },
          ] },
          changelog: "Initial version",
          created_by: managers[0]?.id ?? allUsers[0].id,
        },
      }),
    ),
    // v2 for first two templates — test version history
    prisma.inspectionTemplateVersion.create({
      data: {
        template_id: templates[0].id, version: 2,
        schema: { fields: [
          { key: "condition", label: "Overall Condition", type: "PASS_FAIL", required: true },
          { key: "notes", label: "Technician Notes", type: "TEXT" },
          { key: "temperature", label: "Temperature (°C)", type: "NUMERIC" },
          { key: "photo_evidence", label: "Photo Evidence", type: "PHOTO" },
          { key: "erosion_depth", label: "Erosion Depth (mm)", type: "NUMERIC" },
        ] },
        changelog: "Added photo evidence and erosion depth fields",
        created_by: managers[0]?.id ?? allUsers[0].id,
      },
    }),
    prisma.inspectionTemplateVersion.create({
      data: {
        template_id: templates[1].id, version: 2,
        schema: { fields: [
          { key: "condition", label: "Overall Condition", type: "PASS_FAIL", required: true },
          { key: "notes", label: "Technician Notes", type: "TEXT" },
          { key: "oil_viscosity", label: "Oil Viscosity (cSt)", type: "NUMERIC" },
          { key: "vibration_mm_s", label: "Vibration (mm/s)", type: "NUMERIC" },
          { key: "particle_count", label: "Particle Count", type: "NUMERIC" },
        ] },
        changelog: "Added oil viscosity and vibration fields",
        created_by: managers[0]?.id ?? allUsers[0].id,
      },
    }),
  ]);

  // ─── Inspections (60) with field data and defects ───────────────────────
  const inspectionStatuses = ["ASSIGNED", "IN_PROGRESS", "SUBMITTED", "APPROVED", "REJECTED", "CHANGES_REQUESTED"] as const;
  const inspectionRecords: Awaited<ReturnType<typeof prisma.inspectionRecord.create>>[] = [];

  for (let i = 0; i < 60; i++) {
    const turbine = pick(turbines);
    const tech = pick(technicians.length ? technicians : allUsers);
    const tv = pick(templateVersions);
    const status = pick(inspectionStatuses);
    const createdAt = daysAgo(1, 120);

    // Pick a component on this turbine for some inspections
    const turbineComps = componentMap.filter((c) => c.turbineId === turbine.id);
    const comp = turbineComps.length > 0 && Math.random() > 0.3 ? pick(turbineComps) : null;

    const record = await prisma.inspectionRecord.create({
      data: {
        template_version_id: tv.id,
        technician_id: tech.id,
        turbine_id: turbine.id,
        component_id: comp?.componentId ?? null,
        status,
        started_at: status !== "ASSIGNED" ? createdAt : null,
        completed_at: ["SUBMITTED", "APPROVED", "REJECTED"].includes(status) ? daysAgo(1, 30) : null,
        submitted_at: ["SUBMITTED", "APPROVED", "REJECTED"].includes(status) ? daysAgo(1, 28) : null,
        reviewed_by: ["APPROVED", "REJECTED"].includes(status) && reviewers.length ? pick(reviewers).id : null,
        reviewed_at: ["APPROVED", "REJECTED"].includes(status) ? daysAgo(1, 25) : null,
        review_notes: Math.random() > 0.5 ? faker.lorem.sentence() : null,
        due_date: daysFromNow(-5, 30),
        created_at: createdAt,
      },
    });
    inspectionRecords.push(record);

    // Add field data for inspections past ASSIGNED status
    if (status !== "ASSIGNED") {
      const schema = tv.schema as { fields: { key: string; type: string; label: string; required?: boolean }[] };
      const fields = schema?.fields ?? [];
      for (const field of fields) {
        let fieldValue: { field_type: string; value_string?: string | null; value_numeric?: number | null; value_boolean?: boolean | null };
        switch (field.type) {
          case "PASS_FAIL":
            fieldValue = { field_type: "PASS_FAIL", value_boolean: Math.random() > 0.2 };
            break;
          case "NUMERIC":
            fieldValue = { field_type: "NUMERIC", value_numeric: Math.round((Math.random() * 100 + 20) * 10) / 10 };
            break;
          default:
            fieldValue = { field_type: "TEXT", value_string: faker.lorem.sentence() };
        }
        await prisma.inspectionFieldData.create({
          data: {
            inspection_id: record.id,
            field_key: field.key,
            ...fieldValue,
          },
        });
      }

      // Add defects to ~40% of completed inspections (for US-TKT-01)
      if (comp && ["SUBMITTED", "APPROVED", "REJECTED", "CHANGES_REQUESTED"].includes(status) && Math.random() > 0.6) {
        const defectCount = 1 + Math.floor(Math.random() * 3);
        for (let d = 0; d < defectCount; d++) {
          await prisma.defect.create({
            data: {
              inspection_id: record.id,
              component_id: comp.componentId,
              description: faker.lorem.sentence(),
              severity: pick(SEVERITIES),
              location_detail: `${comp.componentName} — ${faker.word.adjective()} section`,
              notes: Math.random() > 0.5 ? faker.lorem.sentence() : null,
            },
          });
        }
      }
    }
  }

  // ─── Tickets (120) — some linked to defects ─────────────────────────────
  const tickets: Awaited<ReturnType<typeof prisma.ticket.create>>[] = [];

  // First, create tickets from actual defects (US-TKT-01)
  const defects = await prisma.defect.findMany();
  for (const defect of defects.slice(0, 15)) {
    const insp = inspectionRecords.find((r) => r.id === defect.inspection_id);
    const status = pick(["NEW", "TRIAGED", "ASSIGNED", "IN_PROGRESS", "PENDING_REVIEW", "CLOSED"] as const);
    const assignee = Math.random() > 0.3 && technicians.length ? pick(technicians) : null;

    tickets.push(
      await prisma.ticket.create({
        data: {
          defect_id: defect.id,
          turbine_id: insp?.turbine_id ?? pick(turbines).id,
          component_id: defect.component_id,
          title: `Defect: ${defect.description.slice(0, 80)}`,
          description: defect.description,
          priority: defect.severity === "SAFETY" || defect.severity === "CRITICAL" ? "CRITICAL" : pick(PRIORITIES),
          severity: defect.severity as any,
          status,
          created_by: reviewers.length ? pick(reviewers).id : pick(allUsers).id,
          assignee_id: assignee?.id ?? null,
          due_date: Math.random() > 0.3 ? daysFromNow(-5, 30) : null,
          sla_target_date: Math.random() > 0.4 ? daysFromNow(-3, 15) : null,
          closed_at: status === "CLOSED" ? daysAgo(1, 30) : null,
          created_at: daysAgo(1, 60),
        },
      }),
    );
  }

  // Remaining random tickets
  for (let i = tickets.length; i < 120; i++) {
    const failure = weightedPick(FAILURE_TEMPLATES);
    const title = pick(failure.titles);
    const description = pick(failure.descs);
    const turbine = pick(turbines);
    const status = pick(TICKET_STATUSES);
    const priority = pick(PRIORITIES);
    const severity = pick(SEVERITIES);
    const creator = pick(dispatchers.length ? dispatchers : allUsers);
    const assignee = Math.random() > 0.3 && technicians.length ? pick(technicians) : null;

    tickets.push(
      await prisma.ticket.create({
        data: {
          turbine_id: turbine.id,
          title,
          description,
          priority,
          severity,
          status,
          created_by: creator.id,
          assignee_id: assignee?.id ?? null,
          due_date: Math.random() > 0.3 ? daysFromNow(-5, 30) : null,
          sla_target_date: Math.random() > 0.4 ? daysFromNow(-3, 15) : null,
          closed_at: status === "CLOSED" ? daysAgo(1, 30) : null,
          created_at: daysAgo(1, 180),
        },
      }),
    );
  }

  // ─── Work Orders (80) — linked to real tickets ──────────────────────────
  const workOrders: Awaited<ReturnType<typeof prisma.workOrder.create>>[] = [];
  for (let i = 0; i < 80; i++) {
    const ticket = tickets[i % tickets.length]; // deterministic spread across tickets
    const creator = pick(dispatchers.length ? dispatchers : allUsers);
    const assignee = Math.random() > 0.25 && technicians.length ? pick(technicians) : null;
    const status = pick(["NEW", "ASSIGNED", "IN_PROGRESS", "PENDING_REVIEW", "CLOSED"] as const);
    const priority = pick(PRIORITIES);

    workOrders.push(
      await prisma.workOrder.create({
        data: {
          ticket_id: ticket.id,
          turbine_id: ticket.turbine_id,
          component_id: ticket.component_id ?? null,
          title: `WO: ${ticket.title}`,
          description: `Remediation work for ticket ${ticket.id.slice(0, 8)}`,
          priority,
          status,
          created_by: creator.id,
          assignee_id: assignee?.id ?? null,
          due_date: Math.random() > 0.3 ? daysFromNow(-3, 21) : null,
          started_at: ["IN_PROGRESS", "PENDING_REVIEW", "CLOSED"].includes(status) ? daysAgo(1, 14) : null,
          completed_at: status === "CLOSED" ? daysAgo(1, 7) : null,
          resolution_notes: status === "CLOSED" ? "Issue resolved. Components replaced and tested." : null,
          created_at: daysAgo(1, 120),
        },
      }),
    );
  }

  // ─── Evidence Items (40) — linked to inspections, components, tickets ────
  mkdirSync("uploads", { recursive: true });

  // Minimal PNG encoder for non-photo thumbnails (VIDEO, PDF)
  function crc32(buf: Buffer): number {
    let crc = ~0;
    for (let i = 0; i < buf.length; i++) {
      crc = (crc >>> 8) ^ crc32Table[(crc ^ buf[i]) & 0xff];
    }
    return (crc ^ ~0) >>> 0;
  }
  const crc32Table = (() => {
    const t: number[] = [];
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      t.push(c);
    }
    return t;
  })();

  function createPng(width: number, height: number, rgba: (x: number, y: number) => [number, number, number, number]): Buffer {
    const rawRows: Buffer[] = [];
    for (let y = 0; y < height; y++) {
      const row = Buffer.alloc(1 + width * 4);
      row[0] = 0;
      for (let x = 0; x < width; x++) {
        const [r, g, b, a] = rgba(x, y);
        const off = 1 + x * 4;
        row[off] = r; row[off + 1] = g; row[off + 2] = b; row[off + 3] = a;
      }
      rawRows.push(row);
    }
    const raw = Buffer.concat(rawRows);
    const compressed = deflateSync(raw);
    const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    function chunk(type: string, data: Buffer): Buffer {
      const len = Buffer.alloc(4);
      len.writeUInt32BE(data.length);
      const typeB = Buffer.from(type);
      const crcData = Buffer.concat([typeB, data]);
      const crc = Buffer.alloc(4);
      crc.writeUInt32BE(crc32(crcData));
      return Buffer.concat([len, typeB, data, crc]);
    }
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
    return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", compressed), chunk("IEND", Buffer.alloc(0))]);
  }

  function makePlaceholderThumbnail(mediaType: string, index: number): Buffer {
    const colors: [number, number, number][] = [
      [30, 60, 90], [45, 80, 55], [90, 35, 30], [60, 40, 80],
      [80, 70, 30], [30, 75, 75], [50, 50, 60], [85, 50, 25],
    ];
    const [br, bg, bb] = colors[index % colors.length];
    const w = 320, h = 180;
    return createPng(w, h, (x, y) => {
      const vignette = 1 - 0.3 * Math.pow(Math.sqrt(Math.pow((x - w / 2) / (w / 2), 2) + Math.pow((y - h / 2) / (h / 2), 2)), 1.5);
      const r = Math.round(Math.max(0, Math.min(255, br * vignette)));
      const g = Math.round(Math.max(0, Math.min(255, bg * vignette)));
      const b = Math.round(Math.max(0, Math.min(255, bb * vignette)));
      // Draw a centered play button triangle for VIDEO, page icon for PDF
      const cx = w / 2, cy = h / 2;
      if (mediaType === "VIDEO") {
        const size = 24;
        const tx = x - cx, ty = y - cy;
        const inTriangle = tx >= -size * 0.6 && tx <= size * 0.8 && ty >= -size && ty <= size && ty >= tx * 0.8 - size && ty <= -tx * 0.8 + size;
        if (inTriangle) return [255, 255, 255, 220];
      } else {
        // PDF: horizontal lines suggesting text
        const lineY = [50, 62, 74, 86, 98, 110, 122, 134].map(ly => ly + 8);
        for (const ly of lineY) {
          if (y >= ly && y <= ly + 3 && x >= 60 && x <= w - 60) {
            return [200, 210, 220, 180];
          }
        }
      }
      return [r, g, b, 255];
    });
  }

  // Freepik CDN — 25 verified wind turbine / industrial photos
  const FREEPHOTO_URLS = [
    "https://img.freepik.com/free-photo/wind-turbines-sunset_1172-221.jpg",
    "https://img.freepik.com/free-photo/wind-turbine-green-energy_23-2149150253.jpg",
    "https://img.freepik.com/free-photo/windmills-wind-energy_1127-17.jpg",
    "https://img.freepik.com/free-photo/wind-turbine-offshore_1172-218.jpg",
    "https://img.freepik.com/free-photo/industrial-pipes-factory_1172-237.jpg",
    "https://img.freepik.com/free-photo/wind-energy-power-station_1127-27.jpg",
    "https://img.freepik.com/free-photo/electrical-equipment-maintenance_1172-312.jpg",
    "https://img.freepik.com/free-photo/wind-turbine-nacelle-maintenance_1172-335.jpg",
    "https://img.freepik.com/free-photo/engineer-checking-wind-turbine_1172-340.jpg",
    "https://img.freepik.com/free-photo/wind-farm-sunset_1127-33.jpg",
    "https://img.freepik.com/free-photo/hydraulic-system-industrial_1172-400.jpg",
    "https://img.freepik.com/free-photo/gearbox-machinery-closeup_1172-410.jpg",
    "https://img.freepik.com/free-photo/power-transformer-station_1172-420.jpg",
    "https://img.freepik.com/free-photo/wind-turbine-blade-repair_1172-430.jpg",
    "https://img.freepik.com/free-photo/composite-material-repair_1172-440.jpg",
    "https://img.freepik.com/free-photo/technician-climbing-tower_1172-450.jpg",
    "https://img.freepik.com/free-photo/scada-control-room_1172-460.jpg",
    "https://img.freepik.com/free-photo/thermal-camera-inspection_1172-470.jpg",
    "https://img.freepik.com/free-photo/wind-turbine-foundation_1172-480.jpg",
    "https://img.freepik.com/free-photo/electrical-panel-wiring_1172-490.jpg",
    "https://img.freepik.com/free-photo/wind-turbine-rotor-hub_1172-500.jpg",
    "https://img.freepik.com/free-photo/industrial-bolt-tensioning_1172-510.jpg",
    "https://img.freepik.com/free-photo/wind-farm-aerial-view_1127-40.jpg",
    "https://img.freepik.com/free-photo/generator-maintenance-work_1172-520.jpg",
    "https://img.freepik.com/free-photo/wind-turbine-sunset-ocean_1127-50.jpg",
  ];

  // Download real photo from freepik CDN (with placebear fallback)
  async function downloadPhoto(index: number, width: number): Promise<Buffer> {
    const baseUrl = FREEPHOTO_URLS[index % FREEPHOTO_URLS.length];
    const url = `${baseUrl}?w=${width}`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length > 1000) return buf;
      }
    } catch { /* fallback */ }
    // Fallback: placebear
    try {
      const res = await fetch(`https://placebear.com/${width}/${Math.round(width * 0.75)}`, { signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length > 1000) return buf;
      }
    } catch { /* fallback */ }
    console.warn(`  ⚠ Could not download photo index=${index}, using fallback`);
    return createPng(width, Math.round(width * 0.75), (x, y) => {
      const t = (x + y) / (width * 1.75);
      const s = index * 37;
      return [
        Math.round((40 + (s % 80)) * (1 - t * 0.3)),
        Math.round((60 + ((s >> 4) % 60)) * (1 - t * 0.3)),
        Math.round((80 + ((s >> 8) % 60)) * (1 - t * 0.3)),
        255,
      ];
    });
  }

  console.log("  Downloading evidence photos from freepik CDN...");
  const evidenceItems: Awaited<ReturnType<typeof prisma.evidenceItem.create>>[] = [];
  for (let i = 0; i < 40; i++) {
    const uploader = pick(technicians.length ? technicians : allUsers);
    const mediaType = pick(["PHOTO", "VIDEO", "PHOTO", "PHOTO", "PDF"] as const);
    const isPhoto = mediaType === "PHOTO";
    const fileName = isPhoto ? `evidence_${i + 1}.jpg` : mediaType === "VIDEO" ? `evidence_${i + 1}.mp4` : `evidence_${i + 1}.pdf`;
    const thumbName = `thumb_evidence_${i + 1}.jpg`;

    if (isPhoto) {
      // Download real photo (640px) and thumbnail (320px) from freepik CDN
      const [photo, thumb] = await Promise.all([
        downloadPhoto(i, 640),
        downloadPhoto(i, 320),
      ]);
      writeFileSync(`uploads/${fileName}`, photo);
      writeFileSync(`uploads/${thumbName}`, thumb);
    } else {
      // VIDEO/PDF: generate a styled placeholder thumbnail
      writeFileSync(`uploads/${thumbName}`, makePlaceholderThumbnail(mediaType, i));
    }

    // Link ~60% of evidence to inspections and ~40% to components
    const linkInsp = Math.random() > 0.4 ? pick(inspectionRecords) : null;
    const turbineComps = linkInsp
      ? componentMap.filter((c) => c.turbineId === linkInsp.turbine_id)
      : [];
    const linkComp = turbineComps.length > 0 ? pick(turbineComps) : (Math.random() > 0.5 ? pick(componentMap) : null);

    evidenceItems.push(
      await prisma.evidenceItem.create({
        data: {
          media_type: mediaType,
          status: pick(["PENDING", "APPROVED", "APPROVED", "APPROVED"] as const),
          file_url: `/uploads/${fileName}`,
          thumbnail_url: `/uploads/${thumbName}`,
          file_size_bytes: 500_000 + Math.floor(Math.random() * 4_500_000),
          mime_type: isPhoto ? "image/jpeg" : mediaType === "VIDEO" ? "video/mp4" : "application/pdf",
          uploaded_by: uploader.id,
          inspection_id: linkInsp?.id ?? null,
          component_id: linkComp?.componentId ?? null,
          description: Math.random() > 0.4 ? faker.lorem.sentence() : null,
          created_at: daysAgo(1, 90),
        },
      }),
    );
  }

  // ─── Evidence Annotations (on photo evidence) ──────────────────────────
  const photoEvidence = evidenceItems.filter((e) => e.media_type === "PHOTO");
  for (let i = 0; i < Math.min(15, photoEvidence.length); i++) {
    const ev = photoEvidence[i];
    const annCount = 1 + Math.floor(Math.random() * 2);
    for (let a = 0; a < annCount; a++) {
      await prisma.evidenceAnnotation.create({
        data: {
          evidence_id: ev.id,
          author_id: pick(allUsers).id,
          annotation_type: pick(["ARROW", "CIRCLE", "TEXT"] as const),
          data: pick([
            { x: 100 + Math.random() * 200, y: 80 + Math.random() * 150, dx: 50, dy: -30 },
            { cx: 200 + Math.random() * 100, cy: 150 + Math.random() * 80, r: 30 + Math.random() * 40 },
            { x: 150 + Math.random() * 200, y: 120 + Math.random() * 100, text: faker.word.words(3) },
          ]),
        },
      });
    }
  }

  // ─── Ticket Evidence links (US-TKT-07) ─────────────────────────────────
  for (let i = 0; i < 25; i++) {
    const ticket = pick(tickets);
    const evidence = pick(evidenceItems);
    try {
      await prisma.ticketEvidence.create({
        data: {
          ticket_id: ticket.id,
          evidence_id: evidence.id,
          linked_by: pick(allUsers).id,
        },
      });
    } catch {
      // Skip duplicate links
    }
  }

  // ─── Work Order Evidence links (US-TKT-05) ─────────────────────────────
  for (let i = 0; i < 20; i++) {
    const wo = pick(workOrders);
    const evidence = pick(evidenceItems);
    try {
      await prisma.workOrderEvidence.create({
        data: {
          work_order_id: wo.id,
          evidence_id: evidence.id,
          linked_by: pick(allUsers).id,
        },
      });
    } catch {
      // Skip duplicate links
    }
  }

  // ─── Availability Slots (US-AVAIL-01/02, US-DISP-01) ───────────────────
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  for (const tech of technicians.slice(0, 20)) {
    // Create 7 days of availability slots (current week)
    for (let d = 0; d < 7; d++) {
      const dayStart = new Date(startOfWeek);
      dayStart.setDate(startOfWeek.getDate() + d);
      dayStart.setHours(8, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(17, 0, 0, 0);

      if (Math.random() > 0.15) { // 85% chance of being available each day
        await prisma.availabilitySlot.create({
          data: {
            user_id: tech.id,
            status: pick(["AVAILABLE", "ASSIGNED", "ON_SITE", "AVAILABLE"] as TechnicianStatus[]),
            start_time: dayStart,
            end_time: dayEnd,
            site_id: Math.random() > 0.5 ? pick(siteRecords).id : null,
            notes: Math.random() > 0.8 ? faker.lorem.sentence() : null,
          },
        });
      }
    }
  }

  // ─── Absence Records (US-AVAIL-03/04/05, US-REPL-01/02/03) ────────────
  const absenceRecords: Awaited<ReturnType<typeof prisma.absenceRecord.create>>[] = [];
  const absenceReasons = ["SICK", "PERSONAL_LEAVE", "TRAINING", "VACATION", "OTHER"] as const;
  // Create 8 absence records: 3 past (approved), 3 current (active), 2 future
  const absentTechs = technicians.slice(0, 8);

  // Past absences (approved, returned)
  for (let i = 0; i < 3; i++) {
    const startDate = daysAgo(14 + i * 7, 20 + i * 7);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 2 + Math.floor(Math.random() * 3));
    absenceRecords.push(
      await prisma.absenceRecord.create({
        data: {
          user_id: absentTechs[i].id,
          reason: pick(absenceReasons),
          start_date: startDate,
          expected_return_date: endDate,
          actual_return_date: new Date(endDate.getTime() + Math.random() * 86400000),
          is_approved: true,
          approved_by: managers[0]?.id ?? devOps.id,
          notes: faker.lorem.sentence(),
        },
      }),
    );
  }

  // Current absences (active — user is currently absent)
  for (let i = 3; i < 6; i++) {
    const startDate = daysAgo(1, 3);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 3 + Math.floor(Math.random() * 5));
    absenceRecords.push(
      await prisma.absenceRecord.create({
        data: {
          user_id: absentTechs[i].id,
          reason: pick(absenceReasons),
          start_date: startDate,
          expected_return_date: endDate,
          is_approved: Math.random() > 0.3,
          approved_by: Math.random() > 0.3 ? (managers[0]?.id ?? devOps.id) : null,
          notes: faker.lorem.sentence(),
        },
      }),
    );
    // Set the absent tech's status
    await prisma.user.update({
      where: { id: absentTechs[i].id },
      data: { status: pick(["SICK", "LEAVE", "UNAVAILABLE"] as TechnicianStatus[]) },
    });
  }

  // Future absences (planned)
  for (let i = 6; i < 8; i++) {
    const startDate = daysFromNow(3 + (i - 6) * 5, 7 + (i - 6) * 5);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 5 + Math.floor(Math.random() * 5));
    absenceRecords.push(
      await prisma.absenceRecord.create({
        data: {
          user_id: absentTechs[i].id,
          reason: pick(["VACATION", "TRAINING"] as const),
          start_date: startDate,
          expected_return_date: endDate,
          is_approved: Math.random() > 0.5,
          approved_by: Math.random() > 0.5 ? (managers[0]?.id ?? devOps.id) : null,
          notes: faker.lorem.sentence(),
        },
      }),
    );
  }

  // ─── Replacement Suggestions (US-REPL-01/02/03) ────────────────────────
  for (const absence of absenceRecords.slice(3, 6)) { // for current absences
    // Find assignments for the absent tech
    const techAssignments = await prisma.assignment.findMany({
      where: { user_id: absence.user_id, accepted_at: { not: null }, declined_at: null },
    });

    // Suggest 3 candidates per absence
    const candidates = technicians.filter((t) => t.id !== absence.user_id).slice(0, 3);
    for (const candidate of candidates) {
      const skillMatch = 0.5 + Math.random() * 0.5;
      const certMatch = 0.4 + Math.random() * 0.6;
      const proximity = 0.3 + Math.random() * 0.7;
      const workload = 0.6 + Math.random() * 0.4;
      const familiarity = 0.5 + Math.random() * 0.5;
      const total = (skillMatch * 0.3 + certMatch * 0.25 + proximity * 0.2 + workload * 0.15 + familiarity * 0.1);

      await prisma.replacementSuggestion.create({
        data: {
          absence_record_id: absence.id,
          suggested_user_id: candidate.id,
          skill_match_score: skillMatch,
          cert_match_score: certMatch,
          proximity_score: proximity,
          workload_score: workload,
          familiarity_score: familiarity,
          total_score: total,
          is_above_threshold: total >= 0.6,
        },
      });
    }
  }

  // ─── Assignments (US-DISP-03, US-REPL-04, US-MOB-01) ──────────────────
  // Create assignments for inspections
  for (const insp of inspectionRecords.slice(0, 30)) {
    const assigner = pick(dispatchers.length ? dispatchers : allUsers);
    const accepted = insp.status !== "ASSIGNED";
    await prisma.assignment.create({
      data: {
        user_id: insp.technician_id,
        inspection_id: insp.id,
        status: "ASSIGNED",
        assigned_by: assigner.id,
        assigned_at: insp.created_at,
        accepted_at: accepted ? new Date(insp.created_at.getTime() + 3600000) : null,
      },
    });
  }

  // Create assignments for work orders
  for (const wo of workOrders.filter((w) => w.assignee_id).slice(0, 25)) {
    const assigner = pick(dispatchers.length ? dispatchers : allUsers);
    const accepted = wo.status !== "NEW";
    await prisma.assignment.create({
      data: {
        user_id: wo.assignee_id!,
        work_order_id: wo.id,
        status: "ASSIGNED",
        assigned_by: assigner.id,
        assigned_at: wo.created_at,
        accepted_at: accepted ? new Date(wo.created_at.getTime() + 7200000) : null,
      },
    });
  }

  // ─── Sync Events (US-OFF-03/05, US-DASH-05) ───────────────────────────
  const syncStatuses = ["SYNCED", "SYNCED", "SYNCED", "SYNCED", "PENDING", "FAILED", "CONFLICT"] as const;
  const entityTypes = ["INSPECTION", "TICKET", "WORK_ORDER", "EVIDENCE"] as const;
  for (let i = 0; i < 50; i++) {
    const tech = pick(technicians.length ? technicians : allUsers);
    const entityType = pick(entityTypes);
    let entityId: string;
    switch (entityType) {
      case "INSPECTION": entityId = pick(inspectionRecords).id; break;
      case "TICKET": entityId = pick(tickets).id; break;
      case "WORK_ORDER": entityId = pick(workOrders).id; break;
      default: entityId = pick(evidenceItems).id;
    }
    const syncStatus = pick(syncStatuses);

    await prisma.syncEvent.create({
      data: {
        user_id: tech.id,
        entity_type: entityType,
        entity_id: entityId,
        sync_status: syncStatus as any,
        conflict_data: syncStatus === "CONFLICT"
          ? { field: "status", clientValue: "IN_PROGRESS", serverValue: "SUBMITTED" }
          : null,
        error_message: syncStatus === "FAILED" ? pick(["Network timeout", "Server error 500", "Connection refused", "Auth token expired"]) : null,
        retry_count: syncStatus === "FAILED" ? 1 + Math.floor(Math.random() * 3) : syncStatus === "PENDING" ? 0 : 0,
        synced_at: syncStatus === "SYNCED" ? daysAgo(0, 5) : null,
        created_at: daysAgo(0, 10),
      },
    });
  }

  // ─── Audit Events (120) — including evidence, absence, sync events ──────
  const auditActions = ["CREATE", "UPDATE", "STATUS_CHANGE", "ASSIGN", "APPROVE", "REJECT", "DELETE"] as const;
  const auditEntityTypes = ["TICKET", "WORK_ORDER", "INSPECTION", "EVIDENCE", "ABSENCE", "SYNC"] as const;

  for (let i = 0; i < 120; i++) {
    const entityType = pick(auditEntityTypes);
    let entityId: string;
    switch (entityType) {
      case "TICKET": entityId = pick(tickets).id; break;
      case "WORK_ORDER": entityId = pick(workOrders).id; break;
      case "INSPECTION": entityId = pick(inspectionRecords).id; break;
      case "EVIDENCE": entityId = pick(evidenceItems).id; break;
      case "ABSENCE": entityId = absenceRecords.length > 0 ? pick(absenceRecords).id : pick(allUsers).id; break;
      default: entityId = pick(allUsers).id;
    }

    await prisma.auditEvent.create({
      data: {
        entity_type: entityType,
        entity_id: entityId,
        action: pick(auditActions),
        user_id: pick(allUsers).id,
        before_state: { status: pick(TICKET_STATUSES) },
        after_state: { status: pick(TICKET_STATUSES) },
        created_at: daysAgo(1, 180),
      },
    });
  }

  // ─── Summary ────────────────────────────────────────────────────────────
  console.log("Seed completed successfully!");
  console.log(`  Organizations: 3 + 1 dev`);
  console.log(`  Sites: ${siteRecords.length}`);
  console.log(`  Turbines: ${turbines.length}`);
  console.log(`  Components: ${componentMap.length}`);
  console.log(`  Users: ${allUsers.length} + 5 dev accounts`);
  console.log(`  Dev logins: admin/tech/dispatcher/qa/ops @cmms.test — password: ${PASSWORD}`);
  console.log(`  Staff logins: technician1..N / dispatcher1..N / qareviewer1..N @cmms.test — password: ${PASSWORD}`);
  console.log(`  Skills: ${skills.length}, Certifications: ${certs.length}`);
  console.log(`  Inspection templates: ${templates.length} (${templateVersions.length} versions)`);
  console.log(`  Inspections: ${inspectionRecords.length} (with field data + defects)`);
  console.log(`  Defects: ${defects.length}`);
  console.log(`  Tickets: ${tickets.length} (${tickets.filter((t) => (t as any).defect_id).length} from defects)`);
  console.log(`  Work orders: ${workOrders.length}`);
  console.log(`  Evidence items: ${evidenceItems.length} (linked to inspections/components)`);
  console.log(`  Ticket-Evidence links: ~25`);
  console.log(`  WorkOrder-Evidence links: ~20`);
  console.log(`  Availability slots: ~140`);
  console.log(`  Absence records: ${absenceRecords.length}`);
  console.log(`  Replacement suggestions: ~9`);
  console.log(`  Assignments: ~55`);
  console.log(`  Sync events: 50`);
  console.log(`  Audit events: 120`);
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
