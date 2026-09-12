# Velozity Client Project Dashboard — Project Plan

Prepared: 11 September 2026. Assessment deadline: **12 September 2026, 11:59 PM IST** (interpreting the supplied date as DD/MM/YYYY).

## 1. Scope, source material, and existing setup

This document plans the complete application. It does not implement, deploy, publish, or submit it.

- **User request:** retain the existing frontend setup; use React with TypeScript, Express for the backend, pnpm throughout, and the brutalist design defined in `UI.txt`; plan the architecture, file structure, and every delivery phase.
- **Assessment source:** `/home/prabhat/Downloads/Copy of Velozity Global Solutions - Full Stack Developer - Technical Hiring Assessment.pdf`, all four pages. Its feature requirements and evaluation criteria define the target application. Its submission link and publishing instructions are future deliverables, not instructions to perform those actions during planning.
- **Design source:** `UI.txt`, adopted because the user explicitly selected it. Preserve its exact palette and professional, information-dense visual direction.
- **Observed implementation:** `frontend/` contains the React/TypeScript Vite starter, ESLint, TypeScript configurations, and `frontend/pnpm-lock.yaml`. `App.tsx` is still the starter screen. Existing global CSS contains purple accents, automatic dark mode, gradients/shadow styling inconsistent with the requested direction; replace those styles during implementation.
- **Current gaps:** no backend, database schema, authentication, application screens, or tests were found in the inspected source tree.

### Success criteria and priority

| Evaluation area | Weight | Concrete evidence |
| --- | --- | --- |
| API role and ownership enforcement | 25% | Negative integration tests across two PMs and four developers |
| Correct live feed and database catch-up | 25% | Multiple browser sessions, isolated recipients, offline replay |
| Relational schema and indexes | 20% | Prisma migrations, foreign keys, schema diagram, index rationale |
| Architecture and TypeScript | 20% | Thin controllers, shared contracts, strict types, coherent feature modules |
| Seed, documentation, setup | 10% | Repeatable seed, clean-install check, Docker, complete README |

**Release blockers:** frontend-only authorization, polling/SSE replacing WebSockets, missing refresh-token rotation and HttpOnly storage, missing seed, non-TypeScript application code, hardcoded secrets, or SQL scattered through controllers.

## 2. Architecture decisions

| Layer | Planned choice | Reason |
| --- | --- | --- |
| Repository | Small pnpm workspace | Preserve `frontend/`; share validation/types without duplicating contracts |
| Frontend | Existing React + TypeScript + Vite | Already installed and matches the requested stack |
| Routing | React Router | Protected layouts, task deep links, URL query filters |
| Server state | TanStack Query | Scoped cache keys, mutations, invalidation, reconnect reconciliation |
| Session/local UI | React context + component state | Memory-only access token; no unnecessary global state framework |
| Forms/contracts | React Hook Form + Zod | Form ergonomics and shared schemas; server always validates independently |
| Styling | CSS custom properties + CSS Modules | Precise control over the supplied brutalist system, little framework overhead |
| Icons | Lucide React, used sparingly | Consistent utility icons with visible text where meaning could be unclear |
| Backend | Express + TypeScript | User-selected; clear middleware and service boundaries, one HTTP/WebSocket server |
| Database | PostgreSQL + Prisma | Relational constraints, reproducible migrations, typed queries |
| Authentication | Signed JWT access token + rotated opaque refresh token | Short-lived API credential; revocable database-backed sessions |
| Passwords | Argon2id | Password hashing isolated behind a small service |
| Realtime | Socket.IO, WebSocket transport only | Authenticated connections, reconnection, rooms and acknowledgements |
| Scheduler | node-cron in an always-running Node process | One periodic overdue sweep does not justify a Redis-backed queue |
| Tests | Vitest, Supertest, Socket.IO client, Playwright | Unit, real-Postgres integration, socket isolation, browser workflows |
| Operations | Docker Compose + structured logs + CI | Reproducible setup and inspectable failures |

Keep application code in TypeScript on both sides. Existing tooling configuration JavaScript can remain if supported by the tool. Do not upgrade the existing frontend stack merely to start implementation. Verify dependency peer/engine compatibility, select one supported Node runtime for Docker/CI/hosting, and pin pnpm in the root `packageManager` field during Phase 0.

### Runtime boundaries

```text
React application
  ├── REST requests with Bearer access token ──> Express routes
  ├── refresh/logout with HttpOnly cookie ────> Session service
  └── authenticated WebSocket ────────────────> Socket.IO gateway
                                                   │
                           Shared authorization and domain services
                                                   │
                                             PostgreSQL
                                                   ▲
                    node-cron overdue sweep ───────┘

Successful database transaction → authorized socket recipients → UI cache update
```

REST is the authoritative mutation channel. WebSockets deliver committed changes, notification updates, and presence. Avoid a second socket-based mutation API.

### Deliberate product assumptions

These resolve unspecified details and must be documented in the README:

1. A PM's team means developers assigned to tasks in projects that PM created. No separate organization/team membership model is required.
2. An Admin-created project is managed by Admin; PM access still requires `createdById === currentUser.id`. Do not silently treat all projects as PM-accessible.
3. PMs can select from active developers and minimal client lookup records to create/assign work. They cannot browse user administration, client contact details, or other PMs' workloads.
4. Developers can change the status of their currently assigned tasks, but cannot edit descriptions, deadlines, priority, or assignment. No extra approval workflow is required; any of the four valid status transitions is allowed.
5. Every task has one active developer, a required due date, and a priority. Developer reassignment immediately changes access to task data and its history.
6. Overdue is a persisted flag, not a fifth status. Completed tasks are not overdue.
7. Store timestamps in UTC. Treat date-only task deadlines as end-of-day Asia/Kolkata, and show that timezone in forms. The PM's “this week” means Monday through Sunday in Asia/Kolkata.
8. Archive projects/clients instead of cascading away audit history. Archived projects are read-only and excluded from default operational counts and overdue sweeps; their history remains available to authorized users.
9. User management covers create, edit profile/role, and deactivate. Prevent removing the last active Admin; prevent role changes/deactivation that strand active project ownership or task assignments without reassignment/archive.
10. No public registration, file upload, billing, chat, email delivery, drag-and-drop board, or password-reset email flow is needed for this assessment.

## 3. Proposed repository structure

Preserve `frontend/`; add the following incrementally rather than creating empty abstractions upfront.

```text
assessment/
├── plan.md
├── UI.txt
├── README.md
├── package.json                   # private workspace; orchestration scripts
├── pnpm-workspace.yaml            # frontend, backend, packages/*
├── pnpm-lock.yaml                 # one root lockfile after migration
├── .gitignore
├── .env.example                   # local Compose variables, no credentials
├── compose.yaml                   # PostgreSQL, API; optional frontend profile
├── vercel.json                    # frontend build, SPA fallback, API proxy if used
├── .github/workflows/ci.yml
├── docs/
│   ├── architecture.md            # schema, permissions, event flow, decisions
│   ├── api.md                     # routes, filters, request/error examples
│   ├── deployment.md              # hosting, cookie topology, smoke checks
│   └── submission.md              # final links and actual 150–250 word explanation
├── packages/contracts/
│   ├── package.json               # @velozity/contracts
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts
│       ├── enums.ts
│       ├── auth.ts
│       ├── projects.ts
│       ├── tasks.ts
│       ├── activity.ts
│       ├── notifications.ts
│       └── errors.ts
├── frontend/
│   ├── package.json               # preserve app; name @velozity/frontend
│   ├── .env.example
│   ├── vite.config.ts
│   ├── src/
│   │   ├── main.tsx
│   │   ├── app/
│   │   │   ├── App.tsx
│   │   │   ├── router.tsx
│   │   │   └── providers.tsx
│   │   ├── layouts/
│   │   │   ├── AppShell.tsx
│   │   │   └── AuthLayout.tsx
│   │   ├── components/ui/         # Button, Input, Select, Badge, Dialog,
│   │   │                         # Table, EmptyState, ErrorState, Skeleton
│   │   ├── features/
│   │   │   ├── auth/              # provider, login, route guard
│   │   │   ├── dashboard/         # AdminDashboard, PMDashboard, DeveloperDashboard
│   │   │   ├── clients/           # Admin list/form
│   │   │   ├── users/             # Admin list/form
│   │   │   ├── projects/          # list, detail, project form
│   │   │   ├── tasks/             # table, filters, detail, form, status selector
│   │   │   ├── activity/          # feed, event row, catch-up state
│   │   │   └── notifications/     # bell, dropdown, read actions
│   │   ├── lib/
│   │   │   ├── api-client.ts      # auth header, one refresh retry
│   │   │   ├── query-client.ts
│   │   │   ├── socket.ts          # single session-scoped connection
│   │   │   ├── realtime-sync.ts   # event dedupe and cache invalidation
│   │   │   └── dates.ts
│   │   ├── styles/
│   │   │   ├── tokens.css
│   │   │   └── globals.css
│   │   └── test/setup.ts
│   └── e2e/                      # roles, reconnect, notifications, filters
└── backend/
    ├── package.json               # @velozity/backend
    ├── tsconfig.json
    ├── Dockerfile
    ├── .env.example
    ├── prisma/
    │   ├── schema.prisma
    │   ├── migrations/
    │   └── seed.ts
    ├── src/
    │   ├── app.ts                 # Express construction, no listen side effects
    │   ├── server.ts              # HTTP server, sockets, scheduler, shutdown
    │   ├── config/env.ts
    │   ├── db/prisma.ts
    │   ├── middleware/            # authenticate, requireRole, validate, errors
    │   ├── policies/              # projectScope, taskScope, activityScope
    │   ├── modules/
    │   │   ├── auth/
    │   │   ├── users/
    │   │   ├── clients/
    │   │   ├── projects/
    │   │   ├── tasks/
    │   │   ├── activity/
    │   │   ├── notifications/
    │   │   └── dashboard/
    │   ├── realtime/
    │   │   ├── gateway.ts
    │   │   ├── socket-auth.ts
    │   │   ├── recipients.ts
    │   │   └── presence.ts
    │   ├── jobs/
    │   │   ├── scheduler.ts
    │   │   └── overdue.service.ts
    │   └── lib/                   # AppError, logger, token/password helpers
    └── tests/
        ├── helpers/               # test DB fixtures, server lifecycle
        ├── integration/           # API, transactions, scheduler
        └── realtime/              # isolation, reassignment, catch-up
```

Each backend feature uses `*.routes.ts`, `*.controller.ts`, `*.service.ts`, and, when queries warrant it, `*.repository.ts`. Controllers translate HTTP only; services own permissions, transactions, and business rules; repositories own database access. Shared contracts export safe DTOs and Zod schemas, never Prisma models, password fields, or server secrets.

## 4. Database design

Use UUID primary keys except the feed sequence, PostgreSQL enums for closed sets, `timestamptz` for instants, explicit foreign keys, and constrained lengths. Seed visible task numbers so the UI can show `Task #12` independently of its UUID.

| Entity | Essential fields and relationships |
| --- | --- |
| User | id, name, normalized unique email, passwordHash, role, isActive, createdAt, updatedAt |
| RefreshSession | id, userId FK, tokenHash unique, familyId, expiresAt, usedAt, revokedAt, replacedById, createdAt |
| Client | id, name, contactName/contactEmail optional, createdById FK, archivedAt, timestamps |
| Project | id, clientId FK, createdById FK, name, description, archivedAt, timestamps |
| Task | id, number unique, projectId FK, assignedDeveloperId FK, title, description, status, priority, dueAt, isOverdue, overdueMarkedAt nullable, version integer, timestamps |
| ActivityEvent | sequence bigint unique, id UUID, projectId FK, taskId FK nullable, actorId FK nullable for system events, type, fromStatus/toStatus nullable, safe change metadata, createdAt |
| Notification | id, recipientId FK, taskId FK, activityEventId FK, type, readAt nullable, createdAt |

Relationships: Client 1→N Projects; User 1→N created Projects; Project 1→N Tasks; Developer 1→N assigned Tasks; Task 1→N ActivityEvents; User 1→N Notifications and RefreshSessions. Notifications refer to the event that caused them. Use a unique `(recipientId, activityEventId, type)` constraint to prevent duplicate notifications.

Foreign keys alone do not prove that an assignee is a Developer or that a project creator is authorized. Enforce those role invariants in the domain service and test them. Restrict destructive deletes; preserve events through archiving and user deactivation.

### Index plan tied to actual queries

| Index | Query it supports |
| --- | --- |
| User(email), unique | Login and duplicate email prevention |
| Project(createdById, archivedAt, createdAt) | PM-owned project lists and summaries |
| Project(clientId) | Client/project relation lookup |
| Task(projectId, status, dueAt) | Project task filters |
| Task(assignedDeveloperId, priority, dueAt, id) | Developer list and stable default order |
| Task(projectId, priority, dueAt) | PM priority breakdown and due-date lists |
| Task(dueAt) partial for non-Done, non-overdue rows | Scheduled overdue candidate scan |
| ActivityEvent(projectId, sequence), ActivityEvent(taskId, sequence) | Scoped history and replay |
| RefreshSession(tokenHash) unique, (userId), (expiresAt) | Rotation, revocation, cleanup |
| Notification(recipientId, readAt, createdAt) | Badge and dropdown queries |

Define priority order explicitly as Critical, High, Medium, Low; never sort its display labels alphabetically. Confirm actual generated query plans with representative data before adding further indexes. Define any partial index or locking SQL in migrations/repositories, never controllers. The task scan also joins project archive state.

### Transaction boundaries and concurrency

- Status mutation: authorize current assignment/ownership → compare `version` → update status and increment version → append immutable status event with actor and timestamp → create PM notification when entering In Review → commit → emit.
- Assignment mutation: authorize → validate active developer → update assignment/version → append event → create recipient notification → commit → revoke old user's cached access and publish to current recipients.
- A no-op status update produces no event and no notification. Stale versions return `409 CONFLICT`; UI refetches before another edit.
- Acquire a transaction-scoped PostgreSQL advisory lock for event-producing mutations before reading/updating state and allocating the feed sequence. At this small scale it provides a simple commit-ordered cursor: a higher published sequence cannot precede a still-uncommitted lower one. All event writers, including the scheduler, must use the same helper. Document this serialization tradeoff; use a proper durable dispatch design if scaling later.
- Emit only after commit. Treat event IDs as idempotency keys on the client. The baseline does not guarantee delivery during a process crash between commit and emit; reconnect reconciliation reads the durable rows. Document that limitation rather than claiming exactly-once delivery.

## 5. Authorization model

Authentication establishes identity; role middleware checks the operation; database query scope enforces ownership. Apply the same scope builders to list, detail, mutation, dashboard aggregates, activity queries, and WebSocket subscriptions/delivery. Never fetch everything and rely on the browser to hide unauthorized rows.

| Operation | Admin | PM | Developer |
| --- | --- | --- | --- |
| Manage users and clients | Yes | No | No |
| Minimal client/developer picker | Yes | Yes, safe fields only | No |
| Create project | Yes | Yes; creator forced to self | No |
| View/manage project | All | Own created projects | No project-wide endpoint |
| View task details/history | All | Tasks in own projects | Currently assigned task only |
| Create/edit/assign task | All | Own projects | No |
| Change task status | All | Own projects | Own assigned task |
| Global activity | All projects | Own projects | Assigned tasks only |
| Dashboard | Global counts | Own project aggregates | Own assigned tasks |
| Notifications | Own inbox | Own inbox | Own inbox |
| Online user count | Yes | No | No |

Developer task DTOs may include a minimal project label for context, never project-wide task counts, client contacts, other assignments, or team activity. Admin-wide activity does not imply permission to read other users' private notification inboxes.

For out-of-scope IDs return `404` without confirming existence; return `403` for a role that cannot perform that operation at all. Reject forged ownership fields and unexpected mutation properties. Reassignment removes former-assignee access to history and linked notification content; retain an unread row only if rendered generically, or exclude it from both inbox and badge using current authorization. Choose exclusion for this implementation.

## 6. Authentication and API security

1. `POST /auth/login`: validate input, rate-limit attempts, verify password and active user, issue access JWT (proposed 15 minutes) and a cryptographically random refresh token (proposed 7 days).
2. Keep the access token in application memory. Store refresh token only in an HttpOnly cookie; hash it in `RefreshSession`. Do not place either token in localStorage, URLs, logs, or returned user DTOs.
3. Verify JWT signature, allowed algorithm, issuer, audience, expiry, and session identifier. Load current user role/isActive and validate session revocation on every protected request; do not trust a client-supplied role.
4. `POST /auth/refresh`: atomically consume the old token, create its replacement, update the cookie, and return a new access token. Reject replay and revoke the affected token family. Preserve consumed token rows until expiry for replay detection.
5. Use a shared in-flight refresh promise within the app, one retry per failed request, and a cross-tab refresh mutex where available. Test concurrent refresh behavior; document the fallback on browsers without cross-tab locking.
6. On reload, bootstrap with refresh before rendering private routes. Never flash another role's cached dashboard.
7. `POST /auth/logout`: revoke the current session family, clear the cookie with matching attributes, disconnect its sockets, and clear all user-specific query/cache state. Role changes and deactivation also revoke relevant sessions and sockets.
8. Production cookie: `HttpOnly`, `Secure`, host-only, narrow auth path, appropriate SameSite policy. Prefer same-origin REST proxying through the frontend domain with `SameSite=Lax`; local development uses Vite's `/api` proxy. Verify actual cookie headers through the production proxy.
9. If genuinely cross-site cookies are necessary, use `SameSite=None; Secure`, explicit credentialed origins, and CSRF protection; recognize browser third-party-cookie restrictions. Do not rely on that arrangement as an untested deployment fallback.
10. Require approved Origin and a session-bound CSRF header on cookie-authenticated refresh/logout requests; issue CSRF material through a same-origin bootstrap endpoint. Validate login Origin too. Bearer-authenticated writes must still validate body and origin policy.
11. Configure Helmet, bounded JSON body size, strict CORS allowlist, parameter validation, sanitized error handling, and redacted structured request logs. No permissive wildcard credential policy.

Socket handshake uses `auth.accessToken` over TLS, with explicit Origin validation. Authenticate against current database state, reject invalid sessions, disconnect at JWT expiry, then let the client refresh via REST and reconnect. Reauthorize project subscription requests and current recipient eligibility; a once-authorized room is not permanent permission.

## 7. REST API contract

All application endpoints below are under `/api/v1`. Success: `{ data, meta? }`. Error: `{ error: { code, message, fieldErrors?, requestId } }`. Use consistent 400 validation, 401 authentication, 403 forbidden, 404 not found, 409 conflict, 429 limit, and 500 sanitized errors. Authenticated API responses should not be publicly cached.

| Method and route | Purpose / access |
| --- | --- |
| POST /auth/login, /auth/refresh, /auth/logout | Session lifecycle; refresh/logout use cookie protections |
| GET /auth/csrf | Same-origin CSRF bootstrap, no private application data |
| GET /auth/me | Current safe user profile |
| GET/POST /users; PATCH /users/:id | Admin user management |
| GET /lookups/developers; GET /lookups/clients | Admin/PM assignment and client options, limited fields |
| GET/POST /clients; GET/PATCH /clients/:id | Admin client management; archive through PATCH |
| GET/POST /projects; GET/PATCH /projects/:id | Admin/all or PM/creator scope |
| GET /projects/:id/tasks; POST /projects/:id/tasks | Scoped task collection and creation |
| GET /tasks; GET /tasks/:id | Scoped cross-project list and task detail |
| PATCH /tasks/:id | Admin/PM fields with version checking |
| PATCH /tasks/:id/status | Authorized status transition with expected version |
| GET /tasks/:id/activity | Scoped immutable task history |
| GET /activity | Role-scoped feed; optional authorized project filter and replay bounds |
| GET /dashboard | Role-specific aggregates, no client-chosen role |
| GET /notifications | Current user's visible notification page and unread count |
| PATCH /notifications/:id/read | Current user's visible notification only |
| POST /notifications/read-all | Mark eligible notifications read through a supplied server watermark |
| GET /health/live; GET /health/ready | Process health / DB readiness; no sensitive details |

Task filter example: `/tasks?status=IN_PROGRESS&priority=HIGH&dueFrom=2026-09-11&dueTo=2026-09-18&page=1&pageSize=20`.

- Validate enum values, UUIDs, date ranges, pagination bounds, and an allowlist of sort keys. Reject inverted ranges; cap page size at 100.
- Date range is inclusive in the displayed timezone; translate to `[start of dueFrom, start of day after dueTo)` UTC bounds.
- Apply filters in SQL/Prisma after combining with server-owned authorization scope. Identical query strings drive every task list, including dashboards and project details.
- Stable developer default ordering: priority severity, dueAt ascending, id as tie-breaker. Other task lists may choose an allowed sort; every sort remains deterministic.
- A projectId filter cannot widen a Developer's assignment scope. Count queries must apply exactly the same visibility and filters as row queries.
- Mark-all watermark prevents a notification that arrived after the user clicked from being silently marked read.

## 8. Real-time feed, recovery, and presence

### Transport and recipient design

Configure **both Socket.IO client and server with `transports: ['websocket']`**. Disable long-polling fallback; an unavailable WebSocket produces a visible disconnected state. Socket.IO's default delivery does not replace durable replay; persist events explicitly. See [Socket.IO delivery guarantees](https://socket.io/docs/v4/delivery-guarantees/).

Use server-controlled `user:<id>` rooms for targeted delivery and an Admin-only presence room. A project subscription is accepted only after scope validation. Never put Developers in a broad project broadcast room: the assessment's “all viewers” requirement applies only to data each viewer may access.

| Event | Safe payload / recipient |
| --- | --- |
| `activity.created` | Event ID/sequence, task ID/number, actor display name, change, timestamp; Admin, owning PM, current assignee |
| `task.updated` | Safe task DTO and version; same authorized recipients |
| `task.access-revoked` | Task ID only to former assignee; remove cached task/history and refetch own lists |
| `notification.created` | Safe notification for its recipient only |
| `notifications.changed` | Signal recipient to fetch authoritative inbox/count after create/read/read-all/access change |
| `presence.changed` | Distinct active user count; Admin only |
| `session.revoked` | Current session must disconnect and clear state |

Prefer authoritative notification count fetches triggered by socket events over accumulating `+1/-1` deltas, which can drift on duplicates and multiple tabs. This is event-driven reconciliation, not interval polling. Client reconnect also fetches the current count.

### Missed-event catch-up algorithm

1. Store the last reconciled global feed sequence per user in local browser storage; it is a nonsecret cursor, never a credential. Serialize bigint sequence values as decimal strings over JSON.
2. On first visit fetch the latest 20 authorized events from PostgreSQL. On reconnect, authenticate and establish live delivery first; buffer incoming events until synchronization completes.
3. Request a server snapshot watermark after subscription acknowledgement. It represents the highest committed feed sequence. Fetch events above the previous cursor and at or below that watermark, applying **current** visibility.
4. Order descending and take 20 so the user gets the **last 20 missed** events, not the first 20. Reverse for chronological merge as needed. Return `hasMoreMissed` so the UI can explain older history remains available.
5. Merge database results and buffered socket events by event ID; discard duplicates. Advance the replay cursor only after successful bounded reconciliation, never simply to the greatest socket message seen. Reconcile task lists and notifications too.
6. If more than 20 were missed, show “Showing the latest 20 missed updates” and allow authorized older-history pagination. Do not imply all missed events were loaded.
7. Do not advance a cursor after a failed query. An invalid/expired cursor falls back to a fresh latest-20 snapshot. On reassignment, clear unauthorized history immediately and reapply current scope on all replay queries.
8. Live feeds use relative time plus an absolute timestamp tooltip. Example: “Ravi moved Task #12 from In Progress → In Review · 2 mins ago”. Display a small “Live”, “Reconnecting”, or “Offline” indicator.

The global cursor is for the role-wide feed. Project/task history pages use their own pagination state; do not overwrite the global replay cursor with a filtered history cursor.

### Presence rules

Count authenticated **users**, not sockets. A user with three tabs contributes one. Maintain a user→socket-ID set in the single persistent backend, remove on disconnect/session revocation, and let heartbeat timeouts expire abandoned connections. Broadcast count changes only to Admins. On reconnect rebuild membership; never write high-frequency heartbeat updates into the User table.

In-memory presence is acceptable only under the explicitly single-instance deployment. Multi-instance/Vercel Function hosting requires shared coordination and expiring presence records; it cannot reuse this assumption unchanged.

## 9. Overdue scheduler

Run node-cron every minute in the persistent server with overlap prevention. Also run a startup reconciliation so downtime is repaired without anyone opening a page. See [node-cron scheduling options](https://www.nodecron.com/scheduling-options.html).

- Scan active-project tasks where `dueAt < now`, status is not Done, and `isOverdue = false`.
- In bounded batches, conditionally update matching rows, set `overdueMarkedAt`, append a system event, and publish after commit through the same visibility rules.
- Repeated ticks must be idempotent and produce no duplicate “became overdue” events. Recheck conditions inside the transaction so a task completed during the scan is not marked overdue.
- Completing a task clears its flag immediately. Moving its due date to the future also clears it. Reopening a past-due task or moving a deadline into the past is picked up by the next job tick.
- Dashboard counts and badges read persisted `isOverdue`; no page-load job or frontend-only date comparison decides the canonical flag.
- Record job duration, changed-row count, last-success time, and failures. Shut down the timer and connections gracefully.
- State the expected marking delay: approximately one minute while the worker is healthy. Do not claim a sleeping backend runs cron reliably.

## 10. Brutalist UI specification

### Exact tokens from UI.txt

| Token | Value | Usage |
| --- | --- | --- |
| Background | `#F4F0E6` | Entire application canvas |
| Surface | `#FFFDF5` | Forms, tables, panels |
| Text/border | `#111111` | Primary copy, strong outlines |
| Secondary text | `#555555` | Supporting copy |
| Muted | `#888888` | Decorative/disabled details; verify contrast before readable text use |
| Primary accent | `#FF5A36` | Main action, selected navigation marker |
| Secondary accent | `#C8FF00` | Sparing emphasis |
| Info | `#4D7CFE` | Informational indicators |
| Success | `#3FAE6A` | Done/success state |
| Warning | `#F2B134` | Warning and due-soon state |
| Danger | `#E63946` | Error/overdue/destructive state |

- Major containers: 2px black borders; compact row separators may be 1px. Radius 0–4px by default, never above 6px.
- Hard `4px 4px 0 #111111` shadows reserved for primary buttons, a key summary panel, or dialog. No soft shadows, gradients, glass, glow, blobs, decorative status colors, or rounded-card grid everywhere.
- Body: readable system sans stack, 14–16px, 1.45–1.6 line height. Headings: bold, 24–36px. Task IDs and compact metadata may use system monospace. Avoid font-download dependency for the first release.
- Spacing scale: 4, 8, 12, 16, 24, 32, 48px. Uppercase only navigation/short metadata; normal case for long text and form labels.
- Use black text on orange/lime action fills where contrast permits; do not assume white text works on every accent. Verify every foreground/background pair. Keep `#888888` out of essential small copy if it fails contrast.
- Color never carries status alone: include a text label and optional icon. Provide visible keyboard focus, labeled controls, accessible dialogs/dropdowns, form error association, and reduced-motion support.

### Application shell and screens

Desktop: roughly 224px left navigation, 64px top bar, fluid content region with 24–32px gutters. Top bar holds page context, connection state, notification bell, and account menu. Use a strong section heading and inline divider before the working table. A right activity rail can occupy about 320px on wide project pages; stack it below on narrower screens.

| Screen | Layout and actions |
| --- | --- |
| Login | Warm paper canvas, bold wordmark, compact bordered form, orange submit, clear errors |
| Admin dashboard | Flat four-part metric strip: projects, task status totals, overdue, live users; global feed and task status summary |
| PM dashboard | Own project summary table, priority counts, this-week due list, own-project feed; create-project action |
| Developer dashboard | Assigned task table ordered by priority/deadline, shared filter row, quick status selector, assigned-task feed |
| Projects | Dense table with client, creator where appropriate, progress, overdue count, update time; create/edit form |
| Project detail | Header/client context; task count summary; filterable task table plus activity rail; add-task action |
| Task detail | Deep-linkable page with description, status, priority, deadline, assignee, immutable event timeline; fields gated by role |
| Clients | Admin table and create/edit/archive dialog |
| Users | Admin role/status table and create/edit/deactivate dialog; avoid disclosing password hashes |
| Notifications | Count badge, anchored accessible dropdown, unread styling, individual/read-all controls, safe task link |

Developer navigation contains Dashboard/My Tasks/Activity; Admin gains Clients/Users; PM gets Projects. These affordances mirror API policy, but are never the access-control boundary.

At under ~768px collapse navigation into an accessible drawer, stack form fields, place activity below tasks, and use a deliberate scrollable table or compact task list preserving status/priority/deadline. All task-list variants reuse the same URL filters. Target 44px interactive touch areas even where dense desktop rows are used.

### Required interaction states

Every data screen has initial loading, empty data, no filter matches, recoverable error with retry, and populated states. Forms disable duplicate submissions and retain entered values after failure. Status changes initially use server-confirmed updates with a pending control; avoid optimistic permission-sensitive changes until concurrency is correct. Show actionable 409 conflict feedback. Refetch when a socket event invalidates filtered membership, counts, or ordering.

URL parameters are the source of truth for filters: initialize on load, update on selection, reset page on filter change, preserve back/forward behavior, and provide Clear filters. Query keys include authenticated user ID plus normalized filters. Logout clears the cache; switching accounts never reuses another user's rows.

## 11. Seed and setup experience

Build deterministic fixtures with relative dates at seed time:

- 1 Admin, 2 PMs, 4 Developers using distinct documented demo emails.
- At least 2 clients, 3 projects, and **at least 5 tasks per project** (15+ total).
- Projects spread across both PMs; tasks spread across all developers to expose isolation bugs.
- All four statuses and priorities represented, upcoming deadlines, completed tasks, and at least 2 persisted overdue tasks with valid past deadlines and non-Done status.
- Pre-existing actor/timestamp status events, assignment notifications, and a PM In Review notification; include read and unread examples.
- Load demo passwords from explicit seed environment variables and hash them. Document how to obtain the demo credentials without committing a real deployment secret.
- Make seed repeatable with stable identifiers/upserts. Do not silently truncate a production database; isolate destructive reset behind a clearly named local-only command.

### Planned pnpm scripts

After workspace migration, the root is the command entry point. These are scripts to implement, not a claim they exist already.

```bash
pnpm install
pnpm db:up                  # docker compose up -d db
pnpm db:generate            # generate Prisma client
pnpm db:migrate             # local development migrations
pnpm db:seed
pnpm dev                   # contracts watcher + frontend and backend
pnpm lint
pnpm typecheck
pnpm test                  # meaningful unit tests
pnpm test:integration      # isolated PostgreSQL database
pnpm test:e2e
pnpm build                 # contracts, backend, frontend in dependency order
pnpm start                 # built persistent API process
pnpm db:deploy             # committed migrations for deployed environment
```

Use `pnpm --filter @velozity/backend ...`, `pnpm --filter @velozity/frontend ...`, and `pnpm exec ...` for package-specific tools. No npm/yarn/npx commands or extra lockfiles in setup, Dockerfiles, CI, or README. Migrate the existing lockfile carefully to one workspace lockfile; inspect dependency/version changes before removing the nested file.

Environment examples: `DATABASE_URL`, `PORT`, `NODE_ENV`, `JWT_ACCESS_SECRET`, `JWT_ISSUER`, `JWT_AUDIENCE`, `ACCESS_TOKEN_TTL`, `REFRESH_TOKEN_TTL`, `FRONTEND_ORIGIN`, cookie configuration, `APP_TIMEZONE`, `OVERDUE_CRON`, and seed-password inputs. Frontend gets only public API/socket URL configuration. Validate server environment at startup; never expose secrets through `VITE_*`.

## 12. Implementation phases and completion gates

The deadline is close. The estimates below are focused-work budgets, not a delivery guarantee; adjust against the actual time remaining. Prioritize a demonstrable secure vertical slice before optional visual refinement. Do not remove an assessment requirement to preserve decoration.

### Phase 0 — Workspace foundation and deployment feasibility (1 hour)

- Record existing versions; establish root pnpm workspace/shared contracts while preserving the frontend.
- Add backend TypeScript build, validated configuration, structured errors, health routes, PostgreSQL Compose, env examples, and ignore rules.
- Decide deployment topology using Section 14. Verify production cookie path and WebSocket connectivity with a minimal authenticated prototype early.
- **Gate:** a fresh root install works; frontend and API start with pnpm; DB is reachable; hosting strategy does not assume immortal serverless timers.

### Phase 1 — Relational model and seed (1.5–2 hours)

- Implement enums, foreign keys, indexes, migrations, seed, and safe DTO contracts.
- Add the transaction/event sequence helper and repository scope conventions.
- **Gate:** migrate/seed an empty DB; verify 7 users, 3+ projects, 15+ tasks, overdue rows, historical events; re-seed without duplicates.

### Phase 2 — Authentication and authorization (2–3 hours)

- Implement password verification, access JWT, refresh cookie/rotation/replay detection, logout, role checks, ownership scopes, and session revocation.
- Add frontend login/session bootstrap, guarded routes, memory token handling, refresh synchronization.
- **Gate:** altered JWT rejected; PM A cannot access PM B; Developer A cannot read/update Developer B; expired access refreshes; replayed refresh fails; logout prevents further session use.

### Phase 3 — Core project/task vertical slice (2–3 hours)

- Build scoped project/task CRUD, safe client/developer lookups, task version checks, persisted activity, URL filters, and the base shell/table/form primitives.
- Build task detail/status controls. Implement Admin client/user management with role-change safeguards.
- **Gate:** Admin/PM can create and assign; Developer sees only own rows; status updates have stored actor/time; URL reload preserves filters; stale writes return 409.

### Phase 4 — Realtime and missed-event recovery (2.5–3 hours)

- Add authenticated WebSocket-only gateway, recipient resolution, current-policy checks, versioned task events, feed UI, reconnect replay, and access revocation.
- Add unique-user presence and Admin live count.
- **Gate:** three simultaneous role sessions show only eligible updates; a second PM receives no leaked payload; offline user receives latest 20 missed DB events after API restart; multiple tabs count as one user.

### Phase 5 — Notifications and overdue job (1.5–2 hours)

- Create notifications transactionally for assignment and entering In Review; add dropdown/read actions and socket-triggered authoritative counts.
- Implement recurring job, startup sweep, idempotence, state clearing, and scoped overdue events.
- **Gate:** both triggers survive refresh; unread count changes in another tab without polling; overdue is marked with browser closed; repeated ticks do not duplicate events.

### Phase 6 — Role dashboards and visual completion (2–3 hours)

- Implement scoped dashboard aggregates, PM weekly due list, Developer ordering, and Admin global activity.
- Apply all exact design tokens; finish responsive layout, accessible focus/forms/dropdowns, loading/error/empty states, timestamps, and connection states.
- **Gate:** aggregates match authorized DB fixtures; every task list supports URL filters; screenshots at mobile/tablet/desktop adhere to `UI.txt`.

### Phase 7 — Adversarial verification and release candidate (2–3 hours)

- Run the tests in Section 13; fix cross-role leaks, races, cookie failures, reconnect issues, and build defects first.
- Test a clean Docker setup and production build with the committed lockfile.
- **Gate:** CI lint/typecheck/build and core API/socket/E2E cases pass; no stack traces, leaked fields, secret files, or unsupported polling fallback.

### Phase 8 — Hosting, documentation, submission package (1.5–2 hours)

- Configure Vercel frontend and the chosen API/worker host, database migrations/seed, environment, health monitoring, and production smoke tests.
- Complete README, schema, tradeoffs, limitations, public repository/live-link checklist, and an honest 150–250 word explanation based on implemented work.
- **Gate:** external browser can log in as all roles; secure refresh, live updates, background overdue marking, and refresh/deep links work on the deployed URLs.

**Approximate budget: 16–22 focused hours.** If time compresses, remove optional charts, elaborate motion, extra filtering dimensions, and cosmetic secondary screens before cutting required role management, realtime recovery, security tests, or README/setup. Basic accessible Admin forms are sufficient; permission correctness is not optional.

## 13. Verification matrix

Use a separate real PostgreSQL test database with migrations. Mocked repositories alone cannot verify constraints, transactions, or scoping. Inject a clock into overdue/date services; do not make tests wait a real minute.

| Area | Required checks |
| --- | --- |
| Authentication | Valid/invalid login, inactive user, expired/forged token, cookie flags, rotation, replay, concurrent refresh, logout, revoked socket |
| API scope | Every protected route requires identity; PM cross-project list/detail/write/feed denied; developer cross-task read/write/history denied; body role/creator injection rejected |
| Aggregate privacy | PM totals exclude other PM; Developer lists/counts expose no other assignments; unauthorized filters do not widen scope |
| Transaction integrity | Failed mutation writes no event/notification; one status change writes exactly one log; concurrent versions conflict; no-op emits nothing |
| Realtime isolation | Inspect actual socket payloads for Admin, two PMs, two Developers; unauthorized join denied; token expiry and reassignment revoke access |
| Catch-up | 0, 1, 20, 25 missed events; newest 20 selected; dedupe overlapping live event; query failure preserves cursor; process restart replay; concurrent writers preserve cursor semantics |
| Notifications | Assignment and In Review triggers; individual/all read ownership; cross-tab badge; retry dedupe; new event during mark-all remains unread; reassignment removes inaccessible links |
| Overdue | Past/future/boundary deadlines; Done excluded; archived excluded; repeated sweep; completion race; reopen; startup recovery with no page request |
| Presence | Two tabs count once; last-tab close and timeout remove user; Admin-only payload; reconnect does not inflate count |
| Filters | Status/priority/range combinations; timezone boundary; invalid range; empty result; pagination; shared URL and browser back/forward |
| UI | Keyboard-only login/filter/dialog/notification flow; visible focus; readable contrast; mobile task access; loading/error/empty/conflict states |
| Setup/release | Clean pnpm frozen install, migration+seed, lint/typecheck/build, real deployed cookie and WSS tests |

Use bounded acknowledgement/event waits in socket tests, not arbitrary long sleeps. Playwright's multi-context test should act as PM A, Developer A, and PM B simultaneously and assert both delivery and non-delivery after an acknowledged mutation.

CI should start PostgreSQL, install with `pnpm install --frozen-lockfile`, generate contracts/Prisma, apply test migrations, and run lint/typecheck/unit/integration/build. Run the critical multi-role browser flow against built services. Avoid snapshotting every CSS class; test behavior and review representative screenshots.

## 14. Deployment design and unresolved hosting interpretation

The PDF requires a live application on Vercel and node-cron or Bull for the overdue scheduler. **Do not use the outdated blanket assumption that Vercel cannot serve WebSockets.** Current official documentation describes WebSocket beta support, including Express/Socket.IO, with Fluid compute, finite connection duration, and external coordination across instances. See [Vercel WebSocket documentation](https://vercel.com/docs/functions/websockets) (reviewed 11 September 2026).

### Recommended assessment deployment

- Host the React frontend on Vercel and submit its HTTPS URL.
- Run the Express API, Socket.IO gateway, and node-cron in one persistent Node container on a host that supports an always-running process. Select the provider during Phase 0 after checking actual availability, cost, WSS upgrades, health checks, and sleep policy; do not assume a free instance stays awake.
- Use managed PostgreSQL near the API; use TLS, bounded connection pooling, and a separate migration step.
- Prefer same-origin `/api` REST proxying from Vercel to the backend so the refresh cookie is first-party. The WebSocket URL can point directly to the backend with access-token handshake and allowed-origin checks. Test Set-Cookie forwarding, paths, HTTPS, refresh/logout, and API error responses through that exact proxy.
- Build frontend from the workspace root with `pnpm --filter @velozity/frontend build` after shared contracts. Set output to `frontend/dist`; ensure API rewrites precede SPA fallback and support refreshing task detail URLs.
- Set the backend instance count to one for the baseline's presence/room model. Migration and seed are explicit release operations, not per-instance startup actions.

**Interpretation to flag:** this places the user-facing application on Vercel but its stateful backend elsewhere. The PDF does not explicitly say whether every component must be hosted on Vercel. Record the topology clearly; resolve this with the assessor before final deployment if their interpretation requires all application compute there. Planning and local implementation can continue without that clarification.

### If all application API/WebSocket compute must be on Vercel

Treat this as a separate hosting adaptation, not a configuration toggle. Prototype Express/Socket.IO using the documented Vercel entry point; keep WebSocket-only transport; test forced duration reconnects. Add shared room/event coordination and expiring presence across instances. PostgreSQL remains the authoritative store for application data; any Redis infrastructure would be supplementary coordination only and should be checked against the brief's “no NoSQL” wording. An always-running node-cron worker still needs a supported execution environment; a timer inside a short-lived request handler is not a scheduler. If the assessor requires literally every process on Vercel, clarify how their node-cron/Bull requirement is intended to be satisfied before selecting this route.

### Release checks

- Frontend URL, API health, WSS handshake, refresh cookie, secure logout, CORS/Origin rules, and SPA deep links verified in a real browser.
- Seed an isolated demo environment, inspect its counts, and provide evaluator credentials securely/documentedly; do not commit real passwords or JWT/database secrets.
- Verify updates across two browsers and a reconnect after forced disconnect; verify scheduled overdue processing without a browser request.
- Graceful shutdown closes sockets, scheduler, HTTP listener, and Prisma. Log request IDs and job health without credentials.
- Record rollback steps for application release; review migration compatibility before rollback. Do not reset the deployed database to recover a UI failure.

## 15. README and final handoff checklist

README should explain the product and role workflows first, then provide exact pnpm/Docker setup, environment variables, seed credentials procedure, scripts, schema diagram, index rationale, and testing instructions. Include decisions for Express, Socket.IO WebSocket-only transport, node-cron, token storage/rotation, current-access feed filtering, replay cursor strategy, and single-instance hosting.

Known limitations to state if still true: single API instance, approximately one-minute overdue delay, latest-20 reconnect window with older history pagination, serialized event writes, no durable post-commit live-delivery outbox, no email/password-reset workflow, and split hosting interpretation. Do not list unimplemented features as working.

Final explanation (150–250 words) should be written after implementation, covering the actual hardest problem, exact role-filtered realtime/recovery approach, and one concrete future improvement such as a transactional outbox with scalable fan-out. Check word count before using it.

- [ ] All assessment features mapped to implementation and verification evidence.
- [ ] Both application layers TypeScript; Express backend; pnpm everywhere.
- [ ] JWT access + working rotated HttpOnly refresh token; no secrets in tracked files.
- [ ] Every protected API operation and socket subscription/delivery enforces role and ownership.
- [ ] Stored activity with actor/time; latest 20 missed events loaded from DB.
- [ ] Scheduled persisted overdue flag; correct notifications and live unread count.
- [ ] All role dashboards, distinct-user live presence, shareable task filters.
- [ ] Exact brutalist palette; responsive, accessible, complete interaction states.
- [ ] Repeatable seed: 1 Admin, 2 PMs, 4 Developers, 3+ projects, 5+ tasks each, 2+ overdue tasks, prior activity.
- [ ] Clean setup, meaningful tests, production build, deployed smoke checks.
- [ ] Public repository and Vercel live link prepared during release, not during this planning task.
- [ ] README decisions/indexes/schema/limitations and 150–250 word explanation complete.
- [ ] Submission is performed only as a separate authorized action after reviewing the finished application.
