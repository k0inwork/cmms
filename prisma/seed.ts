import { PrismaClient, Role, type TechnicianStatus } from "@prisma/client";
import bcryptjs from "bcryptjs";
const { hash } = bcryptjs;

const prisma = new PrismaClient();

const PASSWORD = "Password123!";

async function main() {
  console.log("Seeding database...");

  // ─── Organizations ──────────────────────────────────────────────────────
  const org1 = await prisma.organization.create({
    data: {
      name: "WindTech Energy GmbH",
      description: "Wind turbine operations and maintenance company",
    },
  });

  const org2 = await prisma.organization.create({
    data: {
      name: "Nordic Wind AS",
      description: "Scandinavian wind farm operator",
    },
  });

  // ─── Sites ──────────────────────────────────────────────────────────────
  const site1 = await prisma.site.create({
    data: {
      organization_id: org1.id,
      name: "North Sea Wind Farm Alpha",
      latitude: 54.23,
      longitude: 7.45,
      time_zone: "Europe/Berlin",
    },
  });

  const site2 = await prisma.site.create({
    data: {
      organization_id: org1.id,
      name: "Baltic Coast Site Beta",
      latitude: 54.69,
      longitude: 10.87,
      time_zone: "Europe/Berlin",
    },
  });

  const site3 = await prisma.site.create({
    data: {
      organization_id: org2.id,
      name: "Fjord Wind Park Gamma",
      latitude: 62.47,
      longitude: 6.15,
      time_zone: "Europe/Oslo",
    },
  });

  // ─── Skills ─────────────────────────────────────────────────────────────
  const skillBlade = await prisma.skill.create({
    data: { name: "Blade Repair", category: "Structural", description: "Rotor blade inspection and repair" },
  });
  const skillElectrical = await prisma.skill.create({
    data: { name: "Electrical Systems", category: "Electrical", description: "HV/LV electrical systems maintenance" },
  });
  const skillHydraulic = await prisma.skill.create({
    data: { name: "Hydraulic Systems", category: "Mechanical", description: "Hydraulic pitch and yaw systems" },
  });
  const skillSCADA = await prisma.skill.create({
    data: { name: "SCADA Systems", category: "Control", description: "SCADA monitoring and diagnostics" },
  });
  const skillSafety = await prisma.skill.create({
    data: { name: "Working at Heights", category: "Safety", description: "Certified for tower climb and nacelle work" },
  });

  // ─── Certifications ─────────────────────────────────────────────────────
  const certGWO = await prisma.certification.create({
    data: { name: "GWO Basic Safety", issuing_body: "Global Wind Organisation", validity_months: 24 },
  });
  const certElectrical = await prisma.certification.create({
    data: { name: "HV Electrical Authorization", issuing_body: "TÜV Rheinland", validity_months: 36 },
  });
  const certBlade = await prisma.certification.create({
    data: { name: "Blade Repair Specialist", issuing_body: "WindTree Institute", validity_months: 24 },
  });
  const certFirstAid = await prisma.certification.create({
    data: { name: "Advanced First Aid", issuing_body: "Red Cross", validity_months: 12 },
  });

  // ─── Users (one per role) ──────────────────────────────────────────────
  const passwordHash = await hash(PASSWORD, 10);

  const users = await Promise.all([
    prisma.user.create({
      data: {
        email: "admin@windtech.de",
        password_hash: passwordHash,
        first_name: "Anna",
        last_name: "Müller",
        role: Role.ADMINISTRATOR,
        status: "AVAILABLE" as TechnicianStatus,
        organization_id: org1.id,
      },
    }),
    prisma.user.create({
      data: {
        email: "ops@windtech.de",
        password_hash: passwordHash,
        first_name: "Max",
        last_name: "Schmidt",
        role: Role.OPERATIONS_MANAGER,
        status: "AVAILABLE" as TechnicianStatus,
        organization_id: org1.id,
      },
    }),
    prisma.user.create({
      data: {
        email: "dispatcher@windtech.de",
        password_hash: passwordHash,
        first_name: "Lisa",
        last_name: "Weber",
        role: Role.DISPATCHER,
        status: "AVAILABLE" as TechnicianStatus,
        organization_id: org1.id,
      },
    }),
    prisma.user.create({
      data: {
        email: "tech@windtech.de",
        password_hash: passwordHash,
        first_name: "Tom",
        last_name: "Fischer",
        role: Role.TECHNICIAN,
        status: "AVAILABLE" as TechnicianStatus,
        organization_id: org1.id,
      },
    }),
    prisma.user.create({
      data: {
        email: "qa@windtech.de",
        password_hash: passwordHash,
        first_name: "Sarah",
        last_name: "Braun",
        role: Role.QA_REVIEWER,
        status: "AVAILABLE" as TechnicianStatus,
        organization_id: org1.id,
      },
    }),
  ]);

  const [admin, ops, dispatcher, tech, qa] = users;

  // ─── User Skills ────────────────────────────────────────────────────────
  await Promise.all([
    prisma.userSkill.create({ data: { user_id: tech.id, skill_id: skillBlade.id, proficiency_level: 4, acquired_date: new Date("2023-01-15") } }),
    prisma.userSkill.create({ data: { user_id: tech.id, skill_id: skillElectrical.id, proficiency_level: 3, acquired_date: new Date("2022-06-01") } }),
    prisma.userSkill.create({ data: { user_id: tech.id, skill_id: skillHydraulic.id, proficiency_level: 3, acquired_date: new Date("2023-03-20") } }),
    prisma.userSkill.create({ data: { user_id: tech.id, skill_id: skillSafety.id, proficiency_level: 5, acquired_date: new Date("2021-09-01") } }),
    prisma.userSkill.create({ data: { user_id: qa.id, skill_id: skillSCADA.id, proficiency_level: 4, acquired_date: new Date("2022-01-10") } }),
    prisma.userSkill.create({ data: { user_id: qa.id, skill_id: skillElectrical.id, proficiency_level: 3, acquired_date: new Date("2022-06-15") } }),
  ]);

  // ─── User Certifications ────────────────────────────────────────────────
  await Promise.all([
    prisma.userCertification.create({ data: { user_id: tech.id, certification_id: certGWO.id, issued_date: new Date("2024-01-01"), expiry_date: new Date("2025-12-31") } }),
    prisma.userCertification.create({ data: { user_id: tech.id, certification_id: certBlade.id, issued_date: new Date("2024-03-01"), expiry_date: new Date("2026-02-28") } }),
    prisma.userCertification.create({ data: { user_id: qa.id, certification_id: certGWO.id, issued_date: new Date("2024-01-01"), expiry_date: new Date("2025-12-31") } }),
    prisma.userCertification.create({ data: { user_id: qa.id, certification_id: certElectrical.id, issued_date: new Date("2023-06-01"), expiry_date: new Date("2026-05-31") } }),
    prisma.userCertification.create({ data: { user_id: ops.id, certification_id: certFirstAid.id, issued_date: new Date("2024-06-01"), expiry_date: new Date("2025-05-31") } }),
  ]);

  // ─── Turbines ───────────────────────────────────────────────────────────
  const turbine1 = await prisma.turbine.create({
    data: { site_id: site1.id, name: "WTG-A01", model: "Vestas V164-9.5 MW", latitude: 54.231, longitude: 7.452 },
  });
  const turbine2 = await prisma.turbine.create({
    data: { site_id: site1.id, name: "WTG-A02", model: "Vestas V164-9.5 MW", latitude: 54.233, longitude: 7.455 },
  });
  const turbine3 = await prisma.turbine.create({
    data: { site_id: site1.id, name: "WTG-A03", model: "Siemens SG 14-222 DD", latitude: 54.235, longitude: 7.458 },
  });
  const turbine4 = await prisma.turbine.create({
    data: { site_id: site2.id, name: "WTG-B01", model: "Vestas V164-9.5 MW", latitude: 54.692, longitude: 10.873 },
  });
  const turbine5 = await prisma.turbine.create({
    data: { site_id: site3.id, name: "WTG-G01", model: "Siemens SG 14-222 DD", latitude: 62.472, longitude: 6.153 },
  });

  // ─── Subsystems ─────────────────────────────────────────────────────────
  const createSubsystems = async (turbineId: string) => {
    const [rotor, nacelle, tower, electrical] = await Promise.all([
      prisma.subsystem.create({ data: { turbine_id: turbineId, name: "Rotor System", type: "ROTOR" } }),
      prisma.subsystem.create({ data: { turbine_id: turbineId, name: "Nacelle", type: "NACELLE" } }),
      prisma.subsystem.create({ data: { turbine_id: turbineId, name: "Tower", type: "TOWER" } }),
      prisma.subsystem.create({ data: { turbine_id: turbineId, name: "Electrical System", type: "ELECTRICAL" } }),
    ]);
    return { rotor, nacelle, tower, electrical };
  };

  const sub1 = await createSubsystems(turbine1.id);
  const sub2 = await createSubsystems(turbine2.id);
  const sub3 = await createSubsystems(turbine3.id);
  const sub4 = await createSubsystems(turbine4.id);
  const sub5 = await createSubsystems(turbine5.id);

  // ─── Components ─────────────────────────────────────────────────────────
  const createComponents = async (subsystems: Awaited<ReturnType<typeof createSubsystems>>) => {
    await Promise.all([
      // Rotor subsystem
      prisma.component.create({ data: { subsystem_id: subsystems.rotor.id, name: "Blade A (top)" } }),
      prisma.component.create({ data: { subsystem_id: subsystems.rotor.id, name: "Blade B (120°)" } }),
      prisma.component.create({ data: { subsystem_id: subsystems.rotor.id, name: "Blade C (240°)" } }),
      prisma.component.create({ data: { subsystem_id: subsystems.rotor.id, name: "Hub" } }),
      prisma.component.create({ data: { subsystem_id: subsystems.rotor.id, name: "Pitch Bearing" } }),
      // Nacelle subsystem
      prisma.component.create({ data: { subsystem_id: subsystems.nacelle.id, name: "Main Bearing" } }),
      prisma.component.create({ data: { subsystem_id: subsystems.nacelle.id, name: "Gearbox" } }),
      prisma.component.create({ data: { subsystem_id: subsystems.nacelle.id, name: "Generator" } }),
      prisma.component.create({ data: { subsystem_id: subsystems.nacelle.id, name: "Yaw System" } }),
      prisma.component.create({ data: { subsystem_id: subsystems.nacelle.id, name: "Cooling System" } }),
      // Tower subsystem
      prisma.component.create({ data: { subsystem_id: subsystems.tower.id, name: "Foundation Bolts" } }),
      prisma.component.create({ data: { subsystem_id: subsystems.tower.id, name: "Tower Section 1 (bottom)" } }),
      prisma.component.create({ data: { subsystem_id: subsystems.tower.id, name: "Tower Section 2 (mid)" } }),
      prisma.component.create({ data: { subsystem_id: subsystems.tower.id, name: "Tower Section 3 (top)" } }),
      // Electrical subsystem
      prisma.component.create({ data: { subsystem_id: subsystems.electrical.id, name: "Transformer" } }),
      prisma.component.create({ data: { subsystem_id: subsystems.electrical.id, name: "Converter" } }),
      prisma.component.create({ data: { subsystem_id: subsystems.electrical.id, name: "Cable Tray" } }),
      prisma.component.create({ data: { subsystem_id: subsystems.electrical.id, name: "Switchgear" } }),
    ]);
  };

  await Promise.all([createComponents(sub1), createComponents(sub2), createComponents(sub3), createComponents(sub4), createComponents(sub5)]);

  console.log("Seed completed successfully!");
  console.log(`  Organizations: 2`);
  console.log(`  Sites: 3`);
  console.log(`  Turbines: 5`);
  console.log(`  Subsystems: 20`);
  console.log(`  Components: ~90`);
  console.log(`  Users: 5 (one per role)`);
  console.log(`  Skills: 5, Certifications: 4`);
  console.log(`  All user passwords: ${PASSWORD}`);
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
