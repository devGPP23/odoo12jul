# AssetFlow — Enterprise Asset & Resource Management System

## Architecture

**Polyglot persistence** — three databases, each earning its place:

| Store | What lives there | Why |
|---|---|---|
| **PostgreSQL** (Prisma) | Departments, Employees, Assets, Allocations, Transfers, Bookings, Maintenance, Audits | Relational integrity, transactions, `EXCLUDE USING gist` for booking overlaps |
| **MongoDB** (Mongoose) | Notifications, Activity Logs | High-write, schema-loose, no FK needed |
| **Redis** (ioredis) | Dashboard KPI cache, session blacklist, real-time pub/sub | Sub-ms reads, TTL for tokens, Socket.io bridge |

## Quick Start

```bash
# 1. Copy env and fill in your DB credentials
cp .env.example .env

# 2. Install dependencies
cd server && npm install

# 3. Generate Prisma client
npx prisma generate

# 4. Run migrations
npx prisma migrate dev

# 5. Apply manual constraints (booking overlap, allocation uniqueness)
#    Connect to your Postgres DB and run:
#    server/prisma/migrations/manual_constraints/migration.sql

# 6. Seed the database (creates Admin + demo data)
node prisma/seed.js

# 7. Start the server
npm run dev
```

## Default Credentials (from seed)

| Role | Email | Password |
|---|---|---|
| Admin | admin@assetflow.com | admin123 |
| Asset Manager | manager@assetflow.com | manager123 |
| Department Head | enghead@assetflow.com | head123 |
| Employee | priya@assetflow.com | employee123 |

## API Endpoints

### Auth
- `POST /api/auth/signup` — Employee-only (role hardcoded)
- `POST /api/auth/login` — JWT issuance
- `GET /api/auth/me` — Current user
- `POST /api/auth/logout` — Token blacklist

### Organization Setup (Admin)
- `CRUD /api/departments`
- `POST /api/departments/:id/assign-head`
- `CRUD /api/asset-categories`
- `GET /api/employees` — Directory
- `POST /api/employees/:id/promote` — **Only** role assignment endpoint

### Assets
- `POST /api/assets` — Register (auto-generates AF-XXXX tag)
- `GET /api/assets` — Search/filter
- `GET /api/assets/:id/history` — Combined allocation + maintenance history

### Allocation & Transfer
- `POST /api/allocations` — SELECT FOR UPDATE conflict check
- `POST /api/allocations/:id/return`
- `POST /api/allocations/transfers` — Request transfer
- `PUT /api/allocations/transfers/:id/approve|reject`

### Booking
- `POST /api/bookings` — DB exclusion constraint rejects overlaps
- `PUT /api/bookings/:id/cancel|reschedule`

### Maintenance
- `POST /api/maintenance-requests` — Raise
- `PUT /api/maintenance-requests/:id/approve|reject|assign-technician|start|resolve`

### Audits
- `POST /api/audit-cycles` — Create
- `POST /api/audit-cycles/:id/assign-auditors`
- `POST /api/audit-cycles/:id/close` — Atomic: Missing → Lost cascade

### Dashboard & Reports
- `GET /api/dashboard/kpis` — Redis-cached
- `GET /api/dashboard/overdue`
- `GET /api/reports/*`

### Notifications & Logs
- `GET /api/notifications`
- `GET /api/activity-logs`

## Key Design Decisions

1. **Asset.status is never written directly** — all transitions go through `stateMachine.js`
2. **Role assignment only in one place** — `POST /api/employees/:id/promote` (Admin only)
3. **Booking overlap enforced by DB** — `EXCLUDE USING gist` constraint, not app code
4. **Double-allocation race-safe** — `SELECT ... FOR UPDATE` + partial unique index
5. **Mongo writes never block Postgres** — fire-and-forget after commit
6. **Audit close is atomic** — single transaction for Missing → Lost cascade
