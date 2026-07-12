# AssetFlow — Two-Developer Split

## The Split Philosophy

Split by **layer + module ownership**, not by "screens." Each dev owns complete vertical slices (route → controller → service → frontend page) so neither is blocked waiting for the other's API to exist.

| | **Dev A — "State & Workflows"** | **Dev B — "Resources & Visibility"** |
|---|---|---|
| **Core focus** | Auth, Org Setup, Allocation/Transfer, Maintenance, Audits | Asset Registration, Booking Engine, Dashboard, Notifications/Logs, Reports, AI/Voice |
| **DB strength** | Heavy Postgres transactions, `SELECT FOR UPDATE`, state machine | Postgres `tsrange` + `EXCLUDE USING gist`, MongoDB writes, Redis cache |
| **Why this split** | All the approval workflows + RBAC scope checks live here | All the real-time visibility + conflict-at-DB-layer logic lives here |

---

## Phase 0 — Foundation (TOGETHER, ~2-3 hrs)

> [!IMPORTANT]
> **Both devs sit together for this phase.** The schema contract, folder structure, and middleware are shared code — disagreements here compound for the rest of the build. Don't split up until Phase 0 is fully green.

| # | Task | Who |
|---|---|---|
| 0.1 | Scaffold Express backend (npm init, folder structure, dotenv, cors, helmet) | Dev A |
| 0.2 | Scaffold React frontend (Vite + Tailwind + React Router) | Dev B |
| 0.3 | Prisma schema → `prisma migrate dev` → hand-edit migration (exclusion constraint, sequences, CHECK constraints) | **Together** — this IS the contract |
| 0.4 | MongoDB connection + Notification/ActivityLog Mongoose schemas | Dev B |
| 0.5 | Redis connection (cache + session + pub/sub) | Dev B |
| 0.6 | Auth middleware: JWT verify, Redis session lookup, `requireRole()` + scope checks | Dev A |
| 0.7 | Error handler (catches Postgres 23P01, formats JSON errors) | Dev A |
| 0.8 | Rate limiter + input sanitizer | Dev A |
| 0.9 | `core/assetStateMachine.js` — centralized transition function | **Together** — both devs will call this |
| 0.10 | `core/eventBus.js` — Node EventEmitter for internal events | **Together** — agree on event shape |
| 0.11 | Seed script (2 depts, 3 categories, 5 users, 5 assets) | Dev B |
| 0.12 | Frontend: AuthContext, ProtectedRoute, axios instance with JWT interceptor, Sidebar/Layout | Dev B |

### ✅ Phase 0 — Sync Checkpoint

Before splitting up, **both devs verify**:
- [ ] `npm run dev` starts Express on port 5000, no errors
- [ ] `npm run dev` starts Vite on port 5173, no errors
- [ ] Postgres: all 11 tables exist, exclusion constraint on bookings works
- [ ] MongoDB: connection healthy, test insert to notifications works
- [ ] Redis: `SET/GET` works, pub/sub test works
- [ ] `npm run seed` populates all test data
- [ ] `assetStateMachine.js` exported and importable by both modules
- [ ] Event shape agreed (see contract below)

---

## Shared Contracts (Agree Before Splitting)

### Event Shape (every module emits these)

```javascript
// Both devs emit events in this exact shape. 
// Dev B's notification handler consumes ALL of them uniformly.
eventBus.emit('entity.action', {
  type: 'asset.allocated',        // entity.verb
  actorId: 5,                      // who did it
  actorName: 'Raj Kumar',
  entityType: 'allocation',        // what was affected
  entityId: 12,
  relatedAssetId: 7,               // optional: for asset-linked events
  departmentId: 2,                 // optional: for scope-based notifications
  data: { ... },                   // event-specific payload
  timestamp: new Date().toISOString()
});
```

### API Response Format (every endpoint follows this)

```javascript
// Success
{ success: true, data: { ... }, message: "Asset allocated successfully" }

// Error
{ success: false, error: { code: "CONFLICT", message: "Asset currently held by Priya", details: { ... } } }

// List with pagination
{ success: true, data: [...], pagination: { page: 1, limit: 20, total: 47, totalPages: 3 } }
```

### Asset Status Values (from the state machine — both devs use these exact strings)
```
'available', 'allocated', 'reserved', 'under_maintenance', 'lost', 'retired', 'disposed'
```

---

## Phase 1 — Auth + Org Setup + Asset Registration

> After Phase 0, **devs split.** Each works independently on their vertical slice.

### Dev A — Auth + Org Setup (Screen 1, 3)

| # | Task | Notes |
|---|---|---|
| 1A.1 | `modules/auth/` — signup (employee-only, role hardcoded), login (JWT), forgot-password, reset-password, refresh token, `GET /me` | Password hashing with bcrypt, JWT access+refresh |
| 1A.2 | `modules/departments/` — CRUD + assign-head | Edge cases: D1 (circular check), D2 (deactivation check), D3 (old head role reset) |
| 1A.3 | `modules/categories/` — CRUD | Simple, but validate name uniqueness |
| 1A.4 | `modules/employees/` — directory (list/filter) + `POST /:id/promote` | **This is the ONLY endpoint that writes role.** Edge cases: A1 (role_version++), A2 (last admin check) |
| 1A.5 | Frontend: Login page + Signup page | Polished UI, form validation, error states |
| 1A.6 | Frontend: Org Setup page (3 tabs: Departments, Categories, Employee Directory) | Tab navigation, forms, tables, promote button with role dropdown |

### Dev B — Asset Registration (Screen 4)

| # | Task | Notes |
|---|---|---|
| 1B.1 | `modules/assets/` — register (auto-tag via `nextval('asset_tag_seq')`), CRUD, search/filter | Filters: tag, serial, category, status, dept, location. Pagination. |
| 1B.2 | Asset history endpoint: `GET /api/assets/:id/history` — UNION of allocation + maintenance records | Sorted by date desc |
| 1B.3 | Photo upload: Multer endpoint with file validation (jpeg/png/webp/pdf, max 5MB, UUID rename) | Edge case: AS4 (malicious files) |
| 1B.4 | Frontend: Asset registration form | Category dropdown (from API), is_bookable toggle, photo upload |
| 1B.5 | Frontend: Asset directory with search/filter/pagination | DataTable component (reusable), filter bar |
| 1B.6 | Frontend: Asset detail page with history timeline | Status badge, allocation history, maintenance history |

### ✅ Phase 1 — Sync Checkpoint

Both devs pull each other's code and verify:
- [ ] Dev A: Login → get JWT → access protected route → works
- [ ] Dev A: Create dept → create category → promote employee → all work with proper RBAC
- [ ] Dev B: Register asset → auto-tag AF-0001 → search by tag → works
- [ ] Dev B: Upload photo → file saved → URL returned → works
- [ ] **Integration test**: Login (Dev A's code) → Register asset (Dev B's code) → works end-to-end
- [ ] Seed data still works after both devs' migrations

---

## Phase 2 — Conflict Engines (Screens 5, 6) ⭐ Parallel — highest judging weight

> This is where the split pays off. Both devs build their conflict engine simultaneously, independently.

### Dev A — Allocation + Transfer Engine (Screen 5)

| # | Task | Notes |
|---|---|---|
| 2A.1 | `modules/allocations/allocations.service.js` — the conflict check | Uses `SELECT ... FOR UPDATE` row lock inside transaction. Checks `asset.status = 'available'`. Partial unique index `idx_one_active_allocation` is the DB safety net. |
| 2A.2 | `POST /api/allocations` — allocate | On conflict: return **409** with `{ currentHolder: "Priya", department: "Engineering", allocatedSince: "2026-03-15", transferRequestUrl: "/api/transfers" }`. This 409 response is the key UX detail. |
| 2A.3 | `POST /api/allocations/:id/return` — return flow | Capture condition + notes. If `return_condition = 'damaged'` → response includes `suggestMaintenance: true`. Call `transitionAssetStatus → 'available'`. |
| 2A.4 | `POST /api/transfers` — create transfer request | Validate: asset is currently allocated, to_user ≠ from_user, asset not under maintenance |
| 2A.5 | `PUT /api/transfers/:id/approve` — approve transfer | Single transaction: close old allocation → open new allocation → emit event. Re-check allocation.status before approval (edge case AL6). |
| 2A.6 | `PUT /api/transfers/:id/reject` — reject | Simple status update + notification |
| 2A.7 | Overdue cron: `jobs/overdueScanner.js` | Runs every 15 min. `UPDATE allocations SET status='overdue' WHERE expected_return_date < NOW() AND status='active'`. Emits `allocation.overdue` events. |
| 2A.8 | Edge cases: AL1-AL10 | Race condition, inactive user, idempotency key, bookable block, dept scope check |
| 2A.9 | Frontend: Allocation page | Allocate form → on 409: show "Currently held by Priya" + Transfer Request button. Transfer request list with approve/reject (for managers). Return form with condition dropdown. |

### Dev B — Booking Engine (Screen 6)

| # | Task | Notes |
|---|---|---|
| 2B.1 | `modules/bookings/bookings.service.js` — the INSERT-and-catch pattern | **Do NOT pre-check with SELECT.** Just INSERT. Catch Postgres error `23P01` (exclusion violation) → return 409 with conflicting booking info. The DB constraint IS the validation. |
| 2B.2 | `POST /api/bookings` — create booking | Validate: `start_time >= NOW()`, `asset.is_bookable = TRUE`, `asset.status != 'under_maintenance'`. Then INSERT. On 23P01 → 409 with `{ conflictingBooking: { bookedBy: "Priya", time: "9:00-10:00" } }`. |
| 2B.3 | `GET /api/bookings?asset_id=X&date=Y` — calendar data | Return all bookings for a resource on a given date/week. Frontend renders calendar. |
| 2B.4 | `PUT /api/bookings/:id/cancel` | Mark cancelled. If ongoing → still allow (logged in activity). |
| 2B.5 | `PUT /api/bookings/:id/reschedule` | Cancel old + create new in **one transaction**. If new slot overlaps → rollback both. |
| 2B.6 | Cron: `jobs/bookingStatusUpdater.js` | Runs every 5 min. `upcoming → ongoing` when `start_time <= NOW()`. `ongoing → completed` when `end_time <= NOW()`. |
| 2B.7 | Edge cases: B1-B8 | Adjacent bookings ([) half-open), past booking block, non-bookable asset, max duration |
| 2B.8 | Frontend: Booking page | Calendar/timeline view of resource bookings. Booking form with time picker. On 409: show "Conflicts with Priya's booking 9:00-10:00". Cancel/reschedule buttons. |

### ✅ Phase 2 — Sync Checkpoint (CRITICAL — both engines must work before proceeding)

**Both devs demo to each other:**
- [ ] **Dev A's Priya/Raj demo**: Allocate laptop to Priya → try allocating same to Raj → 409 with holder info → create Transfer Request → approve → Raj now holds it → history updated
- [ ] **Dev B's Room B2 demo**: Book 9:00–10:00 → try 9:30–10:30 → rejected with conflict info → try 10:00–11:00 → accepted (adjacent, no overlap)
- [ ] Both devs' events emit in the agreed shape (Dev B will consume these in Phase 3)
- [ ] `transitionAssetStatus()` called correctly by both modules
- [ ] Overdue scanner running (Dev A) + booking status updater running (Dev B)

---

## Phase 3 — Maintenance + Notifications/Dashboard

### Dev A — Maintenance Workflow (Screen 7)

| # | Task | Notes |
|---|---|---|
| 3A.1 | `modules/maintenance/` — raise request | Validate: asset not disposed/retired, no active request for same asset (M1), holder can raise for own asset only |
| 3A.2 | `PUT /approve` — approve | **Save `asset.status` as `previous_asset_status` on the maintenance record.** Then `transitionAssetStatus → 'under_maintenance'`. If asset is bookable → emit event (Dev B's handler auto-cancels bookings). |
| 3A.3 | `PUT /reject` — reject | No asset status change. Notification to requester. |
| 3A.4 | `PUT /assign-technician` — assign tech | Status → 'assigned'. |
| 3A.5 | `PUT /resolve` — resolve | `transitionAssetStatus → previous_asset_status` (NOT blindly 'available'). If was allocated → stays allocated. |
| 3A.6 | Frontend: Maintenance page | Raise form (select asset, describe issue, priority, photo). Workflow cards: Pending → Approved → Assigned → In Progress → Resolved. |

### Dev B — Notifications + Activity Logs + Dashboard (Screens 2, 10)

| # | Task | Notes |
|---|---|---|
| 3B.1 | Event handlers in `modules/notifications/` — listen to eventBus → write Mongo notification | Must handle ALL event types from both devs: `asset.allocated`, `asset.returned`, `transfer.approved`, `maintenance.approved`, `booking.created`, `booking.cancelled`, `allocation.overdue`, etc. |
| 3B.2 | **Retrofit**: ensure all Phase 1-2 modules emit events after Postgres commits | Go through Dev A's allocation/transfer code + own booking code → add `eventBus.emit()` after every successful write. **Mongo write must be AFTER Postgres commit, never inside the transaction.** |
| 3B.3 | `GET /api/notifications` — paginated, sorted by createdAt desc | Mark read: `PUT /api/notifications/:id/read`, `PUT /api/notifications/read-all` |
| 3B.4 | `activityLogger.js` middleware — auto-captures all state-changing requests | Intercepts POST/PUT/DELETE, logs to Mongo ActivityLog with before/after snapshot. |
| 3B.5 | `GET /api/activity-logs` — filterable by entity/actor, paginated | |
| 3B.6 | `GET /api/dashboard/kpis` — SQL aggregates + Redis cache | `COUNT(*) FILTER (WHERE status = 'available')`, etc. Cache in Redis, TTL 60s. Read cache first. |
| 3B.7 | `GET /api/dashboard/overdue` — overdue allocations + upcoming returns | Separate query, not cached (must be real-time). |
| 3B.8 | Socket.io setup — subscribe to Redis pub/sub → push to client | When notification is created → publish to `notifications:{userId}` Redis channel → Socket.io pushes to connected client. |
| 3B.9 | Handle `maintenance.approved` event for bookable assets | If asset is bookable → query upcoming bookings → cancel each → emit `booking.cancelled` notification to affected users. |
| 3B.10 | Notification batching for bulk operations | Audit close (Phase 4) will trigger many status changes. Batch into one notification: "Audit #5 closed: 3 assets marked Lost." |
| 3B.11 | Frontend: Dashboard | KPI cards (animated counters), overdue section (highlighted), quick action buttons (Register Asset, Book Resource, Raise Maintenance). Role-based: Admin sees org-wide, Dept Head sees dept-only, Employee sees own. |
| 3B.12 | Frontend: Notifications page | Real-time (Socket.io). Bell icon with unread count in navbar. Notification list with read/unread styling. |
| 3B.13 | Frontend: Activity Log page | Filterable table. Who did what, when. |

### ✅ Phase 3 — Sync Checkpoint

- [ ] Maintenance workflow end-to-end: raise → approve → status flips → resolve → status restores
- [ ] Notifications appear for: allocation, return, transfer, maintenance, booking, overdue
- [ ] Dashboard KPIs are correct after running through all workflows
- [ ] Socket.io: notification appears in real-time without page refresh
- [ ] Bookable asset maintenance: approve → upcoming bookings auto-cancelled → bookers notified
- [ ] Activity log captures all state-changing actions from both devs' modules

---

## Phase 4 — Audits + Reports (Screens 8, 9)

### Dev A — Audit Cycles (Screen 8)

| # | Task | Notes |
|---|---|---|
| 4A.1 | `POST /api/audit-cycles` — create cycle (scope, date range) | Edge case AU1: check no overlapping open/in_progress cycle for same scope |
| 4A.2 | `POST /api/audit-cycles/:id/assign-auditors` | Assign one or more. Validate users exist and are active. |
| 4A.3 | Auto-populate audit items: query all assets matching scope → create AuditItem rows | If scope_type='department' → all assets in that dept. If 'location' → all assets at that location. |
| 4A.4 | `GET /api/audit-cycles/:id/items` — paginated (50/page) with progress | `{ items: [...], progress: { total: 200, verified: 47, missing: 3, damaged: 1, pending: 149 } }` |
| 4A.5 | `PUT /api/audit-items/:id` — mark result | Only assigned auditors can mark (RBAC). Result: verified/missing/damaged + notes. |
| 4A.6 | `POST /api/audit-cycles/:id/close` — atomic close | Single transaction: lock cycle → check pending items (offer force-close) → for each `missing` item → `transitionAssetStatus → 'lost'` → generate discrepancy report → set status='closed'. Emit `audit.closed` event (Dev B batches notifications). |
| 4A.7 | `GET /api/audit-cycles/:id/report` — discrepancy report | All items with result = 'missing' or 'damaged'. Includes asset details, auditor who flagged, notes. |
| 4A.8 | Edge cases: AU2-AU5 | Pending items on close, new asset during audit (auto-add), no re-open |
| 4A.9 | Frontend: Audit page | Create cycle form. Assign auditors. Audit marking grid (checkbox/dropdown per asset). Progress bar. Discrepancy report view. Close button with confirmation. |

### Dev B — Reports & Analytics (Screen 9)

| # | Task | Notes |
|---|---|---|
| 4B.1 | `GET /api/reports/utilization` — most-used vs idle assets | Based on allocation duration + booking frequency. Idle = available for > 30 days with no allocation/booking. |
| 4B.2 | `GET /api/reports/maintenance-frequency` — by asset and category | Count of maintenance requests per asset. Aggregated by category. |
| 4B.3 | `GET /api/reports/department-allocation` — dept-wise summary | Assets per dept, allocated vs available ratio, overdue count. |
| 4B.4 | `GET /api/reports/booking-heatmap` — peak usage windows | Group bookings by hour-of-day and day-of-week. Returns grid data for heatmap chart. |
| 4B.5 | `GET /api/reports/export?type=utilization&format=csv` — CSV export | Use `json2csv` or manual CSV generation. Set `Content-Type: text/csv` + `Content-Disposition: attachment`. |
| 4B.6 | Frontend: Reports page | Chart.js or Recharts for visualizations. Tabs: Utilization, Maintenance, Allocation, Booking Heatmap. Export button per report. |

### ✅ Phase 4 — Sync Checkpoint

- [ ] Full audit cycle: create → assign → mark all items → close → Lost assets updated → discrepancy report generated
- [ ] `audit.closed` event triggers batch notification (Dev B's handler)
- [ ] Reports show correct data from all previous phases
- [ ] CSV export downloads correctly

---

## Phase 5 — AI + Voice (Differentiators)

### Dev A — AI Service + Backend Integration

| # | Task | Notes |
|---|---|---|
| 5A.1 | `services/ai.service.js` — Gemini API wrapper | Single module, all AI features route through here |
| 5A.2 | NL asset search: `POST /api/ai/search` | Accepts natural language query → Gemini parses to structured filters → execute SQL → return results |
| 5A.3 | Predictive maintenance scoring: `GET /api/ai/maintenance-risk/:assetId` | Gather: asset age, condition, maintenance history, category avg → Gemini analysis → risk score 0-100 + reasoning. Cache in Redis (TTL 24h). |
| 5A.4 | Audit anomaly detection: `GET /api/ai/audit-insights/:cycleId` | After cycle close → Gemini analyzes results + historical data → flags anomalies |
| 5A.5 | Report summarization: `GET /api/ai/report-summary?type=utilization` | Aggregate data → Gemini → executive summary text |

### Dev B — Voice Bot + Frontend AI Integration

| # | Task | Notes |
|---|---|---|
| 5B.1 | `hooks/useVoice.js` — Web Speech API hook | SpeechRecognition for STT, SpeechSynthesis for TTS. Handles listening state, transcript. |
| 5B.2 | Voice command processor — Gemini NLU | Transcript → Gemini parses intent + entities → route to correct API → format response as spoken text |
| 5B.3 | All 7 voice intents working | Asset lookup, book resource, check availability, dashboard summary, raise maintenance, my assets, overdue check |
| 5B.4 | Floating mic button UI component | Bottom-right, pulses when listening, shows transcript, Ctrl+Shift+V shortcut |
| 5B.5 | Frontend: AI search bar on Assets page | NL input → calls `POST /api/ai/search` → renders results |
| 5B.6 | Frontend: "At Risk" card on Dashboard | Calls predictive maintenance → shows top 5 at-risk assets |
| 5B.7 | Frontend: AI Insights section in Audit discrepancy report | Calls anomaly detection → renders insights below the report table |
| 5B.8 | Frontend: Executive summary on Reports pages | Calls report summarization → renders at top of each report |
| 5B.9 | Smart booking suggestions: "I need a projector for 2 hours tomorrow" | Gemini parses → query available projectors → suggest best slots |

---

## Phase 6 — Polish & Demo Prep (TOGETHER)

| # | Task | Who |
|---|---|---|
| 6.1 | UI polish: animations, hover effects, loading states, error states | Dev B |
| 6.2 | Responsive design check (tablet + mobile) | Dev B |
| 6.3 | State machine diagram visible in UI (Asset detail page) | Dev A |
| 6.4 | Seed script update: demo-ready data (Priya, Raj, Room B2, laptop AF-0114) | Dev A |
| 6.5 | Demo script rehearsal — both devs walk through the 11-step verification | **Together** |
| 6.6 | "Why 3 databases" slide / README section | **Together** |
| 6.7 | Final integration test: full workflow end-to-end | **Together** |

---

## Dependency Map: "Who's Blocked If The Other Is Late?"

```
Phase 0:  TOGETHER ──────────────────────────────────────────────────────
                        │
Phase 1:  Dev A: Auth + Org Setup    │    Dev B: Asset Registration
               │                      │           │
               │    (Dev B needs Auth  │           │
               │     middleware from A) │           │
               ▼                      ▼           ▼
Phase 2:  Dev A: Allocation Engine   │    Dev B: Booking Engine
               │                      │           │
               │  (INDEPENDENT — no    │           │
               │   cross-dependency!)  │           │
               ▼                      ▼           ▼
Phase 3:  Dev A: Maintenance         │    Dev B: Notifications + Dashboard
               │                      │           │
               │    (Dev B needs       │           │
               │     events from A's   │           │
               │     maintenance code) │           │
               ▼                      ▼           ▼
Phase 4:  Dev A: Audits              │    Dev B: Reports
               │                      │           │
Phase 5:  Dev A: AI Backend          │    Dev B: Voice + AI Frontend
               ▼                      ▼           ▼
Phase 6:  TOGETHER ──────────────────────────────────────────────────────
```

### Critical Dependencies

| If Dev A is late on... | Dev B is blocked on... | Workaround |
|---|---|---|
| Auth middleware (Phase 0.6) | Everything after login | Dev B mocks auth with a hardcoded JWT for development. Replace with real auth later. |
| Allocation events (Phase 2) | Notification handler for allocations | Dev B builds handler for booking events first (own code). Adds allocation event handling after Dev A delivers. |
| Maintenance events (Phase 3) | Bookable asset auto-cancel logic | Dev B stubs the handler. Fills in when Dev A's maintenance code is ready. |

| If Dev B is late on... | Dev A is blocked on... | Workaround |
|---|---|---|
| Asset registration API (Phase 1) | Allocation (needs assets to allocate) | Dev A uses seeded assets from Phase 0.11. Dev B's API is nice-to-have for creating new ones. |
| Dashboard (Phase 3) | Nothing — Dev A doesn't depend on dashboard | No workaround needed. |
| Notifications (Phase 3) | Nothing — Dev A emits events, doesn't consume them | No workaround needed. |

> [!TIP]
> **Dev A is the critical path.** Auth middleware and allocation events are upstream dependencies for Dev B. Dev B's work is mostly downstream (consuming events, displaying data). If anyone needs to move faster in Phase 0-1, it's Dev A.

---

## Git Branching Strategy

```
main
 ├── dev-a/phase-1-auth
 ├── dev-a/phase-2-allocation
 ├── dev-a/phase-3-maintenance
 ├── dev-a/phase-4-audits
 ├── dev-b/phase-1-assets
 ├── dev-b/phase-2-booking
 ├── dev-b/phase-3-dashboard
 ├── dev-b/phase-4-reports
 └── ...
```

**Rules:**
1. Each phase = one branch per dev
2. Merge to `main` at each sync checkpoint (after both devs verify)
3. Never push directly to `main`
4. If you need something from the other dev mid-phase → they merge their branch to `main` first, you pull `main`

**Sync merge order at each checkpoint:**
1. Dev A merges first (upstream dependency)
2. Dev B pulls `main`, resolves any conflicts, then merges

---

## Daily Schedule (If 3-Day Hackathon)

### Day 1

| Time | Dev A | Dev B |
|---|---|---|
| **Hour 1-3** | **TOGETHER: Phase 0** | **TOGETHER: Phase 0** |
| **Hour 3** | **✅ Sync: Phase 0 checkpoint** | **✅ Sync: Phase 0 checkpoint** |
| **Hour 3-6** | Phase 1: Auth + Org Setup | Phase 1: Asset Registration |
| **Hour 6** | **✅ Sync: Phase 1 checkpoint** | **✅ Sync: Phase 1 checkpoint** |
| **Hour 6-9** | Phase 2: Allocation Engine | Phase 2: Booking Engine |
| **Hour 9** | **✅ Sync: Phase 2 checkpoint** | **✅ Sync: Phase 2 checkpoint** |

> [!WARNING]
> **End of Day 1 target**: Both conflict engines working. This is the minimum viable demo. Everything after this is value-add.

### Day 2

| Time | Dev A | Dev B |
|---|---|---|
| **Hour 1-4** | Phase 3: Maintenance Workflow | Phase 3: Notifications + Dashboard |
| **Hour 4** | **✅ Sync: Phase 3 checkpoint** | **✅ Sync: Phase 3 checkpoint** |
| **Hour 4-8** | Phase 4: Audit Cycles | Phase 4: Reports |
| **Hour 8** | **✅ Sync: Phase 4 checkpoint** | **✅ Sync: Phase 4 checkpoint** |

### Day 3

| Time | Dev A | Dev B |
|---|---|---|
| **Hour 1-4** | Phase 5: AI Backend | Phase 5: Voice Bot + AI Frontend |
| **Hour 4-6** | **TOGETHER: Phase 6 — Polish + Demo Prep** | **TOGETHER: Phase 6 — Polish + Demo Prep** |
| **Hour 6** | **🎯 DEMO** | **🎯 DEMO** |

---

## Quick Reference: Who Owns What

### Dev A's Files
```
server/src/modules/auth/           ← owns completely
server/src/modules/departments/    ← owns completely
server/src/modules/categories/     ← owns completely
server/src/modules/employees/      ← owns completely
server/src/modules/allocations/    ← owns completely
server/src/modules/maintenance/    ← owns completely
server/src/modules/audits/         ← owns completely
server/src/middleware/auth.js      ← owns
server/src/middleware/requireRole.js ← owns
server/src/middleware/errorHandler.js ← owns
server/src/middleware/rateLimiter.js ← owns
server/src/jobs/overdueScanner.js  ← owns
server/src/services/ai.service.js  ← owns
client/src/pages/Login/            ← owns
client/src/pages/OrgSetup/         ← owns
client/src/pages/Allocations/      ← owns
client/src/pages/Maintenance/      ← owns
client/src/pages/Audits/           ← owns
```

### Dev B's Files
```
server/src/modules/assets/         ← owns completely
server/src/modules/bookings/       ← owns completely
server/src/modules/notifications/  ← owns completely
server/src/modules/dashboard/      ← owns completely
server/src/modules/reports/        ← owns completely
server/src/config/mongo.js         ← owns
server/src/config/redis.js         ← owns
server/src/models/mongo/           ← owns
server/src/middleware/activityLogger.js ← owns
server/src/jobs/bookingStatusUpdater.js ← owns
server/prisma/seed.js              ← owns
client/src/components/             ← owns (shared UI)
client/src/context/                ← owns
client/src/hooks/                  ← owns
client/src/pages/Assets/           ← owns
client/src/pages/Bookings/         ← owns
client/src/pages/Dashboard/        ← owns
client/src/pages/ActivityLogs/     ← owns
client/src/pages/Reports/          ← owns
```

### Shared Files (BOTH edit, coordinate)
```
server/src/core/assetStateMachine.js   ← agreed in Phase 0, rarely changed after
server/src/core/eventBus.js            ← agreed in Phase 0, rarely changed after
server/src/app.js                      ← both add routes (use separate route imports)
server/prisma/schema.prisma            ← locked after Phase 0 (schema changes need sync)
client/src/App.jsx                     ← both add page routes
```

---

## The Golden Rule

> **If you need to change a shared file or the Prisma schema after Phase 0, TELL the other dev first.** A schema migration that one dev doesn't know about will break the other's seeded database. Communicate the change → both run `prisma migrate dev` → both re-seed → continue.
