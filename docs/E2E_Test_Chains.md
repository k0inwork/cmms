# E2E Multi-Role Test Chains

Five long end-to-end workflow chains that span multiple user stories and roles. Each chain simulates realistic operational scenarios for browser-based automation testing.

---

## Chain 1: Full Inspection-to-Resolution Pipeline

**Bead:** cmms-xw2
**Roles involved:** Dispatcher, Technician, QA Reviewer
**User stories:** 17 stories across the full defect lifecycle

### Flow

```
Dispatcher          Technician          QA Reviewer
    │                    │                    │
    │ US-DISP-03         │                    │
    │ Assign inspection ─┤                    │
    │ to tech            │                    │
    │                    │ US-OFF-02          │
    │                    │ Preload data       │
    │                    │                    │
    │                    │ US-MOB-02          │
    │                    │ Start inspection   │
    │                    │                    │
    │                    │ US-OFF-01          │
    │                    │ Work offline       │
    │                    │                    │
    │                    │ US-EVID-01         │
    │                    │ Capture photos     │
    │                    │                    │
    │                    │ US-INS-04          │
    │                    │ Submit inspection  │
    │                    │ (queued offline)   │
    │                    │                    │
    │                    │ US-OFF-05          │
    │                    │ Idempotent - no    │
    │                    │ duplicates         │
    │                    │                    │
    │                    │ US-OFF-03          │
    │                    │ Auto-sync when     │
    │                    │ back online        │
    │                    │                    │
    │                    │ US-QA-01           │
    │                    ├───────────────────→│ Review inspection
    │                    │                    │
    │                    │  US-QA-02          │
    │                    │←───────────────────┤ Flag evidence
    │                    │                    │
    │                    │ US-MOB-03          │
    │                    │ Re-inspect,        │
    │                    │ resubmit           │
    │                    │                    │
    │                    │ US-QA-01           │
    │                    ├───────────────────→│ Approve inspection
    │                    │                    │ US-TKT-01
    │                    │                    │ Create ticket from defect
    │                    │                    │
    │ US-TKT-08          │                    │
    │ Create work order ─┤                    │
    │ from ticket        │                    │
    │                    │                    │
    │ US-TKT-03          │                    │
    │ Assign ticket ────→│                    │
    │                    │ US-TKT-05          │
    │                    │ Add resolution     │
    │                    │ notes, complete    │
    │                    │                    │
    │                    │                    │ US-QA-03
    │                    │                    │ Approve closure
    │                    │                    │ Ticket CLOSED
```

### Step-by-step

1. **Dispatcher** logs in, opens dispatch board, assigns a pending inspection to a technician (US-DISP-03)
2. **Technician** opens mobile home, sees new assignment, taps "Preload" to cache inspection + asset data locally (US-OFF-02)
3. **Technician** taps "Start Inspection" — form loads from cached template, start time recorded (US-MOB-02)
4. **Technician** goes offline (simulate network loss) — offline indicator appears, all form entry continues working (US-OFF-01)
5. **Technician** captures 3 photos of blade damage via camera button, tagged with asset/inspection/timestamp (US-EVID-01)
6. **Technician** fills form fields, taps Submit — saved locally, queued for sync (US-INS-04)
7. **Technician** accidentally taps Submit again — no duplicate created, same record updated (US-OFF-05)
8. **Technician** goes back online — sync starts automatically, status changes from "pending" to "synced" (US-OFF-03)
9. **QA Reviewer** opens review queue, sees submitted inspection with all form data + evidence (US-QA-01)
10. **QA Reviewer** opens evidence item, flags one photo as "unclear — retake needed" with comment (US-QA-02)
11. **Technician** sees flagged evidence notification, returns to inspection, retakes photo, resubmits (US-MOB-03)
12. **QA Reviewer** reviews again, approves inspection (US-QA-01)
13. **QA Reviewer** taps "Create Ticket from Defect" — ticket auto-populated with asset, defect, severity, evidence (US-TKT-01)
14. **Dispatcher** sees new ticket, creates work order linked to ticket with due date (US-TKT-08)
15. **Dispatcher** assigns ticket to technician (US-TKT-03)
16. **Technician** completes repair, adds resolution notes + before/after photos, submits (US-TKT-05 — ticket moves to Pending Review)
17. **QA Reviewer** reviews closure, approves — ticket moves to CLOSED (US-QA-03)

### Seed data requirements

- `tech@cmms.test` — assigned to inspection, has blade repair skill
- `qa@cmms.test` — QA reviewer in same org
- `dispatcher@cmms.test` — dispatcher in same org
- Pending inspection on a blade subsystem component
- At least one inspection template with photo + text fields

---

## Chain 2: Absence → Replacement → Reassignment

**Bead:** cmms-mn1
**Roles involved:** Technician, Dispatcher, Operations Manager, QA Reviewer
**User stories:** 10 stories covering unexpected absence handling

### Flow

```
Technician A        Dispatcher          Ops Manager         Technician B      QA Reviewer
    │                   │                    │                    │                │
    │ US-AVAIL-04       │                    │                    │                │
    │ Self-report sick ─┤                    │                    │                │
    │                   │                    │                    │                │
    │                   │ US-DISP-01         │                    │                │
    │                   │ See coverage board │                    │                │
    │                   │ Tech A shows SICK  │                    │                │
    │                   │                    │                    │                │
    │                   │ US-DISP-02         │                    │                │
    │                   │ SLA risk flagged   │                    │                │
    │                   │ on Tech A's jobs   │                    │                │
    │                   │                    │                    │                │
    │                   │ US-REPL-01         │                    │                │
    │                   │ Request replacment │                    │                │
    │                   │ suggestions        │                    │                │
    │                   │                    │                    │                │
    │                   │ US-REPL-03         │                    │                │
    │                   ├───────────────────→│ Escalate: no       │                │
    │                   │                    │ candidate >60%     │                │
    │                   │                    │                    │                │
    │                   │                    │ Manual reassign    │                │
    │                   │                    │ US-REPL-02         │                │
    │                   │                    │ Pick Tech B ──────→│                │
    │                   │                    │                    │                │
    │                   │                    │                    │ US-REPL-04     │
    │                   │                    │                    │ Accept         │
    │                   │                    │                    │ assignment     │
    │                   │                    │                    │                │
    │                   │                    │                    │ US-TKT-05      │
    │                   │                    │                    │ Complete work ─┤
    │                   │                    │                    │                │ US-QA-03
    │                   │                    │                    │                │ Approve
    │                   │                    │                    │                │
    │                   │                    │ US-AVAIL-05        │                │
    │                   │                    │ Review absence     │                │
    │                   │                    │ patterns           │                │
```

### Step-by-step

1. **Technician A** opens mobile, sets status to SICK with reason "flu, expected return Thursday" (US-AVAIL-04)
2. **Dispatcher** opens coverage board, sees Tech A shown as SICK with red indicator (US-DISP-01)
3. **Dispatcher** sees SLA risk warning — 2 open assignments due within 24h will breach (US-DISP-02)
4. **Dispatcher** clicks "Find Replacement" — system returns candidates but all score below 60% threshold (US-REPL-01)
5. **Dispatcher** escalates — notification sent to Operations Manager with required skills/certs listed (US-REPL-03)
6. **Operations Manager** reviews escalation, manually selects Technician B despite partial skill match, confirms reassignment (US-REPL-02)
7. **Technician B** receives notification of new assignment, taps Accept (US-REPL-04)
8. **Technician B** completes the work, adds resolution notes (US-TKT-05)
9. **QA Reviewer** approves closure (US-QA-03)
10. **Operations Manager** opens absence history report, sees Tech A has 3 sick days this month, filters by team (US-AVAIL-05)

### Seed data requirements

- `technician1@cmms.test` — going sick, has 2 open assignments with near-SLA deadlines
- `tech@cmms.test` — replacement candidate, partial skill overlap
- `dispatcher@cmms.test` — dispatcher handling the absence
- `ops@cmms.test` — operations manager receiving escalation
- `qa@cmms.test` — QA reviewer for the reassigned work

---

## Chain 3: Sync Conflict Resolution

**Bead:** cmms-i1x
**Roles involved:** Technician A, Technician B, QA Reviewer
**User stories:** 10 stories covering offline sync with conflicts

### Flow

```
Technician A        Technician B                    Server              QA Reviewer
    │                   │                              │                    │
    │ Both assigned to same turbine component          │                    │
    │                   │                              │                    │
    │ US-OFF-01         │ US-OFF-01                    │                    │
    │ Work offline      │ Work offline                 │                    │
    │                   │                              │                    │
    │ US-INS-04         │ US-INS-04                    │                    │
    │ Submit inspect.   │ Submit inspect.              │                    │
    │ (local)           │ (local)                      │                    │
    │                   │                              │                    │
    │ US-EVID-01        │ US-EVID-01                   │                    │
    │ Photo: oil leak   │ Photo: vibration             │                    │
    │                   │                              │                    │
    │ US-OFF-03         │                              │                    │
    │ Goes online ──────┤                              │                    │
    │ Sync succeeds     │                              │                    │
    │                   │                              │                    │
    │                   │ US-OFF-03                    │                    │
    │                   │ Goes online ─────────────────┤                    │
    │                   │ CONFLICT detected            │                    │
    │                   │                              │                    │
    │                   │ US-OFF-04                    │                    │
    │                   │ Conflict notification        │                    │
    │                   │ shown to tech                │                    │
    │                   │                              │                    │
    │                   │                              │ US-AUDIT-01        │
    │                   │                              │ Conflict logged    │
    │                   │                              │ in audit trail     │
    │                   │                              │                    │
    │                   │                              │ US-QA-01           │
    │                   │                              ├───────────────────→│
    │                   │                              │                    │ Side-by-side
    │                   │                              │                    │ review both
    │                   │                              │                    │ inspections
    │                   │                              │                    │
    │                   │                              │                    │ Merge non-
    │                   │                              │                    │ conflicting
    │                   │                              │                    │ fields
    │                   │                              │                    │
    │                   │                              │                    │ US-TKT-01
    │                   │                              │                    │ Create ticket
    │                   │                              │                    │ from confirmed
    │                   │                              │                    │ defect
    │                   │                              │                    │
    │ US-DASH-05        │                              │                    │
    │ Sync health shows │                              │                    │
    │ conflict resolved │                              │                    │
```

### Step-by-step

1. **Tech A** and **Tech B** both assigned to inspect same gearbox component on same turbine
2. Both go offline (remote site, no signal) — offline indicator shows (US-OFF-01 × 2)
3. **Tech A** finds oil leak, fills form, captures 3 photos, submits locally (US-INS-04 + US-EVID-01)
4. **Tech B** finds abnormal vibration, fills form with different findings, captures 2 photos, submits locally (US-INS-04 + US-EVID-01)
5. **Tech A** drives back to range, goes online — sync succeeds, inspection stored on server (US-OFF-03)
6. **Tech B** goes online — server detects version conflict on same component inspection (US-OFF-03)
7. **Tech B** sees conflict notification: "Your changes conflict with server data" (US-OFF-04)
8. Conflict event logged in audit trail with both versions (US-AUDIT-01)
9. **QA Reviewer** opens conflict review — sees both inspections side-by-side (US-QA-01)
10. **QA Reviewer** merges non-conflicting fields (oil leak from A, vibration from B), rejects conflicting severity assessment
11. **QA Reviewer** creates ticket from confirmed oil leak defect (US-TKT-01)
12. **Ops Manager** checks sync health dashboard — sees conflict count and resolution status (US-DASH-05)

### Seed data requirements

- Two technicians assigned to the same turbine component
- `tech@cmms.test` and `technician1@cmms.test`
- `qa@cmms.test` for conflict review
- Same inspection template assigned to both

---

## Chain 4: Ticket Reopen Cycle with Evidence Trail

**Bead:** cmms-wj1
**Roles involved:** Technician, QA Reviewer, Dispatcher, Operations Manager
**User stories:** 12 stories covering the full defect lifecycle including recurrence

### Flow

```
Technician          QA Reviewer         Dispatcher          Ops Manager
    │                   │                    │                    │
    │ Submit inspect. ──┤                    │                    │
    │                   │ US-QA-01           │                    │
    │                   │ REJECT inspection  │                    │
    │                   │ "need better       │                    │
    │                   │  evidence"         │                    │
    │                   │                    │                    │
    │ US-EVID-01        │                    │                    │
    │ Retake photos     │                    │                    │
    │ US-EVID-04        │                    │                    │
    │ Add annotations   │                    │                    │
    │ (arrows, labels)  │                    │                    │
    │ Resubmit ─────────┤                    │                    │
    │                   │ US-QA-01           │                    │
    │                   │ APPROVE            │                    │
    │                   │                    │                    │
    │                   │ US-TKT-01          │                    │
    │                   │ Create ticket      │                    │
    │                   │                    │                    │
    │                   │                    │ US-TKT-03          │
    │                   │                    │ Assign to tech ────┤
    │                   │                    │                    │
    │ US-TKT-05         │                    │                    │
    │ Repair + photos ──┤                    │                    │
    │                   │ US-QA-03           │                    │
    │                   │ Approve → CLOSED   │                    │
    │                   │                    │                    │
    │                   │                    │    ... 2 weeks ... │
    │                   │                    │                    │
    │                   │ US-TKT-06          │                    │
    │                   │ REOPEN ticket      │                    │
    │                   │ "defect recurred,  │                    │
    │                   │  same location"    │                    │
    │                   │                    │                    │
    │                   │                    │ US-TKT-04          │
    │                   │                    │ Escalate to        │                    │
    │                   │                    │ CRITICAL           │                    │
    │                   │                    │                    │ US-DASH-03
    │                   │                    │                    │ Defect trend:
    │                   │                    │                    │ blade trailing
    │                   │                    │                    │ edge — recurring
    │                   │                    │                    │
    │                   │                    │                    │ US-AUDIT-01
    │                   │                    │                    │ Full audit trail
    │                   │                    │                    │ shows original
    │                   │                    │                    │ → repair → reopen
```

### Step-by-step

1. **Technician** submits inspection with photos of trailing edge damage
2. **QA Reviewer** rejects inspection: "Photos unclear, need annotated close-ups of damage area" (US-QA-01)
3. **Technician** returns, captures new high-res photos of same area (US-EVID-01)
4. **Technician** adds annotations — arrows pointing to crack, text label "crack extends 15cm from root" (US-EVID-04)
5. **Technician** resubmits inspection
6. **QA Reviewer** approves inspection (US-QA-01)
7. **QA Reviewer** creates ticket from defect — auto-populated with asset, location, severity, evidence links (US-TKT-01)
8. **Dispatcher** assigns ticket to technician (US-TKT-03)
9. **Technician** performs repair, adds before/after photos + resolution notes (US-TKT-05)
10. **QA Reviewer** reviews and approves closure — ticket moves to CLOSED (US-QA-03)
11. **Two weeks later** — same component shows same defect
12. **QA Reviewer** reopens ticket with reason "Defect recurred at same location, original repair insufficient" (US-TKT-06)
13. **Dispatcher** escalates priority to CRITICAL (US-TKT-04)
14. **Operations Manager** opens defect trends dashboard — sees blade trailing edge defects trending upward across fleet (US-DASH-03)
15. **Operations Manager** opens full audit trail — sees complete history: original find → rejection → re-inspection → repair → closure → reopen (US-AUDIT-01)

### Seed data requirements

- `tech@cmms.test` — blade repair technician
- `qa@cmms.test` — QA reviewer who rejects then approves
- `dispatcher@cmms.test` — dispatcher who escalates priority
- `ops@cmms.test` — operations manager viewing trends
- Blade trailing edge component with initial defect
- Historical inspection data showing previous defects on same component type

---

## Chain 5: New Turbine Commissioning (Admin-Heavy)

**Bead:** cmms-jk1
**Roles involved:** Administrator, Dispatcher, Technician, QA Reviewer, Operations Manager
**User stories:** 14 stories covering the full commissioning workflow

### Flow

```
Administrator       Dispatcher          Technician          QA Reviewer         Ops Manager
    │                   │                    │                    │                    │
    │ US-ASSET-01       │                    │                    │                    │
    │ Create org        │                    │                    │                    │
    │ "North Wind"      │                    │                    │                    │
    │                   │                    │                    │                    │
    │ US-ASSET-02       │                    │                    │                    │
    │ Create site       │                    │                    │                    │
    │ "Baltic Shore"    │                    │                    │                    │
    │                   │                    │                    │                    │
    │ US-ASSET-03       │                    │                    │                    │
    │ Create turbine    │                    │                    │                    │
    │ WTG-B01           │                    │                    │                    │
    │                   │                    │                    │                    │
    │ US-ASSET-04       │                    │                    │                    │
    │ Create subsystems │                    │                    │                    │
    │ (Rotor, Gearbox,  │                    │                    │                    │
    │  Electrical...)   │                    │                    │                    │
    │                   │                    │                    │                    │
    │ US-ASSET-05       │                    │                    │                    │
    │ Create components │                    │                    │                    │
    │ (Blades, Bearings,│                    │                    │                    │
    │  Generator...)    │                    │                    │                    │
    │                   │                    │                    │                    │
    │ US-ADMIN-04       │                    │                    │                    │
    │ US-INS-01         │                    │                    │                    │
    │ Build commission. │                    │                    │                    │
    │ template          │                    │                    │                    │
    │                   │                    │                    │                    │
    │ US-ADMIN-01       │                    │                    │                    │
    │ Create tech       │                    │                    │                    │
    │ accounts          │                    │                    │                    │
    │                   │                    │                    │                    │
    │ US-ADMIN-02       │                    │                    │                    │
    │ Assign skills +   │                    │                    │                    │
    │ certifications    │                    │                    │                    │
    │                   │                    │                    │                    │
    │                   │ US-DISP-03         │                    │                    │
    │                   │ Assign commiss.    │                    │                    │
    │                   │ inspection ───────→│                    │                    │
    │                   │                    │                    │                    │
    │                   │                    │ US-OFF-02          │                    │
    │                   │                    │ Preload all        │                    │
    │                   │                    │ commissioning data │                    │
    │                   │                    │                    │                    │
    │                   │                    │ US-MOB-03          │                    │
    │                   │                    │ Complete commiss.  │                    │
    │                   │                    │ inspection ────────┤                    │
    │                   │                    │                    │ US-QA-01           │
    │                   │                    │                    │ Review + find      │
    │                   │                    │                    │ 2 defects          │
    │                   │                    │                    │                    │
    │                   │                    │                    │ US-TKT-01          │
    │                   │                    │                    │ Create 2 tickets   │
    │                   │                    │                    │                    │
    │                   │ US-TKT-08          │                    │                    │
    │                   │ Issue 2 work       │                    │                    │
    │                   │ orders ───────────→│                    │                    │
    │                   │                    │                    │                    │
    │                   │                    │                    │                    │ US-DASH-04
    │                   │                    │                    │                    │ Export
    │                   │                    │                    │                    │ commissioning
    │                   │                    │                    │                    │ report
    │                   │                    │                    │                    │
    │                   │                    │                    │                    │ US-AUDIT-01
    │                   │                    │                    │                    │ US-AUDIT-02
    │                   │                    │                    │                    │ Full audit +
    │                   │                    │                    │                    │ export
```

### Step-by-step

1. **Administrator** creates new organization "North Wind Energy" (US-ASSET-01)
2. **Administrator** creates site "Baltic Shore Wind Farm" with GPS coordinates (US-ASSET-02)
3. **Administrator** registers turbine WTG-B01 (IEC 61400-25 naming) under Baltic Shore (US-ASSET-03)
4. **Administrator** creates subsystems: Rotor Assembly, Gearbox, Yaw System, Electrical, Tower (US-ASSET-04)
5. **Administrator** creates components under each subsystem: 3 Blades, Main Bearing, Planetary Gear, Generator, etc. (US-ASSET-05)
6. **Administrator** builds commissioning inspection template with pass/fail checks for each subsystem (US-ADMIN-04 + US-INS-01)
7. **Administrator** creates technician accounts for the commissioning team (US-ADMIN-01)
8. **Administrator** assigns skills (blade inspection, electrical testing) and certifications (GWO Working at Heights) to techs (US-ADMIN-02)
9. **Dispatcher** assigns commissioning inspection to lead technician (US-DISP-03)
10. **Technician** preloads all commissioning data + templates for offline access (US-OFF-02)
11. **Technician** completes commissioning inspection at site, finds 2 defects (gearbox alignment issue, missing yaw bolt) (US-MOB-03)
12. **QA Reviewer** reviews commissioning results, confirms 2 defects found (US-QA-01)
13. **QA Reviewer** creates 2 tickets from defects — one per component (US-TKT-01)
14. **Dispatcher** issues 2 work orders from the tickets (US-TKT-08)
15. **Operations Manager** exports commissioning report with all findings, evidence, and defect tickets (US-DASH-04)
16. **Operations Manager** reviews full audit trail — every action from org creation to report export visible (US-AUDIT-01 + US-AUDIT-02)

### Seed data requirements

- No pre-existing data — this chain starts from scratch
- `admin@cmms.test` — administrator creating the hierarchy
- `dispatcher@cmms.test` — assigning commissioning work
- `tech@cmms.test` — lead commissioning technician
- `qa@cmms.test` — QA reviewer
- `ops@cmms.test` — operations manager exporting report

---

## Summary Matrix

| Chain | Bead | Roles | Stories | Key Scenario |
|-------|------|-------|---------|--------------|
| 1 | cmms-xw2 | Dispatcher, Tech, QA | 17 | Full defect lifecycle with offline sync |
| 2 | cmms-mn1 | Tech, Dispatcher, Ops, QA | 10 | Unexpected absence → escalation → recovery |
| 3 | cmms-i1x | Tech A, Tech B, QA | 10 | Concurrent offline edits → conflict resolution |
| 4 | cmms-wj1 | Tech, QA, Dispatcher, Ops | 12 | Defect recurrence → reopen → trend analysis |
| 5 | cmms-jk1 | Admin, Dispatcher, Tech, QA, Ops | 14 | Greenfield turbine commissioning |

### Cross-chain dependencies

- **Chain 1** produces a resolved ticket — could be reopened as the starting point for **Chain 4**
- **Chain 3** produces a ticket from conflict resolution — feeds into **Chain 1** for repair
- **Chain 5** creates the asset hierarchy — **Chains 1-4** operate on existing assets
- **Chain 2** disrupts assignments — could interrupt any in-progress chain

### Total user story coverage

| Category | Stories covered by chains |
|----------|--------------------------|
| Auth | — |
| Assets | 01–05 (via Chain 5) |
| Inspection Templates | 01, 02 (via Chain 5) |
| Inspections | 03, 04, 05 (via Chains 1, 3, 4) |
| Offline | 01–05 (via Chains 1, 3, 5) |
| Evidence | 01, 04 (via Chains 1, 4) |
| Tickets | 01, 03, 04, 05, 06, 08 (via Chains 1, 2, 4) |
| Availability | 04, 05 (via Chain 2) |
| Replacements | 01–04 (via Chain 2) |
| Dispatch | 01, 02, 03 (via Chains 1, 2, 5) |
| Dashboards | 03, 04, 05 (via Chains 3, 4, 5) |
| Search/Audit | 01, 02 (via Chains 3, 4, 5) |
| Mobile | 02, 03 (via Chains 1, 5) |
| Admin | 01, 02, 04 (via Chain 5) |
| QA Review | 01, 02, 03 (via Chains 1, 2, 4) |
| NFRs | — |
