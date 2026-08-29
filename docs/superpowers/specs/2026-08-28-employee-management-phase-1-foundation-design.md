# Employee Management Phase 1 Foundation Design

- **Date:** 2026-08-28
- **Status:** Approved design; awaiting specification review
- **Phase:** 1 of 5 — Data, API, and Runtime Foundation
- **Delivery approach:** Coordinated in-place contract cutover

## 1. Purpose

Phase 1 establishes one durable Employee data contract and a deterministic production runtime. Database, Prisma, backend DTOs, API JSON, the existing frontend, seed data, and the temporary XLSX workflow must agree on that contract before authentication, UX redesign, advanced XLSX behavior, deployment, or portfolio work begins.

This phase performs a coordinated backend/frontend cutover. It preserves every valid existing employee row and identifier while intentionally ending support for legacy JSON property names, the partial `PUT` route, and legacy XLSX headers. There are no documented independent API consumers, and the first-party frontend changes in the same release.

## 2. Goals

Phase 1 must deliver:

1. A canonical Employee model with stable names and serialization rules.
2. A backward-safe, atomic migration from the checked-in legacy schema.
3. Deterministic, exhaustive email assignment for every existing row.
4. An idempotent compiled seed containing ten canonical demo employees.
5. Strict runtime validation for request bodies, path parameters, and list queries.
6. Stable CRUD, pagination, search, filter, sort, and error contracts.
7. Clear controller, service, repository, serialization, and error boundaries.
8. Continued basic XLSX import/export availability under the canonical contract.
9. A compiled Docker startup sequence whose generated paths are verified.
10. Compose resources that can be isolated by project name.
11. Reproducible dependency installation and a credible local quality baseline.
12. Mechanical frontend compatibility with no visual or product redesign.

## 3. Explicit Phase 1 Exclusions

Phase 1 must not add or redesign:

- Authentication, authorization, registration, recovery, sessions, RBAC, or multiple users.
- The authenticated manual demo-reset operation.
- Summary cards, responsive employee cards, table redesign, modal redesign, or accessibility redesign.
- XLSX preview, confirmation, downloadable templates, rejection-report downloads, redesigned XLSX UI, or filter-aware export. Phase 4 may add search, status-filter, and sort inputs to export while continuing to ignore pagination; Phase 1 accepts no export query parameters.
- Audit history, charts, departments, managers, benefits, advanced HR fields, or enterprise HR workflows.
- Deployment configuration, hosting automation, CI workflows, production restart policies, or environment-specific infrastructure.
- README, portfolio narrative, screenshots, case studies, or other portfolio documentation.
- Microservices, generic enterprise layers, event buses, or unrelated refactoring.

The existing interface may change only where mechanically required to consume canonical field names, response envelopes, `PATCH`, pagination metadata, and English XLSX summary keys.

## 4. Current Repository Constraints

The implementation starts from these checked-in facts:

- `backend/prisma/migrations/20260308150134_init/migration.sql` creates `Employee.uuid` as PostgreSQL `TEXT`, not the native `uuid` type.
- The same migration creates `salary` as `DECIMAL(65,30)` and `contract_date` as `TIMESTAMP(3)` without a timezone.
- The current seed performs an unconditional `createMany` and can duplicate its ten records on repeated startup.
- Current API DTOs and frontend types expose `uuid`, `name`, `role`, `contract_date`, `zipcode`, `created_at`, and `updated_at`.
- Current controllers cast unvalidated input to TypeScript interfaces.
- Current sorting uses the client-provided property name directly.
- Current error middleware returns every propagated failure as HTTP 400.
- Both `backend/src/app.ts` and `backend/src/server.ts` currently listen.
- The current TypeScript layout emits `dist/src/app.js`, while package and image startup expect `dist/app.js`.
- The existing XLSX service bypasses the canonical create use case and uses legacy headers.
- Current Compose sets fixed container names and overrides the backend image command with source execution.
- The user-owned removal of `restart: always` from `docker-compose.yml` is an approved local Compose change and must be retained.

## 5. Architecture and Responsibilities

### 5.1 Request flow

The normal request flow is:

```text
Express route
  -> runtime validation middleware
  -> controller
  -> employee service/use case
  -> employee repository
  -> Prisma/PostgreSQL
  -> canonical response serializer
  -> HTTP response
```

Errors flow to one final global error middleware and are serialized through the stable error contract.

### 5.2 Configuration bootstrap, Express application, and server

A configuration module exports a pure environment parser and the application configuration type:

```ts
type NodeEnvironment = "development" | "test" | "production";

interface AppConfig {
  readonly databaseUrl: string;
  readonly port: number;
  readonly corsOrigin: string;
  readonly nodeEnv: NodeEnvironment;
}

function parseEnvironment(source: NodeJS.ProcessEnv): AppConfig;
```

`parseEnvironment` has no side effects. It validates only the supplied object, returns a normalized immutable configuration, and never opens a connection or listener.

`backend/src/app.ts` exports this factory:

```ts
function createApp(
  config: AppConfig,
  dependencies?: AppDependencies
): Express;
```

`createApp` must only:

- Construct and return the Express application.
- Configure CORS from `config.corsOrigin` and configure JSON parsing.
- Use supplied dependencies in tests or create production dependencies from the validated `AppConfig` when they are omitted.
- Register liveness/readiness and employee routes.
- Register the unknown-route handler.
- Register the global error middleware last.

Importing `app.ts` must not read `process.env`, open a database connection, start a listener, or perform startup-side database mutations.

`backend/src/server.ts` is the executable bootstrap and must:

- Call `parseEnvironment(process.env)` exactly once.
- Pass the resulting `AppConfig` to `createApp`.
- Start exactly one HTTP listener on `config.port`.
- Log a concise startup event without secrets.
- Set a non-zero exit code or terminate startup on a fatal configuration, dependency, or listen error.

API tests call `createApp(testConfig, testDependencies)` directly. They do not mutate process-wide environment values merely to import the application.

### 5.3 Runtime validation and DTOs

Zod is the canonical runtime validation source for:

- Employee creation.
- Employee partial updates.
- Employee ID path parameters.
- Employee list queries.
- XLSX row normalization output before creation.
- Environment variables.

Schemas use strict objects so unknown fields fail rather than being silently accepted. Backend input DTO types are inferred from these schemas instead of being separately handwritten and allowed to drift.

The validation middleware parses and replaces raw request input with the normalized value. Controllers must not use `as CreateEmployeeDTO`, `as UpdateEmployeeDTO`, or equivalent unchecked assertions on client input.

### 5.4 Controllers

Employee controllers own HTTP translation only:

- Read validated path, body, query, or uploaded-file input.
- Invoke one service method.
- Serialize successful output through the canonical response mapper.
- Set status codes and download headers.
- Forward failures to global error handling.

Controllers do not contain Prisma queries, business validation, migration logic, XLSX row validation rules, or domain branching.

### 5.5 Employee service

The Employee service owns use-case behavior:

- Create an employee.
- Retrieve an employee or raise `EMPLOYEE_NOT_FOUND`.
- List employees using a canonical Prisma-independent `EmployeeListOptions` object.
- Partially update an employee.
- Delete an employee.
- Import XLSX rows by passing each normalized row through the same create use case.
- Export every employee using a non-paginated repository query.

The controller passes the validated list query to the service as:

```ts
type EmployeeSortField =
  | "fullName"
  | "email"
  | "jobTitle"
  | "status"
  | "salary"
  | "hireDate";

interface EmployeeListOptions {
  page: number;
  pageSize: number;
  search?: string;
  status?: EmployeeStatus;
  sortBy: EmployeeSortField;
  sortOrder: "asc" | "desc";
}
```

The service may calculate pagination metadata and enforce use-case rules, but it does not construct Prisma `where`, `orderBy`, `skip`, or `take` objects. It never accepts an Express `Request`/`Response` or imports Prisma query-input types.

Email uniqueness is ultimately enforced by PostgreSQL. The service/error translation maps the Prisma unique-constraint race to `EMAIL_CONFLICT`; it must not rely only on a pre-insert lookup.

### 5.6 Employee repository

The repository is the only Employee layer that imports Prisma query-input types or executes Prisma operations. It exposes narrow methods required by the service, including:

- `create`.
- `findById`.
- `findPage(options: EmployeeListOptions)`.
- `findAllForExport()` without arguments or pagination.
- `update`.
- `delete`.

The repository maps `EmployeeListOptions` to Prisma internally:

- `search` becomes the explicit case-insensitive `OR` over physical mappings for `fullName`, `email`, and `jobTitle`.
- `status` becomes the explicit enum equality filter.
- `sortBy` is mapped with an exhaustive switch/table to one approved Prisma field; it is never used as a computed raw property supplied by the client.
- `page` and `pageSize` become `skip` and `take`.
- Every `orderBy` ends with `id ASC` as the stable tiebreaker.

The repository also owns persistence conversion. It converts canonical salary strings to `Prisma.Decimal`, canonical hire-date strings to the UTC-safe value required by Prisma/PostgreSQL `date`, and Prisma records back to Prisma-independent domain records with fixed salary/date strings. Controller and service layers therefore do not import Prisma types. The repository does not parse HTTP strings, throw HTTP-specific errors, or parse workbooks.

### 5.7 Serialization

One response mapper converts Prisma-independent domain Employee records to the public `Employee` representation. The repository has already converted Prisma values before this mapper runs. All single-record, list, create, and update responses use it. XLSX export uses the same canonical value rules but emits only the ten import-compatible business columns.

## 6. Canonical Employee Data Contract

### 6.1 Prisma model

```prisma
enum EmployeeStatus {
  ACTIVE
  ON_LEAVE
  INACTIVE
}

model Employee {
  id           String         @id @default(uuid()) @map("uuid")
  email        String         @unique
  fullName     String         @map("name")
  jobTitle     String         @map("role")
  status       EmployeeStatus
  salary       Decimal        @db.Decimal(12, 2)
  hireDate     DateTime       @db.Date @map("contract_date")
  phone        String?
  address      String?
  neighborhood String?
  postalCode   String?        @map("zipcode")
  createdAt    DateTime       @default(now()) @map("created_at")
  updatedAt    DateTime       @updatedAt @map("updated_at")

  @@index([status])
}
```

The physical table remains `Employee`. Existing physical column names remain unchanged through `@map`; Phase 1 does not rename them.

### 6.2 Database constraints and indexes

The resulting database enforces:

- Existing primary key `Employee_pkey` on physical column `uuid`.
- Required, unique `email` through `Employee_email_key`.
- `Employee_email_normalized_check`: `email = lower(btrim(email))`.
- PostgreSQL enum `EmployeeStatus` with `ACTIVE`, `ON_LEAVE`, and `INACTIVE`.
- `Employee_salary_positive_check`: `salary > 0`.
- `Employee_status_idx` on `status`.
- `DECIMAL(12,2)` as the physical salary type.
- PostgreSQL `date` as the physical hire-date type.

String length and format validation is enforced at every supported application input boundary and checked during migration preflight. Phase 1 does not introduce PostgreSQL regex constraints for names, contact text, or general email syntax.

### 6.3 Exact field rules

| Field | Create | Update | Normalization and validation | Public serialization |
|---|---|---|---|---|
| `id` | Forbidden | Forbidden | Server-generated UUID; path values must be UUID-shaped | UUID string |
| `email` | Required | Optional | Trim, lowercase, valid email, maximum 254 characters | Lowercase string |
| `fullName` | Required | Optional | Trimmed non-empty string, 1–120 characters | String |
| `jobTitle` | Required | Optional | Trimmed non-empty free text, 1–120 characters | String |
| `status` | Required | Optional | Exactly `ACTIVE`, `ON_LEAVE`, or `INACTIVE` | Enum string |
| `salary` | Required | Optional | Fixed two-decimal string; positive; maximum `9999999999.99`; no exponent notation | Fixed two-decimal string |
| `hireDate` | Required | Optional | Real calendar date in exact `YYYY-MM-DD`, range `0001-01-01`–`9999-12-31` | `YYYY-MM-DD` |
| `phone` | Optional | Optional | `null`, omitted, or trimmed string 1–30 characters; empty becomes `null` | String or `null` |
| `address` | Optional | Optional | `null`, omitted, or trimmed string 1–200 characters; empty becomes `null` | String or `null` |
| `neighborhood` | Optional | Optional | `null`, omitted, or trimmed string 1–100 characters; empty becomes `null` | String or `null` |
| `postalCode` | Optional | Optional | `null`, omitted, or trimmed string 1–20 characters; empty becomes `null` | String or `null` |
| `createdAt` | Forbidden | Forbidden | Server-generated | UTC RFC 3339 timestamp |
| `updatedAt` | Forbidden | Forbidden | Server-managed | UTC RFC 3339 timestamp |

Salary JSON must match the canonical decimal form `(?:0|[1-9][0-9]{0,9})\.[0-9]{2}` and must be greater than `0.00`. Leading-zero variants such as `003500.00`, integer JSON numbers, exponent notation, and values with fewer or more than two fractional digits are invalid JSON API inputs.

Date validation must parse the individual year, month, and day components and verify a lossless calendar round trip. Runtime conversion uses UTC-safe date construction; locale parsing must not be used.

### 6.4 Canonical DTO shapes

```ts
type EmployeeStatus = "ACTIVE" | "ON_LEAVE" | "INACTIVE";

interface CreateEmployeeDTO {
  email: string;
  fullName: string;
  jobTitle: string;
  status: EmployeeStatus;
  salary: string;
  hireDate: string;
  phone?: string | null;
  address?: string | null;
  neighborhood?: string | null;
  postalCode?: string | null;
}

type UpdateEmployeeDTO = Partial<CreateEmployeeDTO>; // at least one key required

interface EmployeeDTO {
  id: string;
  email: string;
  fullName: string;
  jobTitle: string;
  status: EmployeeStatus;
  salary: string;
  hireDate: string;
  phone: string | null;
  address: string | null;
  neighborhood: string | null;
  postalCode: string | null;
  createdAt: string;
  updatedAt: string;
}
```

An update body must contain at least one recognized field. Required create fields cannot be set to `null`. Optional fields can be cleared with `null` or an empty string, which normalizes to `null`.

## 7. Employee HTTP API

### 7.1 General conventions

- Base path: `/employees`.
- Request and response content is JSON except XLSX upload/download.
- Single successful resources use `{ "data": EmployeeDTO }`.
- Lists use `{ "data": EmployeeDTO[], "meta": ... }`.
- Unknown JSON keys and unknown list-query keys fail validation.
- All public messages and field names are English.

Example employee response:

```json
{
  "data": {
    "id": "85c3a05e-bb06-4b2f-b6de-0d81da73120c",
    "email": "joao.silva@example.com",
    "fullName": "João Silva",
    "jobTitle": "Developer",
    "status": "ACTIVE",
    "salary": "3500.00",
    "hireDate": "2023-01-10",
    "phone": "119999999",
    "address": "Rua A",
    "neighborhood": "Centro",
    "postalCode": "14000-000",
    "createdAt": "2026-08-28T12:00:00.000Z",
    "updatedAt": "2026-08-28T12:00:00.000Z"
  }
}
```

### 7.2 Create employee

```text
POST /employees
```

Body: strict `CreateEmployeeDTO`.

Success:

- HTTP 201.
- Body `{ "data": EmployeeDTO }`.

Expected failures:

- 400 malformed JSON.
- 409 normalized email already exists.
- 422 invalid or unknown field.

### 7.3 List employees

```text
GET /employees
```

| Query parameter | Default | Rules | Meaning |
|---|---|---|---|
| `page` | `1` | Integer ≥ 1 | Requested page |
| `pageSize` | `10` | Integer 1–100 | Rows per page |
| `search` | Omitted | Trimmed string 1–100 characters | Case-insensitive contains search across `fullName`, `email`, and `jobTitle` |
| `status` | Omitted | `ACTIVE`, `ON_LEAVE`, or `INACTIVE` | Exact status filter |
| `sortBy` | `fullName` | `fullName`, `email`, `jobTitle`, `status`, `salary`, or `hireDate` | Whitelisted primary sort field |
| `sortOrder` | `asc` | `asc` or `desc` | Primary sort direction |

Validation converts the HTTP query into `EmployeeListOptions` and rejects every value outside the canonical sort whitelist. The service and controller pass that Prisma-independent object without constructing Prisma inputs. The repository alone maps its canonical `sortBy` value to an explicit Prisma `orderBy` object.

Every query adds `id ASC` as a deterministic final tiebreaker. Default ordering is therefore `fullName ASC, id ASC`. A descending primary sort still uses `id ASC` as the final tiebreaker.

An out-of-range page returns an empty `data` array with accurate metadata; it is not a 404. With no matching rows, `totalPages` is `0`.

Success body:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "pageSize": 10,
    "totalItems": 0,
    "totalPages": 0,
    "sortBy": "fullName",
    "sortOrder": "asc"
  }
}
```

### 7.4 Retrieve employee

```text
GET /employees/:id
```

- `id` must be UUID-shaped.
- HTTP 200 with `{ "data": EmployeeDTO }` when found.
- HTTP 404 with `EMPLOYEE_NOT_FOUND` when a valid ID is absent.
- HTTP 422 when the path value is not a UUID.

### 7.5 Partially update employee

```text
PATCH /employees/:id
```

The legacy partial `PUT` route is removed. Body: strict `UpdateEmployeeDTO` with at least one key.

- HTTP 200 with the fully serialized updated employee.
- HTTP 404 when the ID is absent.
- HTTP 409 when the normalized replacement email belongs to another employee.
- HTTP 422 for an invalid ID, empty body, server-owned field, unknown field, or invalid value.

### 7.6 Delete employee

```text
DELETE /employees/:id
```

- HTTP 204 with no body on success.
- HTTP 404 when the valid ID is absent.
- HTTP 422 when the path value is not a UUID.

### 7.7 XLSX endpoints

The complete temporary contracts for these existing endpoints are defined in Section 11:

```text
POST /employees/import
GET  /employees/export
```

## 8. Global Error Contract

All failures use this envelope:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "email",
        "code": "invalid_format",
        "message": "Enter a valid email address."
      }
    ]
  }
}
```

`details` is present only when structured details are useful. Paths use canonical field names. Error messages do not expose SQL, Prisma internals, stack traces, filesystem paths, or environment secrets.

| HTTP status | Error code | Use |
|---|---|---|
| 400 | `MALFORMED_JSON` | Request body is not valid JSON |
| 404 | `EMPLOYEE_NOT_FOUND` | Valid employee ID does not exist |
| 404 | `ROUTE_NOT_FOUND` | No route matches the request |
| 409 | `EMAIL_CONFLICT` | Normalized email is already used |
| 413 | `PAYLOAD_TOO_LARGE` | XLSX upload exceeds 5 MiB |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | Upload is not an XLSX MIME/extension combination |
| 422 | `VALIDATION_ERROR` | Path, JSON body, list/export query, or required XLSX file input is invalid |
| 422 | `INVALID_XLSX` | Workbook, worksheet, or header structure is invalid |
| 500 | `INTERNAL_ERROR` | Unexpected server failure |

Known Prisma errors are translated centrally:

- Email `P2002` -> `EMAIL_CONFLICT`/409.
- A not-found mutation race such as `P2025` -> `EMPLOYEE_NOT_FOUND`/404.
- Unknown Prisma/database errors -> sanitized `INTERNAL_ERROR`/500 and server-side logging.

Multer size errors and JSON parser errors are also translated by the global middleware. The middleware is registered after all routes.

## 9. Atomic Migration Strategy

### 9.1 Legacy schema facts

The checked-in initial migration defines:

```sql
"uuid"          TEXT NOT NULL PRIMARY KEY,
"salary"        DECIMAL(65,30) NOT NULL,
"contract_date" TIMESTAMP(3) NOT NULL
```

Because `uuid` is physical `TEXT`, `uuid COLLATE "C"` is valid PostgreSQL syntax. Phase 1 retains this physical type and maps it to Prisma field `id`; it does not convert the column to native PostgreSQL `uuid`.

### 9.2 Transaction boundary

One reviewed custom Prisma migration SQL file explicitly contains:

```text
BEGIN;
LOCK TABLE "Employee" IN ACCESS EXCLUSIVE MODE;
-- every preflight assertion
-- every data conversion and backfill
-- every DDL statement, constraint, and index
COMMIT;
```

No Employee DDL or data mutation occurs before the lock and preflight. The lock prevents a concurrent writer from introducing incompatible data after validation. No `CREATE INDEX CONCURRENTLY` is used because all work must remain inside the transaction; the demo-sized table accepts the ordinary transactional index lock.

Any preflight exception or conversion failure rolls back all application mutations in the transaction, including enum creation, the email column, row updates, type conversions, constraints, and indexes.

### 9.3 Exact preflight checks

The preflight raises an exception if any existing row violates any of these conditions:

1. `uuid` is empty or not UUID-shaped.
2. `btrim(name)` is empty or has more than 120 characters.
3. `btrim(role)` is empty or has more than 120 characters.
4. `upper(btrim(status))` is not `ACTIVE`, `INACTIVE`, or `ON_LEAVE`.
5. `salary <= 0`.
6. `salary > 9999999999.99`.
7. `salary <> round(salary, 2)`.
8. `contract_date` is non-finite.
9. `contract_date::date` is outside `0001-01-01`–`9999-12-31`.
10. A non-empty trimmed `phone` has more than 30 characters.
11. A non-empty trimmed `address` has more than 200 characters.
12. A non-empty trimmed `neighborhood` has more than 100 characters.
13. A non-empty trimmed `zipcode` has more than 20 characters.

The current physical `TIMESTAMP(3)` column cannot contain arbitrary invalid date text. Migration incompatibility fixtures therefore use PostgreSQL non-finite timestamps and valid PostgreSQL timestamps outside the supported API year range. Invalid textual XLSX dates are tested at the import boundary.

### 9.4 Deterministic representative rule

The migration defines the ten exact fingerprints in a SQL `VALUES` relation with a stable seed key and canonical email. Candidate rows must match every legacy fingerprint value exactly before any trimming, status normalization, or optional-field conversion.

For each seed key, candidates are ranked using:

```sql
row_number() over (
  partition by seed_key
  order by "uuid" collate "C" asc
)
```

The rank-1 candidate receives the seed key's canonical email. Because the physical UUID column is `TEXT`, C-collation bytewise text ordering is valid, deterministic, and independent of row insertion order.

Every other existing row receives:

```text
legacy+<lowercase uuid>@example.com
```

This fallback includes:

- Additional exact matches caused by repeated seed execution.
- Unrelated custom employees.
- Edited former seed employees.
- Partial matches.
- Ambiguous rows that cannot be identified by the complete fingerprint.

No existing row or UUID is deleted, replaced, or regenerated.

### 9.5 Exact legacy fingerprint-to-email mapping

| Legacy `name` | Legacy `address` | Legacy `neighborhood` | Legacy `zipcode` | Legacy `phone` | Legacy `salary` | Legacy `contract_date` | Legacy `role` | Legacy `status` | Canonical email |
|---|---|---|---|---|---:|---|---|---|---|
| João Silva | Rua A | Centro | 14000-000 | 119999999 | 3500 | 2023-01-10 00:00:00.000 | Developer | active | `joao.silva@example.com` |
| Maria Souza | Rua B | Jardim Paulista | 14000-001 | 119999998 | 4200 | 2022-03-15 00:00:00.000 | Designer | active | `maria.souza@example.com` |
| Carlos Lima | Rua C | Centro | 14000-002 | 119999997 | 5000 | 2021-07-20 00:00:00.000 | Manager | active | `carlos.lima@example.com` |
| Ana Costa | Rua D | Vila Tibério | 14000-003 | 119999996 | 3200 | 2023-05-01 00:00:00.000 | Developer | inactive | `ana.costa@example.com` |
| Pedro Santos | Rua E | Campos Eliseos | 14000-004 | 119999995 | 4500 | 2022-09-10 00:00:00.000 | QA | active | `pedro.santos@example.com` |
| Lucas Pereira | Rua F | Centro | 14000-005 | 119999994 | 3900 | 2022-11-02 00:00:00.000 | Developer | active | `lucas.pereira@example.com` |
| Fernanda Alves | Rua G | Ipiranga | 14000-006 | 119999993 | 4100 | 2021-04-12 00:00:00.000 | Product Owner | active | `fernanda.alves@example.com` |
| Ricardo Gomes | Rua H | Centro | 14000-007 | 119999992 | 3800 | 2020-06-30 00:00:00.000 | Support | active | `ricardo.gomes@example.com` |
| Juliana Rocha | Rua I | Jardim Paulista | 14000-008 | 119999991 | 4600 | 2021-08-21 00:00:00.000 | Developer | active | `juliana.rocha@example.com` |
| Bruno Martins | Rua J | Centro | 14000-009 | 119999990 | 3700 | 2022-12-01 00:00:00.000 | QA | inactive | `bruno.martins@example.com` |

### 9.6 Conversion operations

After backfill selection is materialized inside the transaction, the migration:

1. Creates the `EmployeeStatus` enum.
2. Adds nullable `email`.
3. Assigns canonical and fallback emails exhaustively.
4. Trims `name` and `role`.
5. Trims optional fields and converts empty/whitespace-only `address`, `neighborhood`, `zipcode`, and `phone` to `NULL` with `NULLIF`.
6. Drops the legacy `address NOT NULL` constraint.
7. Converts status through `upper(btrim(status))` into `EmployeeStatus`.
8. Converts salary to `DECIMAL(12,2)` without rounding.
9. Converts `contract_date` to PostgreSQL `date` using its existing calendar portion. Because the legacy type has no timezone, no timezone conversion is applied.
10. Preserves `uuid`, `created_at`, and `updated_at` values.
11. Makes `email` non-null.
12. Adds the email unique/index/check, positive-salary check, and status index.

### 9.7 Atomic rollback verification

Migration tests use uniquely named disposable PostgreSQL databases created from the checked-in legacy migration.

Before applying the Phase 1 migration, the test captures logical snapshots of:

- The Employee application catalog: columns, physical types, defaults, nullability, constraints, indexes, and relevant enum/type definitions.
- Every ordered Employee row and legacy column value, ordered by `uuid COLLATE "C"`.

For each incompatible fixture, `prisma migrate deploy` must fail. The test then captures the same logical snapshots and asserts exact logical equality. It does not claim that PostgreSQL physical database files are byte-for-byte identical.

To verify rollback after conversion has begun, the test harness creates a temporary copy of the committed migration SQL, injects a test-only exception immediately before `COMMIT`, and applies that copy only to a disposable database. The committed migration file is never modified by the test.

Prisma may record a failed attempt in its internal `_prisma_migrations` table even though the application schema and Employee data roll back. Tests treat that ledger separately and do not include it in the application-state equality assertion.

Failed-migration retry or cleanup is test-only:

- Preferred cleanup is to destroy only the uniquely named disposable database or unique Compose project allocated to that test and recreate it from the legacy migration.
- A retry-path test may instead point an explicitly test-guarded `DATABASE_URL` at that disposable database, run `prisma migrate resolve --rolled-back <migration-name>`, correct the fixture, and rerun `prisma migrate deploy`.
- The harness must refuse this operation unless the database/project name is explicitly marked as test-only.
- Tests never run `migrate resolve`, reset, drop, or cleanup commands against production or an unverified database.

A real deployment failure leaves the API stopped. Production recovery requires an operator to inspect the failure, preserve a backup, and explicitly choose a repair; Phase 1 startup never automatically resolves or resets a failed production migration.

## 10. Canonical Seed Dataset and Behavior

### 10.1 Complete dataset

The compiled seed contains exactly these business values. IDs, `createdAt`, and `updatedAt` are server-generated.

| Email | Full name | Job title | Status | Salary | Hire date | Phone | Address | Neighborhood | Postal code |
|---|---|---|---|---:|---|---|---|---|---|
| `joao.silva@example.com` | João Silva | Developer | ACTIVE | `3500.00` | 2023-01-10 | 119999999 | Rua A | Centro | 14000-000 |
| `maria.souza@example.com` | Maria Souza | Designer | ACTIVE | `4200.00` | 2022-03-15 | 119999998 | Rua B | Jardim Paulista | 14000-001 |
| `carlos.lima@example.com` | Carlos Lima | Manager | ACTIVE | `5000.00` | 2021-07-20 | 119999997 | Rua C | Centro | 14000-002 |
| `ana.costa@example.com` | Ana Costa | Developer | INACTIVE | `3200.00` | 2023-05-01 | 119999996 | Rua D | Vila Tibério | 14000-003 |
| `pedro.santos@example.com` | Pedro Santos | QA | ACTIVE | `4500.00` | 2022-09-10 | 119999995 | Rua E | Campos Eliseos | 14000-004 |
| `lucas.pereira@example.com` | Lucas Pereira | Developer | ACTIVE | `3900.00` | 2022-11-02 | 119999994 | Rua F | Centro | 14000-005 |
| `fernanda.alves@example.com` | Fernanda Alves | Product Owner | ACTIVE | `4100.00` | 2021-04-12 | 119999993 | Rua G | Ipiranga | 14000-006 |
| `ricardo.gomes@example.com` | Ricardo Gomes | Support | ACTIVE | `3800.00` | 2020-06-30 | 119999992 | Rua H | Centro | 14000-007 |
| `juliana.rocha@example.com` | Juliana Rocha | Developer | ACTIVE | `4600.00` | 2021-08-21 | 119999991 | Rua I | Jardim Paulista | 14000-008 |
| `bruno.martins@example.com` | Bruno Martins | QA | INACTIVE | `3700.00` | 2022-12-01 | 119999990 | Rua J | Centro | 14000-009 |

### 10.2 Idempotency

Seed source lives under `backend/src/database/seed.ts` and compiles to `dist/database/seed.js`.

The seed inserts missing records by canonical email using database conflict skipping. It does not update an existing canonical employee and does not delete legacy/custom rows.

Consequences:

- A migrated representative already carrying a canonical email is skipped.
- A missing canonical demo employee is inserted with a server-generated ID.
- An edited former demo employee survives under its fallback email, while the missing canonical record is inserted.
- A second successful seed invocation inserts zero rows.
- Any seed failure sets a non-zero process exit status after disconnecting Prisma, which prevents API startup.

Phase 2's explicitly authenticated reset operation, not startup seed, will own destructive restoration of demo data.

## 11. Temporary Phase 1 XLSX Compatibility

### 11.1 Boundary

The existing XLSX import and export remain available and are mechanically adapted to the canonical Employee contract. Phase 1 does not introduce preview, confirmation, a downloadable template, a rejection-report download, a redesigned workflow/UI, or filter-aware export.

The existing first-party import/export controls remain visible. Their types, request handling, and English summary keys change only as required by this contract.

### 11.2 Import endpoint

```text
POST /employees/import
Content-Type: multipart/form-data
Form field: file
```

File-level rules:

- Maximum size: 5 MiB.
- Required extension: `.xlsx`, compared case-insensitively.
- Required MIME type: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.
- Only the first worksheet is processed.
- A missing `file` form part fails before workbook parsing with HTTP 422 `VALIDATION_ERROR`. Its structured `details` contains an issue whose `path` is `file`; it is not an `INVALID_XLSX` error.
- A corrupt workbook, missing first worksheet, missing required header, duplicate header, or unknown header is a structural failure and returns HTTP 422 `INVALID_XLSX`.
- A workbook whose first worksheet contains the exact valid header row and zero data rows is structurally valid. It returns HTTP 200 with `total: 0`, `inserted: 0`, and `rejected: 0`. A worksheet with no header row is not an empty valid workbook; it returns `INVALID_XLSX`.

| XLSX header | Required | Accepted cell input | Canonical value |
|---|---:|---|---|
| `email` | Yes | String | Trimmed, lowercase email; maximum 254 characters |
| `fullName` | Yes | String | Trimmed string, 1–120 characters |
| `jobTitle` | Yes | String | Trimmed string, 1–120 characters |
| `status` | Yes | String | `ACTIVE`, `ON_LEAVE`, or `INACTIVE` |
| `salary` | Yes | Text decimal or numeric cell | Positive `Decimal(12,2)`, normalized to a two-decimal string |
| `hireDate` | Yes | Literal ISO text | Exact `YYYY-MM-DD` |
| `phone` | No | String, blank, or absent | String 1–30 characters or `null` |
| `address` | No | String, blank, or absent | String 1–200 characters or `null` |
| `neighborhood` | No | String, blank, or absent | String 1–100 characters or `null` |
| `postalCode` | No | String, blank, or absent | String 1–20 characters or `null` |

XLSX numeric salary cells are transport-normalized only if their mathematical value is positive, within `9999999999.99`, and has no more than two fractional digits. Integer and one-decimal spreadsheet cells normalize to two decimal places. JSON requests remain stricter and require a two-decimal string.

Ambiguous locale date strings and numeric Excel date serials are rejected in Phase 1. Export writes literal ISO text, so export/import round-trip is unambiguous.

Each row is normalized into `CreateEmployeeDTO` and passed through the same canonical create validation and service use case as `POST /employees`. The import code must not call the repository directly or weaken email, status, salary, date, length, unknown-key, or uniqueness rules.

Temporary partial-success semantics remain:

- Rows are processed in worksheet order.
- Each valid row commits independently.
- Invalid rows are counted as rejected.
- For duplicate normalized emails within a workbook, the first otherwise-valid row may insert and later conflicts are rejected.
- The operation does not roll back prior valid rows when a later row is rejected.
- Phase 1 returns counts only; it does not return or download row-level rejection details.

Success response:

```json
{
  "data": {
    "total": 10,
    "inserted": 8,
    "rejected": 2
  }
}
```

A structurally valid workbook returns HTTP 200 even when it has zero data rows or every data row is rejected; row validation failures appear only in the summary counts during this temporary workflow. File-level failures use 413, 415, or 422 according to Section 8.

### 11.3 Export endpoint

```text
GET /employees/export
```

Export uses a strict empty query schema. Any supplied query key or value, including `page`, `pageSize`, `search`, `status`, `sortBy`, or `sortOrder`, returns HTTP 422 `VALIDATION_ERROR`; Phase 1 never silently ignores an export query.

A queryless request:

- Exports all employees through `findAllForExport()` and is never paginated or truncated to a page.
- Applies no list search, status filter, or caller-selected sorting in Phase 1.
- Orders rows by `fullName ASC, id ASC` for deterministic output.
- Uses worksheet name `Employees`.
- Downloads as `employees.xlsx` with the XLSX MIME type.
- Excludes `id`, `createdAt`, and `updatedAt`.

Phase 4 owns the future change that may accept current search, status-filter, and sort inputs while continuing to ignore pagination. That future contract is not partially implemented in Phase 1.

Columns are emitted in this exact order:

| Position | Column | XLSX representation |
|---:|---|---|
| 1 | `email` | Lowercase text |
| 2 | `fullName` | Text |
| 3 | `jobTitle` | Text |
| 4 | `status` | Enum text |
| 5 | `salary` | Fixed two-decimal text |
| 6 | `hireDate` | `YYYY-MM-DD` text |
| 7 | `phone` | Text or blank |
| 8 | `address` | Text or blank |
| 9 | `neighborhood` | Text or blank |
| 10 | `postalCode` | Text or blank |

An exported workbook must be accepted by the Phase 1 importer when imported into a database that does not already contain those emails.

## 12. Mechanical Frontend Compatibility

The frontend must mechanically adopt:

- `id`, `email`, `fullName`, `jobTitle`, `status`, `salary`, `hireDate`, `phone`, `address`, `neighborhood`, `postalCode`, `createdAt`, and `updatedAt`.
- Salary as a two-decimal string rather than `number`.
- Nullable optional fields.
- `PATCH` for edits.
- Canonical list query and pagination metadata names.
- `inserted` and `rejected` import summary keys.
- Configurable API base URL rather than a hard-coded development URL.

Existing components may add the now-required email input and replace legacy field bindings so basic CRUD remains usable. Layout, visual styling, modal behavior, responsiveness, accessibility redesign, summary cards, and XLSX workflow UX remain Phase 3 or Phase 4 work.

The Phase 1 interface is English-only. Employee salary is displayed in US dollars with `Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 })`. Hire date is displayed as the canonical `YYYY-MM-DD` string and must not be passed through locale-sensitive or timezone-shifting date rendering such as `new Date(value).toLocaleDateString()`.

Frontend state, request bodies, and response handling send and receive the canonical unformatted salary and hire-date strings unchanged. Formatting is presentation-only and never changes the API contract.

## 13. Docker, Startup, Health, and Compose Isolation

### 13.1 Backend build output

Backend TypeScript build configuration uses source root `src` and output root `dist`. Tests are excluded from the production build. Seed source is placed below `src` so a normal build produces the exact approved artifacts:

```text
dist/database/seed.js
dist/server.js
```

The image build must explicitly assert that both files exist. Historical paths `dist/prisma/seed.js` and `dist/app.js` are not supported.

### 13.2 Backend production image

The backend uses a multi-stage Node build:

- Dependency installation uses committed manifests/lockfile and `npm ci`.
- Prisma Client generation occurs during build.
- TypeScript compilation occurs during build.
- Runtime contains production dependencies, generated Prisma Client, compiled `dist`, Prisma schema, and migration history.
- Prisma CLI is a runtime dependency because startup invokes `migrate deploy`.
- The runtime user is non-root.
- No global `ts-node` or TypeScript install exists.
- Production never runs TypeScript source.

The image owns this fail-fast sequence:

```text
node_modules/.bin/prisma migrate deploy
node dist/database/seed.js
node dist/server.js
```

These commands are chained so a migration or seed failure prevents the server from starting. Compose must not override the image command.

### 13.3 Frontend image

The frontend adds `serve` as a normal production dependency recorded in `frontend/package.json` and `frontend/package-lock.json`. Its multi-stage Node image uses `npm ci`, runs the existing type-check/build pipeline, installs only lockfile-defined production dependencies in the runtime stage, and starts the compiled directory with:

```text
node_modules/.bin/serve -s dist -l 5173
```

It must not install a global `serve` package during image construction.

The builder stage declares an explicit Docker build argument named `VITE_API_BASE_URL`, verifies that it is non-empty, exposes it only to the Vite build step, and then runs `npm run build`. The implementation follows this contract or an equivalent form that fails on an empty value:

```dockerfile
ARG VITE_API_BASE_URL
RUN test -n "$VITE_API_BASE_URL" && VITE_API_BASE_URL="$VITE_API_BASE_URL" npm run build
```

Vite embeds that project-specific API base URL into the compiled static assets. The runtime image neither reads nor promises runtime substitution for `VITE_API_BASE_URL`.

No source or `/app/dist` bind mount may replace image output in the production-style Compose configuration.

### 13.4 Environment contract

Backend startup validates:

| Variable | Rule |
|---|---|
| `DATABASE_URL` | Required PostgreSQL connection URL |
| `PORT` | Integer 1–65535 |
| `CORS_ORIGIN` | Required HTTP(S) origin; no wildcard for the public demo |
| `NODE_ENV` | `development`, `test`, or `production` |

`server.ts` supplies `process.env` to the pure parser once, receives the normalized `AppConfig`, and passes it to `createApp`. CORS is configured exclusively from `config.corsOrigin`; `app.ts` does not independently inspect environment variables.

Frontend build uses the exact variable `VITE_API_BASE_URL`. It is a required build-time public URL, not a runtime container configuration variable. Local Vite builds and Docker builds both fail clearly when it is absent or empty. No hard-coded development API URL or runtime configuration loader is introduced. Example environment files contain non-secret example values. Session secrets belong to Phase 2 and are not introduced now.

### 13.5 Health endpoints

```text
GET /health/live
GET /health/ready
```

- Liveness reports that the HTTP process is running and does not depend on the database.
- Readiness performs a lightweight database query and returns non-success when PostgreSQL is unavailable.
- Health responses expose no secrets or detailed database errors.

PostgreSQL has a `pg_isready` health check. API startup depends on the database with `condition: service_healthy`. Frontend startup depends on the API with `condition: service_healthy`.

### 13.6 Compose isolation

Compose must contain:

- No `container_name` for database, API, or frontend.
- No fixed top-level project name.
- No custom physical `name` on `postgres_data`.
- No external shared application volume.
- No `/app/dist` bind mount.
- No backend command override.
- No `restart: always` for local services.

`postgres_data` remains a logical named volume whose physical name is scoped by the Compose project. The default network and Compose-built images are likewise project-scoped.

The database does not publish a host port because the API reaches it over the Compose network. API uses `${API_PORT:-3000}:3000`, and frontend uses `${FRONTEND_PORT:-5173}:5173`, so two projects can supply different host-port sets.

Compose passes the public API URL explicitly as a frontend build argument:

```yaml
frontend:
  build:
    context: ./frontend
    args:
      VITE_API_BASE_URL: ${VITE_API_BASE_URL:?set a public API base URL}
```

The API service receives `CORS_ORIGIN` as the corresponding public frontend origin, for example `${CORS_ORIGIN:?set the public frontend origin}`. `VITE_API_BASE_URL` identifies the browser-reachable API URL, while `CORS_ORIGIN` identifies the browser-visible frontend origin; neither uses a Compose service hostname intended only for container-to-container traffic.

Isolation verification creates two uniquely named temporary projects with distinct host ports, distinct `VITE_API_BASE_URL` build arguments, and matching distinct `CORS_ORIGIN` values. Each project builds its own project-scoped frontend image, and inspection verifies that each compiled frontend calls its own browser-reachable API URL and that each API permits only its own frontend origin. The verification also inspects actual container/network/image/volume names and `com.docker.compose.project` labels and asserts disjoint resource sets. Cleanup targets only those exact temporary project names and does not remove pre-existing resources.

The already unstaged deletion of `restart: always` is intentionally adopted in the later Docker implementation commit. Deployment-specific restart policy remains deferred.

### 13.7 Docker ignore rules

Backend and frontend build contexts exclude at least:

- `node_modules`.
- `dist`.
- Coverage and test output.
- Git metadata.
- Local environment files containing secrets.
- Editor/OS temporary files.

Prisma schema and migrations must remain included in the backend context.

## 14. Dependency and Reproducibility Policy

Committed `package-lock.json` files plus `npm ci` are the reproducibility mechanism. Phase 1 does not mechanically remove semver ranges or pin every `package.json` entry for appearance.

Dependency changes are allowed only for:

1. Approved Phase 1 validation, test, lint, formatting, or runtime tooling.
2. Removal of packages confirmed unused by source/build/runtime checks.
3. Individually justified compatible security upgrades.
4. Moving Prisma CLI to production dependencies because startup requires it.

Phase 1 removes the direct `pg` and `uuid` packages because no backend TypeScript/JavaScript import or required runtime adapter uses them. Their removal requires matching lockfile changes plus clean-install, build, and test evidence.

Every manifest edit must include the matching lockfile edit. Verification starts from `npm ci` in the affected package. No blind `npm audit fix`, unrelated dependency update, wholesale lockfile regeneration, Git/npm configuration change, or cosmetic version pinning is allowed.

Security review distinguishes production dependencies from development-only tooling. High/critical runtime findings must be fixed through a compatible, individually reviewed change or explicitly recorded as an unresolved release blocker; they are not hidden by a bulk command.

## 15. Test and Local Quality Baseline

### 15.1 Test layers

**Validation unit tests** cover every field boundary, exact length limit, normalization rule, enum, salary representation, date round trip, unknown field, and list-query whitelist.

**Service unit tests** inject a narrow repository fake/mock and cover not-found behavior, forwarding canonical `EmployeeListOptions`, pagination metadata, uniqueness translation, partial update, delete, argument-free export-all behavior, and XLSX row delegation to the canonical create use case. Service assertions use no Prisma query-input shapes.

**Repository unit/integration tests** cover the internal mapping from every allowed `EmployeeListOptions` combination to Prisma `where`, whitelisted `orderBy`, `skip`, and `take`, including the stable `id ASC` tiebreaker. They also cover canonical salary-string to `Prisma.Decimal` conversion, canonical hire-date conversion without timezone drift, and conversion of persisted records back to Prisma-independent domain values.

**Configuration unit tests** pass explicit environment-like objects to the pure parser and cover missing, invalid, and normalized values without mutating `process.env`. Importing the configuration module has no side effects.

**API integration tests** import `app.ts` without reading environment state or opening a port and exercise `createApp(testConfig, testDependencies)` through Supertest. They use a dedicated test-only PostgreSQL database with migrations applied. Tests cover success envelopes, status codes, pagination metadata, stable ordering, filtering/search, conflicts, sanitization, health, strict export-query rejection, and the absence of import/listener side effects.

**Migration integration tests** cover:

- Original ten rows.
- Repeated exact seed duplicates inserted in different orders.
- Unrelated custom employees.
- Edited and partial-match seed-like employees.
- Nullable optional fields.
- Empty and whitespace-only optional fields.
- Unsupported statuses.
- Zero and negative salaries.
- Salary above `9999999999.99`.
- Salary with more than two fractional digits.
- PostgreSQL non-finite timestamps.
- PostgreSQL dates outside `0001-01-01`–`9999-12-31`.
- Test-injected conversion failure before commit.
- Logical application catalog and ordered-row equality after failure.

**Seed integration tests** run the compiled seed twice and prove that the second run inserts nothing and does not overwrite edited canonical records.

**XLSX integration tests** cover valid import, a valid header-only workbook with zero data rows, missing `file` as `VALIDATION_ERROR` with an issue in `details` whose `path` is `file`, partial success, same-file duplicate email, existing email conflict, invalid header sets, corrupt workbook, oversize upload, invalid salary/date/status/email/lengths, successful queryless export, rejection of every supplied export query key, all-row non-paginated export, exact column order, and export/import round trip.

**Frontend smoke checks** verify English labels, exact `en-US` USD salary formatting, literal `YYYY-MM-DD` hire-date display without timezone conversion, and unchanged canonical salary/date strings at the API boundary.

**Docker checks** cover clean image builds, required non-empty `VITE_API_BASE_URL` build arguments, exact compiled artifact paths, direct image startup, startup failure propagation, health gating, no source runtime, and two-project resource isolation. The two-project check verifies distinct project-scoped images with the correct embedded API URLs and corresponding API CORS origins.

### 15.2 Database isolation

Database-mutating tests must refuse to run unless the resolved database/project is explicitly marked test-only. Each migration test receives a fresh uniquely named database or Compose project. Cleanup targets only that allocation.

No test truncates, resets, resolves migrations, drops databases, or removes Docker resources based on an unverified or production-capable connection string.

### 15.3 Jest and build discovery

Jest configuration explicitly limits discovery to source test files and ignores `dist`. Production TypeScript build configuration excludes tests. A test file is executed once, never as both TypeScript source and compiled JavaScript.

### 15.4 Required local commands

Backend verification runs from `backend`:

```text
npm ci
npm run prisma:generate
npm run type-check
npm run lint
npm run format:check
npm run test:unit
npm run test:integration
npm test
npm run build
npx --no-install prisma validate
```

Frontend verification runs from `frontend`:

```text
npm ci
npm run type-check
npm run lint
npm run format:check
npm run build
```

Phase 1 does not add a frontend unit-test framework; frontend behavior verification is limited to type/build checks and the existing UI's API/XLSX smoke path until the Phase 3 UX work. Backend Prisma migration status/deploy checks run only against an isolated database. Docker/Compose verification is separate from unit tests and reports exact resources created and their final state.

ESLint with TypeScript support, Prettier, and EditorConfig are sufficient for Phase 1. CI integration remains Phase 5.

## 16. Expected Implementation Surface

This section identifies ownership, not implementation order.

- `backend/prisma/schema.prisma` and one new custom migration.
- Seed relocation to `backend/src/database/seed.ts`; removal of generated/dead seed duplicates from source locations.
- `backend/src/app.ts` and `backend/src/server.ts` entrypoint correction, with `createApp(config, dependencies?)` and exactly one environment parse/listen path.
- Pure environment parsing and `AppConfig`, domain errors, global error translation, request validation, and response serialization modules.
- Employee DTO/schema, controller, service, repository, and route changes.
- Health routes.
- Existing XLSX upload/service/controller code mechanically adapted to the canonical use case.
- Backend TypeScript, Jest, lint, formatting, package manifest, lockfile, and Docker build configuration.
- Frontend Employee types, API client, composable, existing components, build-time `VITE_API_BASE_URL`, English USD/date presentation, quality configuration, package manifest/lockfile, and Docker image.
- Root/local Compose changes, including frontend build arguments, matching API `CORS_ORIGIN`, removal of fixed container names, and explicit adoption of the existing restart-policy deletion.
- Backend/frontend Docker ignore and environment example files.

No authentication, reset, new page, redesigned component, Phase 4 XLSX workflow, deployment, CI, README, or portfolio file belongs in this surface.

## 17. Acceptance Criteria

### 17.1 Data and migration

- The checked-in physical `uuid` type is treated as `TEXT`; deterministic representative ordering uses `uuid COLLATE "C" ASC`.
- Explicit `BEGIN`/`COMMIT` encloses all preflight, data, and schema work.
- The Employee table is locked before preflight.
- Invalid preflight and test-injected conversion failures leave the application catalog and ordered Employee values logically identical.
- Possible `_prisma_migrations` bookkeeping is reported separately from application rollback.
- Original rows and UUIDs survive.
- Exactly one full-fingerprint representative receives each canonical email.
- Representative selection is stable when insertion order changes.
- Every non-representative row receives its UUID-based fallback email.
- No existing row is deleted or replaced.
- Empty optional strings become `NULL`.
- Unknown status, invalid salary, or incompatible date causes atomic failure.
- Salary is `DECIMAL(12,2)` with no silent rounding.
- Hire date is PostgreSQL `date` and serializes as `YYYY-MM-DD`.
- Physical legacy names remain under Prisma `@map`.

### 17.2 Seed

- The compiled path is exactly `dist/database/seed.js`.
- The complete ten-record dataset matches Section 10.
- Existing canonical emails are not overwritten.
- Missing canonical emails are inserted.
- Repeated compiled seed execution is idempotent.
- Seed failure prevents server startup.

### 17.3 API

- Prisma, runtime schemas, DTOs, API JSON, and frontend types use canonical names.
- Every exact limit in Section 6 is tested at below, at, and above boundary values.
- Salary JSON is always a two-decimal string.
- Create/update reject server fields and unknown keys.
- Partial updates use `PATCH` and require at least one field.
- Email normalization and database uniqueness remain race-safe.
- Pagination metadata and no-result behavior match Section 7.
- Search, status filtering, sort whitelist, and `id ASC` tiebreaking are verified.
- Controller and service layers use only canonical Prisma-independent `EmployeeListOptions`; only the repository constructs Prisma list inputs and performs salary/date persistence conversion.
- `createApp` receives explicit `AppConfig` and optional dependencies, reads no environment state, and never listens; `server.ts` parses `process.env` once and creates the only listener.
- Not-found, conflict, malformed JSON, validation, file, unknown-route, and internal errors have distinct sanitized responses.

### 17.4 XLSX

- Existing import and export endpoints remain operational.
- Canonical headers, required/optional rules, and exact column order match Section 11.
- Import passes every row through canonical create validation and the create use case.
- Partial success remains deterministic.
- Missing upload file returns 422 `VALIDATION_ERROR` with a `file` detail; malformed workbook structure returns 422 `INVALID_XLSX`.
- A valid header-only workbook succeeds with zero counts.
- Queryless export includes all employees through the dedicated non-paginated repository method.
- Any export query parameter, including pagination, filtering, or sorting parameters, returns 422 `VALIDATION_ERROR`; no Phase 1 export query is silently ignored.
- Phase 4 filter-aware export remains deferred and, when introduced, will accept search/filter/sort while continuing to ignore pagination.
- Export/import round trip succeeds in an empty isolated database.
- No preview, confirmation, template, rejection-report download, or redesigned XLSX workflow appears.

### 17.5 Frontend

- Existing CRUD and XLSX controls compile and function with canonical types.
- Email is supported where mechanically required.
- Edit requests use `PATCH`.
- Pagination metadata and import summary names match the API.
- Salary displays as USD through the exact `en-US` formatter in Section 12, and hire date displays as literal `YYYY-MM-DD` without timezone or locale conversion.
- Requests and responses retain unformatted canonical salary and hire-date strings.
- No visual/product redesign enters the diff.

### 17.6 Docker and Compose

- The backend production image contains `dist/database/seed.js` and `dist/server.js`.
- `app.ts` exposes `createApp(config, dependencies?)`, never reads environment state, and never listens; `server.ts` parses the environment and listens once.
- Image startup runs migration, compiled seed, then compiled server.
- The frontend image requires and embeds the project-specific `VITE_API_BASE_URL` build argument; there is no runtime frontend configuration promise or hard-coded API URL.
- Compose passes matching browser-reachable API and frontend origins through `VITE_API_BASE_URL` and `CORS_ORIGIN` respectively.
- Production uses no `ts-node`, source command, global TypeScript, or Compose backend command override.
- No fixed container name, fixed volume physical name, external application volume, or `/app/dist` bind mount remains.
- Database health gates API startup; readiness checks database access.
- Two uniquely named projects resolve to disjoint containers, networks, images, and volumes and can use distinct host ports.
- Validation cleanup removes only resources created under those exact temporary project names.
- The existing `restart: always` removal is retained and explicitly included in the later Docker commit.

### 17.7 Dependencies and quality

- Backend and frontend clean installs use `npm ci` with committed matching lockfiles.
- Every manifest edit has a Phase 1 justification and matching lockfile edit.
- No blind audit fix, bulk pinning, unrelated upgrade, or npm/Git configuration change occurs.
- Type-check, lint, formatting check, unit tests, integration tests, Prisma validation, builds, and Docker startup checks pass from clean installs.
- Jest executes source tests exactly once.
- Production dependency vulnerabilities are handled individually or remain explicit release blockers.

### 17.8 Scope

- No Phase 2 authentication/reset behavior enters Phase 1.
- No Phase 3 redesign enters Phase 1.
- No Phase 4 advanced XLSX behavior enters Phase 1.
- No Phase 5 CI, deployment, README, or portfolio work enters Phase 1.
- No unrelated tracked file is changed, staged, or committed.

## 18. Consolidated Phase 1 Decisions

| Area | Final decision | Enforcement |
|---|---|---|
| Delivery | Coordinated in-place cutover | Backend and first-party frontend change together |
| Prisma/API naming | Canonical camelCase | Runtime schemas, DTOs, serializer, and frontend types |
| Physical columns | Preserve legacy names | Prisma `@map` and custom migration |
| Legacy UUID | Keep physical `TEXT` | `id String @map("uuid")` |
| Representative ordering | `uuid COLLATE "C" ASC` | Valid for checked-in physical `TEXT`; tested under reordered inserts |
| Email | Required, trimmed, lowercase, unique | Zod, DB normalization check, unique index |
| Non-representative rows | `legacy+<lowercase uuid>@example.com` | Exhaustive transactional backfill |
| Status | `ACTIVE`, `ON_LEAVE`, `INACTIVE` | Zod plus PostgreSQL enum |
| Salary | `Decimal(12,2)` and two-decimal JSON string | Preflight, DB type/check, serializer |
| Invalid legacy salary | Abort without rounding | Transactional preflight |
| Hire date | PostgreSQL `date`, API `YYYY-MM-DD` | Preflight, native type, UTC-safe mapper |
| Optional empty values | Convert to `NULL` | Migration and input normalization |
| Migration atomicity | One explicit PostgreSQL transaction | `BEGIN`, initial table lock, `COMMIT` |
| Update route | `PATCH /employees/:id` | Route and API tests |
| List behavior | Canonical `EmployeeListOptions`, whitelisted query, and stable `id ASC` tiebreaker | Zod produces Prisma-independent options; repository alone builds Prisma inputs |
| Errors | Stable sanitized envelope | Domain errors and final middleware |
| XLSX availability | Existing import/export retained | Mechanically adapted handlers and integration tests |
| XLSX import | Canonical validation/use case, partial success | Row normalization then normal create path |
| XLSX import file errors | Missing file is `VALIDATION_ERROR`; workbook structure is `INVALID_XLSX` | Global error envelope and endpoint tests |
| XLSX export | Strict empty query; queryless request exports all; any query is 422; output is never paginated | Strict empty schema and dedicated non-paginated repository method |
| Frontend | Mechanical contract compatibility, English UI, `en-US` USD, literal `YYYY-MM-DD` | Existing components and boundary smoke checks; no redesign |
| Seed artifact | `dist/database/seed.js` | Source placement and image assertion |
| Server artifact | `dist/server.js` | Source placement and image assertion |
| Configuration bootstrap | Pure `parseEnvironment(source)` returns `AppConfig` | Unit tests with explicit objects and no `process.env` mutation |
| Express app | `createApp(config, dependencies?)`; no environment read or listener | `app.ts` tests and source review |
| Production execution | Compiled JavaScript only | Multi-stage image and direct startup test |
| Frontend API URL | Required `VITE_API_BASE_URL` Docker build argument | Vite build embeds each project's browser-reachable API URL; no runtime substitution |
| API CORS | `CORS_ORIGIN` is each project's public frontend origin | Startup validation and two-project isolation check |
| Compose names | No fixed `container_name` | Project-scoped generated resources |
| Compose volume | Project-scoped `postgres_data` | No physical `name` or external volume |
| Restart policy | Keep `restart: always` removed locally | Explicit later Docker commit |
| Reproducibility | `npm ci` plus committed lockfiles | Clean-install gates |
| Dependency changes | Tooling, confirmed removals, justified compatible security upgrades only | Manifest review and clean verification |
| Deferred work | Authentication, reset, redesign, filter/sort-aware XLSX export, advanced XLSX UX, deployment, portfolio | Phase 4 may add export search/filter/sort but still ignores pagination; scope review and diff inspection |
