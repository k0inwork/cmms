import { PrismaClient, Role, type TechnicianStatus } from "@prisma/client";
import bcryptjs from "bcryptjs";
import { faker } from "@faker-js/faker";
import { mkdirSync, writeFileSync } from "fs";

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
      email: "admin@cmms.test",
      password_hash: passwordHash,
      first_name: "Admin",
      last_name: "User",
      role: Role.ADMINISTRATOR,
      status: "AVAILABLE",
      organization_id: devOrg.id,
    },
  });
  const devTech = await prisma.user.create({
    data: {
      email: "tech@cmms.test",
      password_hash: passwordHash,
      first_name: "Tech",
      last_name: "User",
      role: Role.TECHNICIAN,
      status: "AVAILABLE",
      organization_id: devOrg.id,
    },
  });
  const devDispatcher = await prisma.user.create({
    data: {
      email: "dispatcher@cmms.test",
      password_hash: passwordHash,
      first_name: "Dispatcher",
      last_name: "User",
      role: Role.DISPATCHER,
      status: "AVAILABLE",
      organization_id: devOrg.id,
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
          latitude: s.lat + faker.location.latitude({ min: -0.02, max: 0.02 }) * 0,
          longitude: s.lon + faker.location.longitude({ min: -0.02, max: 0.02 }) * 0,
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

  // ─── Users (50+) ────────────────────────────────────────────────────────
  const allUsers: Awaited<ReturnType<typeof prisma.user.create>>[] = [];

  // Create users for org1 (majority)
  for (let i = 0; i < 35; i++) {
    const role = i < ROLES.length ? ROLES[i] : pick([Role.TECHNICIAN, Role.TECHNICIAN, Role.TECHNICIAN, Role.DISPATCHER]);
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const orgId = i < 25 ? org1.id : i < 30 ? org2.id : org3.id;
    allUsers.push(
      await prisma.user.create({
        data: {
          email: faker.internet.email({ firstName, lastName }).toLowerCase(),
          password_hash: passwordHash,
          first_name: firstName,
          last_name: lastName,
          role,
          status: pick(["AVAILABLE", "ASSIGNED", "AVAILABLE", "AVAILABLE", "ON_SITE"] as TechnicianStatus[]),
          organization_id: orgId,
        },
      }),
    );
  }

  // Extra org2 and org3 users
  for (let i = 0; i < 20; i++) {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const orgId = i < 12 ? org2.id : org3.id;
    allUsers.push(
      await prisma.user.create({
        data: {
          email: faker.internet.email({ firstName, lastName }).toLowerCase(),
          password_hash: passwordHash,
          first_name: firstName,
          last_name: lastName,
          role: i < 8 ? Role.TECHNICIAN : i < 12 ? Role.DISPATCHER : pick([Role.TECHNICIAN, Role.QA_REVIEWER]),
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
          user_id: tech.id,
          skill_id: skill.id,
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
          user_id: user.id,
          certification_id: cert.id,
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
    const count = 10 + Math.floor(Math.random() * 5); // 10-14 per site
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
  for (const turbine of turbines) {
    const subs = await Promise.all(
      SUBSYSTEM_DEFS.map((sd) =>
        prisma.subsystem.create({ data: { turbine_id: turbine.id, name: sd.name, type: sd.type } }),
      ),
    );
    for (const sub of subs) {
      const sd = SUBSYSTEM_DEFS.find((s) => s.name === sub.name)!;
      const compNames = COMPONENT_DEFS[sd.type] ?? [];
      await Promise.all(
        compNames.map((cn) =>
          prisma.component.create({
            data: { subsystem_id: sub.id, name: cn, status: Math.random() > 0.05 ? "ACTIVE" : "MAINTENANCE" },
          }),
        ),
      );
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

  const templateVersions = await Promise.all(
    templates.map((t, i) =>
      prisma.inspectionTemplateVersion.create({
        data: {
          template_id: t.id,
          version: 1,
          schema: { fields: [{ key: `field_${i}_1`, label: "Condition", type: "PASS_FAIL" }] },
          changelog: "Initial version",
          created_by: managers[0]?.id ?? allUsers[0].id,
        },
      }),
    ),
  );

  // ─── Tickets (120) ──────────────────────────────────────────────────────
  const tickets: Awaited<ReturnType<typeof prisma.ticket.create>>[] = [];
  for (let i = 0; i < 120; i++) {
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
          due_date: Math.random() > 0.3 ? daysAgo(-5, 30) : null,
          sla_target_date: Math.random() > 0.4 ? daysAgo(-3, 15) : null,
          closed_at: status === "CLOSED" ? daysAgo(1, 30) : null,
          created_at: daysAgo(1, 180),
        },
      }),
    );
  }

  // ─── Work Orders (80) ───────────────────────────────────────────────────
  const workOrders: Awaited<ReturnType<typeof prisma.workOrder.create>>[] = [];
  for (let i = 0; i < 80; i++) {
    const ticket = pick(tickets);
    const turbine = pick(turbines);
    const creator = pick(dispatchers.length ? dispatchers : allUsers);
    const assignee = Math.random() > 0.25 && technicians.length ? pick(technicians) : null;
    const status = pick(["NEW", "ASSIGNED", "IN_PROGRESS", "PENDING_REVIEW", "CLOSED"] as const);
    const priority = pick(PRIORITIES);

    workOrders.push(
      await prisma.workOrder.create({
        data: {
          ticket_id: ticket.id,
          turbine_id: turbine.id,
          title: `WO: ${ticket.title}`,
          description: `Remediation work for ticket ${ticket.id.slice(0, 8)}`,
          priority,
          status,
          created_by: creator.id,
          assignee_id: assignee?.id ?? null,
          due_date: Math.random() > 0.3 ? daysAgo(-3, 21) : null,
          started_at: ["IN_PROGRESS", "PENDING_REVIEW", "CLOSED"].includes(status) ? daysAgo(1, 14) : null,
          completed_at: status === "CLOSED" ? daysAgo(1, 7) : null,
          resolution_notes: status === "CLOSED" ? "Issue resolved. Components replaced and tested." : null,
          created_at: daysAgo(1, 120),
        },
      }),
    );
  }

  // ─── Inspections (60) ───────────────────────────────────────────────────
  const inspectionStatuses = ["ASSIGNED", "IN_PROGRESS", "SUBMITTED", "APPROVED", "REJECTED", "CHANGES_REQUESTED"] as const;
  for (let i = 0; i < 60; i++) {
    const turbine = pick(turbines);
    const tech = pick(technicians.length ? technicians : allUsers);
    const tv = pick(templateVersions);
    const status = pick(inspectionStatuses);
    const createdAt = daysAgo(1, 120);

    await prisma.inspectionRecord.create({
      data: {
        template_version_id: tv.id,
        technician_id: tech.id,
        turbine_id: turbine.id,
        status,
        started_at: status !== "ASSIGNED" ? createdAt : null,
        completed_at: ["SUBMITTED", "APPROVED", "REJECTED"].includes(status) ? daysAgo(1, 30) : null,
        submitted_at: ["SUBMITTED", "APPROVED", "REJECTED"].includes(status) ? daysAgo(1, 28) : null,
        reviewed_by: ["APPROVED", "REJECTED"].includes(status) && reviewers.length ? pick(reviewers).id : null,
        reviewed_at: ["APPROVED", "REJECTED"].includes(status) ? daysAgo(1, 25) : null,
        review_notes: Math.random() > 0.5 ? faker.lorem.sentence() : null,
        due_date: daysAgo(-5, 30),
        created_at: createdAt,
      },
    });
  }

  // ─── Evidence Items (40) ────────────────────────────────────────────────
  mkdirSync("uploads", { recursive: true });

  // Minimal PNG encoder — creates an uncompressed RGBA PNG
  function createPng(width: number, height: number, rgba: (x: number, y: number) => [number, number, number, number]): Buffer {
    const { deflateSync } = require("zlib");

    // Build raw image data: filter byte (0) + RGBA pixels per row
    const rawRows: Buffer[] = [];
    for (let y = 0; y < height; y++) {
      const row = Buffer.alloc(1 + width * 4); // filter byte + RGBA
      row[0] = 0; // no filter
      for (let x = 0; x < width; x++) {
        const [r, g, b, a] = rgba(x, y);
        const off = 1 + x * 4;
        row[off] = r; row[off + 1] = g; row[off + 2] = b; row[off + 3] = a;
      }
      rawRows.push(row);
    }
    const raw = Buffer.concat(rawRows);
    const compressed = deflateSync(raw);

    // PNG signature
    const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

    function chunk(type: string, data: Buffer): Buffer {
      const len = Buffer.alloc(4);
      len.writeUInt32BE(data.length);
      const typeB = Buffer.from(type);
      const crcData = Buffer.concat([typeB, data]);
      const crc = Buffer.alloc(4);
      crc.writeUInt32BE(require("zlib").crc32(crcData) >>> 0);
      return Buffer.concat([len, typeB, data, crc]);
    }

    // IHDR
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8;  // bit depth
    ihdr[9] = 6;  // color type: RGBA
    ihdr[10] = 0; // compression
    ihdr[11] = 0; // filter
    ihdr[12] = 0; // interlace

    return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", compressed), chunk("IEND", Buffer.alloc(0))]);
  }

  function generatePhoto(index: number): Buffer {
    // Colored gradient photo placeholder
    const colors: [number, number, number][] = [
      [41, 128, 185], [39, 174, 96], [192, 57, 43], [142, 68, 173],
      [243, 156, 18], [22, 160, 133], [44, 62, 80], [211, 84, 0],
    ];
    const [br, bg, bb] = colors[index % colors.length];
    return createPng(640, 480, (x, y) => {
      const t = (x + y) / (640 + 480);
      return [
        Math.round(br * (1 - t * 0.3)),
        Math.round(bg * (1 - t * 0.3)),
        Math.round(bb * (1 - t * 0.3)),
        255,
      ];
    });
  }

  function generateThumbnail(mediaType: string, index: number): Buffer {
    // Colored thumbnail with type badge
    const colors: [number, number, number][] = [
      [52, 152, 219], [46, 204, 113], [231, 76, 60], [155, 89, 182],
      [241, 196, 15], [26, 188, 156], [52, 73, 94], [230, 126, 34],
    ];
    const [br, bg, bb] = colors[index % colors.length];
    const w = 320, h = 180;

    // Badge position (centered)
    const bx1 = Math.floor(w * 0.35), bx2 = Math.floor(w * 0.65);
    const by1 = Math.floor(h * 0.38), by2 = Math.floor(h * 0.62);

    return createPng(w, h, (x, y) => {
      // Gradient background
      const t = (x + y) / (w + h);
      let r = Math.round(br * (1 - t * 0.4));
      let g = Math.round(bg * (1 - t * 0.4));
      let b = Math.round(bb * (1 - t * 0.4));

      // White rounded badge in center
      const cx = (bx1 + bx2) / 2, cy = (by1 + by2) / 2;
      const rw = (bx2 - bx1) / 2, rh = (by2 - by1) / 2;
      const dx = (x - cx) / rw, dy = (y - cy) / rh;
      if (dx * dx + dy * dy <= 1) {
        // Inside ellipse: white with slight transparency
        const alpha = dx * dx + dy * dy;
        if (alpha > 0.85) {
          // border ring
          return [255, 255, 255, 230];
        }
        return [255, 255, 255, 200];
      }

      return [r, g, b, 255];
    });
  }

  for (let i = 0; i < 40; i++) {
    const uploader = pick(allUsers);
    const mediaType = pick(["PHOTO", "VIDEO", "PHOTO", "PHOTO", "PDF"] as const);
    const isPhoto = mediaType === "PHOTO";
    const fileName = isPhoto ? `evidence_${i + 1}.png` : mediaType === "VIDEO" ? `evidence_${i + 1}.mp4` : `evidence_${i + 1}.pdf`;
    const thumbName = `thumb_evidence_${i + 1}.png`;

    // Write actual placeholder files
    if (isPhoto) {
      writeFileSync(`uploads/${fileName}`, generatePhoto(i));
    }
    writeFileSync(`uploads/${thumbName}`, generateThumbnail(mediaType, i));

    await prisma.evidenceItem.create({
      data: {
        media_type: mediaType,
        status: pick(["PENDING", "APPROVED", "APPROVED", "APPROVED"] as const),
        file_url: `/uploads/${fileName}`,
        thumbnail_url: `/uploads/${thumbName}`,
        file_size_bytes: 500_000 + Math.floor(Math.random() * 4_500_000),
        mime_type: isPhoto ? "image/png" : mediaType === "VIDEO" ? "video/mp4" : "application/pdf",
        uploaded_by: uploader.id,
        description: Math.random() > 0.4 ? faker.lorem.sentence() : null,
        created_at: daysAgo(1, 90),
      },
    });
  }

  // ─── Audit Events (100) ────────────────────────────────────────────────
  const auditActions = ["CREATE", "UPDATE", "STATUS_CHANGE", "ASSIGN", "DELETE"] as const;
  for (let i = 0; i < 100; i++) {
    const entityType = pick(["TICKET", "WORK_ORDER", "INSPECTION"] as const);
    const entityId = entityType === "TICKET"
      ? pick(tickets).id
      : entityType === "WORK_ORDER"
        ? pick(workOrders).id
        : pick(allUsers).id;

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
  console.log(`  Organizations: 3`);
  console.log(`  Sites: ${siteRecords.length}`);
  console.log(`  Turbines: ${turbines.length}`);
  console.log(`  Users: ${allUsers.length}`);
  console.log(`  Skills: ${skills.length}, Certifications: ${certs.length}`);
  console.log(`  Inspection templates: ${templates.length}`);
  console.log(`  Tickets: ${tickets.length}`);
  console.log(`  Work orders: ${workOrders.length}`);
  console.log(`  Inspections: 60`);
  console.log(`  Evidence items: 40`);
  console.log(`  Audit events: 100`);
  console.log(`  All user passwords: ${PASSWORD}`);
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
