# Finance Dashboard API

A clean, production-ready REST API backend for a role-based finance dashboard system.  
Built with **Node.js**, **Express**, and **SQLite**.

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Role Model](#role-model)
- [API Reference](#api-reference)
  - [Auth](#auth)
  - [Users](#users)
  - [Financial Records](#financial-records)
  - [Dashboard Analytics](#dashboard-analytics)
- [Request & Response Format](#request--response-format)
- [Error Codes](#error-codes)
- [Database Design](#database-design)
- [Design Decisions & Assumptions](#design-decisions--assumptions)
- [Running Tests](#running-tests)
- [Requirements Coverage](#requirements-coverage)

---

## Tech Stack

| Layer       | Technology            | Why                                                          |
|-------------|-----------------------|--------------------------------------------------------------|
| Runtime     | Node.js 20+           | Native test runner, `--watch` mode, no build step needed     |
| Framework   | Express 4             | Minimal, widely understood, easy to reason about             |
| Database    | SQLite (better-sqlite3) | Zero config, single file, synchronous API, great for demos |
| Auth        | jsonwebtoken          | Stateless JWT, standard industry approach                    |
| Validation  | Zod                   | Type-safe schemas, coercion support, great error messages    |
| Passwords   | bcryptjs              | Industry-standard password hashing                           |
| IDs         | uuid v4               | Collision-proof unique IDs for all records                   |

---

## Project Structure

```
zorvyn/
├── src/
│   ├── app.js                        # Express app setup + server entry point
│   ├── seed.js                       # Demo data seeder (run once)
│   ├── models/
│   │   └── database.js               # SQLite connection, schema, indexes
│   ├── middleware/
│   │   ├── auth.js                   # JWT authentication + RBAC middleware
│   │   └── errorHandler.js           # Global error handler + Zod validate helper
│   ├── services/
│   │   ├── authService.js            # Login logic, password hashing
│   │   ├── userService.js            # User CRUD business logic
│   │   ├── recordService.js          # Financial record CRUD + filtering + pagination
│   │   └── dashboardService.js       # Aggregation queries for analytics
│   ├── routes/
│   │   ├── auth.routes.js            # POST /api/auth/login, GET /api/auth/me
│   │   ├── users.routes.js           # /api/users CRUD
│   │   ├── records.routes.js         # /api/records CRUD + filtering
│   │   └── dashboard.routes.js       # /api/dashboard analytics
│   └── utils/
│       ├── schemas.js                # All Zod validation schemas
│       └── response.js               # Response helpers + custom error classes
├── tests/
│   └── api.test.js                   # Integration tests (Node built-in runner)
├── data/                             # SQLite database file lives here (auto-created)
├── .env.example                      # Environment variable template
├── .gitignore
└── package.json
```

---

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env
```

Generate a secure JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Paste the output as your `JWT_SECRET` in `.env`.

### 3. Seed demo data

```bash
npm run seed
```

This creates three demo users and ~60 financial records across 6 months.

| Email                  | Role     | Password     |
|------------------------|----------|--------------|
| admin@example.com      | admin    | password123  |
| analyst@example.com    | analyst  | password123  |
| viewer@example.com     | viewer   | password123  |

### 4. Start the server

```bash
npm start         # production
npm run dev       # development with auto-restart on file changes
```

Server runs on `http://localhost:3000` by default.

### 5. Verify it's running

```bash
curl http://localhost:3000/health
# {"status":"ok","timestamp":"..."}
```

---

## Environment Variables

| Variable        | Default                            | Description                          |
|-----------------|------------------------------------|--------------------------------------|
| `PORT`          | `3000`                             | HTTP port                            |
| `NODE_ENV`      | `development`                      | Affects error verbosity in responses |
| `DB_PATH`       | `./data/finance.db`                | Path to SQLite database file         |
| `JWT_SECRET`    | `dev-secret-change-in-production`  | Secret used to sign JWT tokens       |
| `JWT_EXPIRES_IN`| `8h`                               | How long a token stays valid         |

> **Important:** Always set a strong `JWT_SECRET` before sharing or deploying. Use `crypto.randomBytes(32).toString('hex')` to generate one.

---

## Role Model

Three roles with increasing levels of access:

| Role     | View Records | Dashboard Analytics | Create / Edit Records | Manage Users |
|----------|:---:|:---:|:---:|:---:|
| viewer   | ✅  | ❌  | ❌  | ❌  |
| analyst  | ✅  | ✅  | ❌  | ❌  |
| admin    | ✅  | ✅  | ✅  | ✅  |

- **Roles are enforced in middleware** on every route — not just documented.
- An admin cannot deactivate or delete their own account.
- A viewer or analyst trying to write data receives `403 Forbidden`.

---

## API Reference

All endpoints (except `/health` and `/api/auth/login`) require a Bearer token:

```
Authorization: Bearer <your_jwt_token>
```

### Auth

#### `POST /api/auth/login`

No authentication required.

**Request body:**
```json
{
  "email": "admin@example.com",
  "password": "password123"
}
```

**Success response `200`:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGci...",
    "user": {
      "id": "f97aa319-...",
      "name": "Alice Admin",
      "email": "admin@example.com",
      "role": "admin",
      "status": "active"
    }
  }
}
```

---

#### `GET /api/auth/me`

Returns the currently authenticated user's profile.

**Success response `200`:**
```json
{
  "success": true,
  "data": {
    "id": "f97aa319-...",
    "name": "Alice Admin",
    "email": "admin@example.com",
    "role": "admin",
    "status": "active"
  }
}
```

---

### Users

All user endpoints require authentication. Most require `admin` role.

#### `GET /api/users` — admin only

Returns all non-deleted users.

#### `POST /api/users` — admin only

**Request body:**
```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "password": "securepassword",
  "role": "analyst"
}
```

**Success response `201`:** Returns the created user (without password).

---

#### `GET /api/users/:id` — admin or the user themselves

Returns a single user by ID.

#### `PATCH /api/users/:id` — admin only

Update name, role, or status. At least one field required.

**Request body (all fields optional):**
```json
{
  "name": "Jane Smith",
  "role": "admin",
  "status": "inactive"
}
```

#### `DELETE /api/users/:id` — admin only

Soft-deletes the user (sets `deleted_at`, marks status as `inactive`). Returns `204 No Content`.

---

### Financial Records

#### `GET /api/records` — any authenticated user

Returns a paginated list of records. Supports filters via query params.

**Query parameters:**

| Param       | Type    | Description                                       |
|-------------|---------|---------------------------------------------------|
| `type`      | string  | Filter by `income` or `expense`                   |
| `category`  | string  | Partial match on category name                    |
| `date_from` | string  | Start date in `YYYY-MM-DD` format                 |
| `date_to`   | string  | End date in `YYYY-MM-DD` format                   |
| `page`      | integer | Page number (default: `1`)                        |
| `limit`     | integer | Items per page, max `100` (default: `20`)         |
| `sort`      | string  | Sort by `date`, `amount`, or `created_at`         |
| `order`     | string  | `asc` or `desc` (default: `desc`)                 |

**Success response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "id": "abc123-...",
      "amount": 5000,
      "type": "income",
      "category": "Salary",
      "date": "2024-03-01",
      "notes": "March salary",
      "created_at": "2024-03-01 10:00:00",
      "updated_at": "2024-03-01 10:00:00",
      "created_by_id": "f97aa319-...",
      "created_by_name": "Alice Admin"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 49,
    "pages": 3
  }
}
```

---

#### `GET /api/records/:id` — any authenticated user

Returns a single record by ID.

#### `POST /api/records` — admin only

**Request body:**
```json
{
  "amount": 2500.00,
  "type": "expense",
  "category": "Marketing",
  "date": "2024-03-15",
  "notes": "Q1 ad spend"
}
```

**Success response `201`:** Returns the created record.

#### `PATCH /api/records/:id` — admin only

Update any field. At least one field required.

#### `DELETE /api/records/:id` — admin only

Soft-deletes the record. Returns `204 No Content`.

---

### Dashboard Analytics

All dashboard endpoints require **analyst** or **admin** role.

#### `GET /api/dashboard/summary`

Overall financial totals for the selected period.

**Query params:** `date_from`, `date_to` (both optional, `YYYY-MM-DD`)

**Response data:**
```json
{
  "total_income": 39994.37,
  "total_expenses": 15426.95,
  "net_balance": 24567.42,
  "record_count": 49
}
```

---

#### `GET /api/dashboard/categories`

Totals grouped by category and type.

**Query params:** `date_from`, `date_to`

**Response data:**
```json
[
  { "category": "Salary",    "type": "income",  "total": 31573.67, "count": 6 },
  { "category": "Marketing", "type": "expense", "total": 5010.38,  "count": 12 }
]
```

---

#### `GET /api/dashboard/trends`

Income and expense totals per time period — useful for charts.

**Query params:** `date_from`, `date_to`, `period` (`monthly` or `weekly`, default `monthly`)

**Response data:**
```json
[
  { "period": "2024-01", "income": 6341.71, "expenses": 2616.35, "net": 3725.36 },
  { "period": "2024-02", "income": 6826.47, "expenses": 2193.06, "net": 4633.41 }
]
```

---

#### `GET /api/dashboard/recent-activity`

The most recent N records with creator info.

**Query params:** `limit` (default: `10`, max: `50`)

---

#### `GET /api/dashboard/top-categories`

Top N categories ranked by total amount.

**Query params:** `limit` (default: `5`, max: `20`), `date_from`, `date_to`

**Response data:**
```json
[
  { "category": "Salary",    "total": 31573.67, "count": 6 },
  { "category": "Freelance", "total": 8420.70,  "count": 6 }
]
```

---

## Request & Response Format

Every response follows this consistent envelope:

**Success:**
```json
{
  "success": true,
  "data": { ... },
  "meta": { "page": 1, "limit": 20, "total": 49, "pages": 3 }
}
```

**Error:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data",
    "details": [
      { "field": "amount", "message": "Expected positive number, received -100" },
      { "field": "date",   "message": "Date must be YYYY-MM-DD" }
    ]
  }
}
```

The `meta` field only appears on paginated list responses.  
The `details` array only appears on validation errors.

---

## Error Codes

| HTTP Status | Code               | When it happens                                         |
|-------------|--------------------|---------------------------------------------------------|
| `400`       | `VALIDATION_ERROR` | Request body or query params failed schema validation   |
| `401`       | `UNAUTHORIZED`     | Missing token, invalid token, or inactive account       |
| `403`       | `FORBIDDEN`        | Authenticated but role does not allow this action       |
| `404`       | `NOT_FOUND`        | Record or user with that ID does not exist              |
| `409`       | `CONFLICT`         | Email already registered, or unique constraint violated |
| `500`       | `INTERNAL_ERROR`   | Unexpected server error (detail shown in dev mode only) |

---

## Database Design

### `users` table

| Column       | Type   | Constraint                                    |
|--------------|--------|-----------------------------------------------|
| `id`         | TEXT   | PRIMARY KEY (UUID)                            |
| `name`       | TEXT   | NOT NULL                                      |
| `email`      | TEXT   | UNIQUE, NOT NULL (stored lowercase)           |
| `password`   | TEXT   | NOT NULL (bcrypt hash, never returned in API) |
| `role`       | TEXT   | CHECK IN ('admin', 'analyst', 'viewer')       |
| `status`     | TEXT   | CHECK IN ('active', 'inactive'), default active |
| `created_at` | TEXT   | Default datetime('now')                       |
| `updated_at` | TEXT   | Default datetime('now')                       |
| `deleted_at` | TEXT   | NULL = active, timestamp = soft-deleted       |

### `records` table

| Column       | Type   | Constraint                              |
|--------------|--------|-----------------------------------------|
| `id`         | TEXT   | PRIMARY KEY (UUID)                      |
| `user_id`    | TEXT   | FOREIGN KEY → users.id                  |
| `amount`     | REAL   | CHECK > 0 (always positive)             |
| `type`       | TEXT   | CHECK IN ('income', 'expense')          |
| `category`   | TEXT   | NOT NULL                                |
| `date`       | TEXT   | NOT NULL (YYYY-MM-DD)                   |
| `notes`      | TEXT   | NULL allowed                            |
| `created_at` | TEXT   | Default datetime('now')                 |
| `updated_at` | TEXT   | Default datetime('now')                 |
| `deleted_at` | TEXT   | NULL = active, timestamp = soft-deleted |

### Indexes

All indexes are partial — they only index rows where `deleted_at IS NULL`. This keeps the index small as deleted records accumulate.

| Index                  | Column             | Speeds up                          |
|------------------------|--------------------|------------------------------------|
| `idx_records_date`     | `records.date`     | Date range filter queries          |
| `idx_records_type`     | `records.type`     | Filter by income / expense         |
| `idx_records_category` | `records.category` | Category search / filter           |
| `idx_records_user_id`  | `records.user_id`  | Find records by creator            |
| `idx_users_email`      | `users.email`      | Login lookup — runs on every login |

---

## Design Decisions & Assumptions

### Why SQLite?
Zero configuration, single file database — ideal for a self-contained demo. The schema is standard SQL. Switching to PostgreSQL only requires changing `database.js` and replacing `datetime('now')` with `NOW()` and `strftime()` with `to_char()`.

### Soft deletes
Both users and records use a `deleted_at` timestamp instead of hard deletion. This preserves the audit trail — records created by a deleted user still reference their `user_id`. Deleted rows are invisible to all normal queries via `WHERE deleted_at IS NULL`.

### Amount is always positive
The `type` field (`income` or `expense`) determines direction. Storing amounts as always-positive makes SQL aggregations (`SUM(amount) WHERE type = 'income'`) clean and unambiguous.

### JWT tokens re-validate against the database
Even though the user's role is embedded in the JWT, the `authenticate` middleware re-queries the database on every request. This means role changes and account deactivations take effect immediately — not after the token expires.

### Roles are stored on the user row
A simple `role` column is appropriate when role semantics are fixed at design time. A separate permissions table would only be necessary if roles needed to be customisable at runtime.

### Error messages do not distinguish between "wrong email" and "wrong password"
Both cases return `"Invalid email or password"`. This prevents username enumeration — an attacker cannot probe which email addresses are registered.

### Category is free-form text
Flexible for demo purposes. A production system would likely have a `categories` table with predefined values and a foreign key reference.

---

## Running Tests

Tests use Node's built-in test runner — no extra packages needed.

```bash
npm test
```

Tests run against an **in-memory SQLite database** (`DB_PATH=:memory:`). No files are created, no cleanup needed. Each test group seeds its own users using unique email domains to avoid conflicts when tests run concurrently.

Coverage includes:

- Auth: login success, wrong password, invalid email format, `/me` endpoint
- Users: admin can list/create/update/delete, viewer is forbidden, duplicate email returns 409
- Records: admin can create, viewer and analyst are forbidden, negative amount rejected, invalid date rejected, listing and filtering, 404 for missing record
- Dashboard: viewer is blocked (403), analyst can access all five endpoints, date filters work correctly
- General: unknown routes return 404

---

## Requirements Coverage

| Requirement                              | Status     | Implementation                                      |
|------------------------------------------|:----------:|-----------------------------------------------------|
| User and role management                 | ✅ Done    | `userService.js` + `users.routes.js`                |
| Financial records CRUD                   | ✅ Done    | `recordService.js` + `records.routes.js`            |
| Filtering records                        | ✅ Done    | Dynamic WHERE clause in `listRecords()`             |
| Dashboard summary APIs                   | ✅ Done    | 5 endpoints in `dashboardService.js`                |
| Access control logic                     | ✅ Done    | `authorize()` + `authorizeLevel()` middleware       |
| Validation and error handling            | ✅ Done    | Zod schemas + global error handler                  |
| Data persistence                         | ✅ Done    | SQLite with schema, indexes, FK enforcement         |
| JWT Authentication (optional)            | ✅ Bonus   | `authService.js` + `auth.js` middleware             |
| Pagination (optional)                    | ✅ Bonus   | `page`, `limit`, `total`, `pages` on all lists      |
| Soft delete (optional)                   | ✅ Bonus   | `deleted_at` column on both tables                  |
| Integration tests (optional)             | ✅ Bonus   | `tests/api.test.js`, in-memory DB, 20+ assertions   |
| API documentation (optional)             | ✅ Bonus   | This README                                         |
