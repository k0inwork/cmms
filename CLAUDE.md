# Project Instructions for AI Agents

This file provides instructions and context for AI coding agents working on this project.

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:ca08a54f -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd dolt push
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
<!-- END BEADS INTEGRATION -->


## Orch Workflow

Session: always use current tmux session — NEVER create a new one.

Role detection: **pane index 0 = ORCHESTRATOR**, pane index 1+ = EXECUTOR.

### Orchestrator (pane 0) — assigns, monitors, merges

```bash
./scripts/orch spawn                    # new CC executor pane (worktree auto-created)
./scripts/orch assign <bead> --cc <pane> # map bead to executor pane
./scripts/orch task <bead>              # build prompt from bd + send to executor
./scripts/orch status                   # all beads + bd + CI overview
./scripts/orch monitor [sec]            # daemon: watch state changes, notify pane 0
./scripts/orch pull <bead>              # merge completed work back to main
./scripts/orch done <bead>              # mark done + close in bd
./scripts/orch kill <bead>              # kill stuck executor
```

Flow: `spawn → assign → task → monitor → pull → done`

### Executor (pane 1+) — implements, tests, commits

1. Receive task prompt from orchestrator
2. `bd update <id> --claim` — claim the bead
3. Read code, understand before changing
4. Implement the feature/fix
5. `npm run build && npm test` — verify quality gates
6. `git add <files> && git commit -m "description"`
7. `git push`
8. `bd close <id>`
9. `bd remember "insight" --key <category>:<topic>` — share learnings
10. `bd dolt push` — sync beads

### Rules
- Orchestrator NEVER writes implementation code directly
- Executors NEVER assign work to other agents
- Always use `./scripts/orch` commands — never raw tmux or manual pane management
- Monitor runs in background; orchestrator checks `./scripts/orch status` periodically

## Build & Test

```bash
npm run build
npm test
npm run lint
```

## Architecture Overview

Wind turbine CMMS/FSM/EAM platform. Hono + Prisma + TypeScript + Vitest.
- `src/routes/` — REST API routes (CRUD with cursor pagination, soft deletes)
- `src/middleware/auth.ts` — JWT auth + role guards
- `src/utils/` — pagination, errors, JWT, password hashing
- `src/lib/prisma.ts` — Prisma client singleton
- `prisma/schema.prisma` — full schema (29 tables)
- `prisma/seed.ts` — realistic seed data
- `tests/` — mock-first (London School) tests with vi.mock

## Conventions & Patterns

- CRUD routes: pagination via `paginationSchema`/`buildCursorQuery`/`paginatedResponse`
- Soft deletes: `deleted_at` field, filtered with `where: { deleted_at: null }`
- Duplicate checks: `findFirst` before create, `ConflictError` on clash
- Auth: `authMiddleware()` for all writes, `requireRoles('ADMINISTRATOR')` for admin-only
- Tests: mock prisma with `vi.mock`, test via `app.request()` — never hit real DB
- Route nesting: organizations → sites → turbines → subsystems → components
