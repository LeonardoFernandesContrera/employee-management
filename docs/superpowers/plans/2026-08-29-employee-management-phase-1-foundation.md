# Employee Management Phase 1 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut the database, backend API, temporary XLSX workflow, existing Vue interface, and compiled container runtime over to one canonical Employee contract without losing valid legacy rows or identifiers.

**Architecture:** Keep Express controllers limited to HTTP translation, place use-case behavior in an injected Employee service, and make a Prisma repository the only Employee layer that constructs Prisma queries or persistence values. Apply one explicit transactional PostgreSQL migration, run an idempotent compiled seed, adapt the first-party Vue client in the same release, and verify both database and Compose work only inside uniquely named disposable resources.

**Tech Stack:** Node.js 20, TypeScript 5.9, Express 5, Zod, Prisma 6, PostgreSQL 15, Jest/ts-jest/Supertest, SheetJS XLSX, Vue 3, Vite 7, Axios, Docker, and Docker Compose.

**Spec:** [Approved Phase 1 foundation design](../specs/2026-08-28-employee-management-phase-1-foundation-design.md) (`docs/superpowers/specs/2026-08-28-employee-management-phase-1-foundation-design.md`)

## Global Constraints

- Execute this plan only after approval, using `superpowers:subagent-driven-development` or `superpowers:executing-plans`; do not execute implementation steps during plan review.
- Treat the delivery as one coordinated contract cutover. Legacy JSON names, legacy XLSX headers, and partial `PUT /employees/:id` do not survive Phase 1.
- Preserve every compatible legacy Employee row and physical `uuid`; never delete, replace, or regenerate an existing identifier.
- Keep physical legacy column names through Prisma `@map`; physical `uuid` remains PostgreSQL `TEXT`, and representative ordering is `uuid COLLATE "C" ASC`.
- Validate `email` at a maximum of 254 characters; `fullName` and `jobTitle` at 1–120; non-null `phone` at 1–30; non-null `address` at 1–200; non-null `neighborhood` at 1–100; and non-null `postalCode` at 1–20.
- Salary input is a positive, fixed two-decimal string matching `(?:0|[1-9][0-9]{0,9})\.[0-9]{2}` and no greater than `9999999999.99`. Hire date input and output is a real `YYYY-MM-DD` date in `0001-01-01`–`9999-12-31`.
- Unknown body/query keys fail validation. Required create fields never accept `null`; optional text accepts omitted, `null`, or empty input, with empty input normalized to `null`.
- List query defaults are `page=1`, `pageSize=10`, `sortBy=fullName`, and `sortOrder=asc`; `page` is an integer at least 1, `pageSize` is an integer from 1–100, and non-empty trimmed `search` is 1–100 characters. Optional `status` and both sort fields accept only their declared enums.
- Public errors use the approved sanitized `{ error: { code, message, details? } }` envelope. Do not expose SQL, Prisma internals, stack traces, local paths, or secrets.
- `app.ts` exports `createApp(config, dependencies?)` and never reads `process.env` or listens. `server.ts` parses `process.env` once and owns the only listener.
- Import must pass each normalized row through the canonical create use case and retain partial-success counts. Export accepts no query keys, exports all employees, and is never paginated.
- The existing interface remains English-only, displays salary with stable `en-US` USD formatting, displays hire date literally as `YYYY-MM-DD`, and sends canonical unformatted strings.
- Production startup paths are exactly `dist/database/seed.js` and `dist/server.js`; production never runs TypeScript source.
- The committed Compose baseline already omits `restart: always`. Preserve that state; never stage or claim the earlier removal again. The Docker task owns only the remaining approved Compose changes.
- Use `npm ci` as the clean-install gate. Every manifest change includes its matching lockfile. Do not run a blind audit fix, bulk dependency update, or cosmetic pinning pass.
- Database mutation is allowed only against a validated, uniquely named disposable database/project. Docker cleanup targets only exact resources created by the current verification run.
- Do not add authentication/reset behavior, UI redesign, advanced XLSX UX/filter-aware export, deployment/CI, README/portfolio work, or unrelated refactoring from Phases 2–5.
- Each task stages only its listed paths and creates its own narrow Conventional Commit. Do not amend, squash, rebase, reset, rewrite, force-push, modify Git/npm configuration, or push as part of this plan.

---

## Implementation-Surface Map

### Files to create

| Path | Responsibility | First task |
|---|---|---:|
| `.editorconfig` | Repository-wide newline, encoding, and indentation baseline | 1 |
| `.prettierignore` | Exclude generated, dependency, coverage, and local secret artifacts from formatting | 1 |
| `prettier.config.cjs` | Shared deterministic formatting rules | 1 |
| `backend/eslint.config.js` | TypeScript-aware backend lint configuration | 1 |
| `backend/tsconfig.test.json` | Test-only TypeScript compilation settings | 1 |
| `backend/src/test/config/jestDiscovery.unit.test.ts` | Prove scripts/build/test discovery boundaries | 1 |
| `frontend/eslint.config.js` | Vue/TypeScript-aware frontend lint configuration | 1 |
| `backend/src/domain/employee.ts` | Prisma-independent Employee entity, list, pagination, and repository contracts | 2 |
| `backend/src/validation/employeeSchemas.ts` | Canonical strict Zod schemas and inferred input DTOs | 2 |
| `backend/src/config/appConfig.ts` | Pure environment parser and immutable `AppConfig` | 2 |
| `backend/src/test/validation/employeeSchemas.unit.test.ts` | Exact field/query/date/salary boundary tests | 2 |
| `backend/src/test/config/appConfig.unit.test.ts` | Pure configuration-parser tests | 2 |
| `backend/src/errors/ApplicationError.ts` | Prisma-independent application error codes/details | 3 |
| `backend/src/serialization/employeeSerializer.ts` | Canonical public Employee serializer | 3 |
| `backend/src/http/validatedHandler.ts` | Typed Zod-to-Express validation adapter | 3 |
| `backend/src/routes/HealthRoute.ts` | Liveness and injected-readiness endpoints | 3 |
| `backend/src/appDependencies.ts` | Application dependency construction contract | 3 |
| `backend/src/test/http/app.integration.test.ts` | Supertest coverage for bootstrap, health, errors, and no-listen imports | 3 |
| `backend/test/docker-compose.postgres.yml` | Ephemeral PostgreSQL 15 service for isolated integration/migration tests | 4 |
| `backend/scripts/run-isolated-tests.mjs` | Unique Compose-project lifecycle and exact cleanup wrapper | 4 |
| `backend/src/test/support/testDatabase.ts` | Guarded disposable-database allocation and Prisma command helpers | 4 |
| `backend/src/test/support/testDatabaseSafety.unit.test.ts` | Production-target refusal and naming tests | 4 |
| `backend/src/test/support/testDatabase.integration.test.ts` | Allocation/drop and exact-resource cleanup proof | 4 |
| `backend/prisma/migrations/20260829000100_employee_phase_1_foundation/migration.sql` | Atomic preflight, deterministic backfill, conversion, constraints, and indexes | 5 |
| `backend/src/test/fixtures/legacyEmployees.ts` | Exact legacy fingerprints plus invalid/duplicate/custom fixtures | 5 |
| `backend/src/test/migration/employeeFoundationMigration.integration.test.ts` | Migration preservation, ordering, rollback, ledger, and retry tests | 5 |
| `backend/src/database/seed.ts` | Compiled canonical ten-record idempotent seed | 6 |
| `backend/src/test/database/seed.integration.test.ts` | Compiled-path and repeated-seed behavior tests | 6 |
| `backend/src/database/prisma.ts` | Configurable Prisma client factory without import-time connection | 7 |
| `backend/src/test/repositories/EmployeeRepository.integration.test.ts` | Prisma mapping, conversion, filtering, sorting, and race tests | 7 |
| `backend/src/test/services/EmployeeService.unit.test.ts` | Repository-independent use-case tests | 7 |
| `backend/src/test/http/employees.integration.test.ts` | Complete CRUD/list/error HTTP contract tests | 8 |
| `backend/src/xlsx/employeeWorkbook.ts` | XLSX structure, row normalization, partial import, and deterministic export | 9 |
| `backend/src/test/xlsx/employeeWorkbook.integration.test.ts` | Full temporary XLSX boundary and round-trip tests | 9 |
| `frontend/src/utils/employeeFormat.ts` | Stable USD formatter and literal date presenter | 10 |
| `frontend/src/types/employee.contract-check.ts` | Compile-time canonical frontend contract fixture | 10 |
| `backend/.dockerignore` | Backend build-context exclusions while retaining Prisma assets | 11 |
| `frontend/.dockerignore` | Frontend build-context exclusions | 11 |
| `backend/.env.example` | Non-secret backend environment contract | 11 |
| `frontend/.env.example` | Non-secret Vite build-time contract | 11 |
| `scripts/verify-compose-isolation.mjs` | Two-project image/URL/CORS/resource isolation and exact cleanup evidence | 11 |
| `backend/src/test/config/dockerContract.unit.test.ts` | Static compiled-runtime and Compose contract assertions | 11 |
| `backend/src/test/config/dependencyPolicy.unit.test.ts` | Runtime dependency placement/removal policy test | 12 |

### Files to modify

| Path | Final responsibility | Tasks |
|---|---|---|
| `backend/package.json` | Scripts, Zod/test/quality tooling, compiled seed/startup, Prisma runtime placement, confirmed removals | 1, 4, 6, 11, 12 |
| `backend/package-lock.json` | Lockfile for dependency changes made in Tasks 1, 11, and 12 | 1, 11, 12 |
| `backend/tsconfig.json`, `backend/jest.config.js` | `src`→`dist` production build and non-duplicated unit/integration/migration discovery | 1, 4 |
| `backend/prisma/schema.prisma` | Canonical mapped `Employee` model and enum | 5 |
| `backend/src/app.ts`, `backend/src/server.ts` | Pure app factory and single validated listener | 3 |
| `backend/src/middlewares/ErrorMiddleware.ts` | Final global sanitized error translation | 3, 9 |
| `backend/src/repositories/EmployeeRepository.ts` | Repository interface implementation and sole Prisma query mapping | 7 |
| `backend/src/services/EmployeeService.ts` | Canonical CRUD/list/export-all use cases | 7 |
| `backend/src/controllers/EmployeeController.ts` | Typed HTTP translation for CRUD and XLSX | 8, 9 |
| `backend/src/routes/EmployeeRoute.ts` | Canonical `PATCH`, validation wrappers, and XLSX endpoints | 8, 9 |
| `backend/src/utils/upload.ts` | Memory upload, 5 MiB limit, and XLSX transport boundary | 9 |
| `backend/dockerfile` | Multi-stage non-root compiled backend runtime | 11 |
| `frontend/package.json` | Quality scripts/tooling and lockfile-defined `serve` runtime | 1, 11 |
| `frontend/package-lock.json` | Lockfile for the frontend dependency changes made in Task 1 | 1 |
| `frontend/env.d.ts` | Required `VITE_API_BASE_URL` typing | 10 |
| `frontend/src/types/employee.ts` | Canonical frontend inputs/resources/query/envelopes | 10 |
| `frontend/src/api/employee.ts` | Typed API client using build-time base URL and `PATCH` | 10 |
| `frontend/src/composables/useEmployee.ts` | Canonical pagination/import/error state | 10 |
| `frontend/src/views/EmployeeView.vue` | Mechanical canonical bindings and controls | 10 |
| `frontend/src/components/EmployeeTable.vue` | Canonical columns and exact presentation formatting | 10 |
| `frontend/src/components/EmployeeForm.vue` | Complete canonical create input | 10 |
| `frontend/src/components/EmployeeFilter.vue` | Search/status/sort/list query inputs | 10 |
| `frontend/src/components/EmployeeEditModal.vue` | Canonical partial update fields and English controls | 10 |
| `frontend/dockerfile` | Multi-stage static build with required Vite build argument | 11 |
| `docker-compose.yml` | Remaining project-scoped resources, health gates, build args, ports, and compiled image behavior | 11 |
| `frontend/index.html`, `frontend/vite.config.ts`, `frontend/tsconfig.json`, `frontend/tsconfig.app.json`, `frontend/tsconfig.node.json` | Mechanical formatting baseline only; no Task 1 behavior change | 1 |
| `frontend/src/App.vue`, `frontend/src/main.ts`, `frontend/src/router/index.ts`, `frontend/src/style.css` | Mechanical formatting baseline only; no Task 1 behavior change | 1 |

### Files to remove or relocate

| Existing path | Action | Destination/reason | Task |
|---|---|---|---:|
| `backend/src/tests/EmployeeService.test.ts` | Remove | Database-coupled legacy-name test is replaced by injected `.unit.test.ts` coverage | 1 |
| `backend/src/dtos/EmployeeDTO.ts` | Remove | Input DTOs are inferred from `validation/employeeSchemas.ts`; domain outputs live in `domain/employee.ts` | 2 |
| `backend/prisma/seed.ts` | Relocate and rewrite | `backend/src/database/seed.ts`, producing `dist/database/seed.js` | 6 |
| `backend/prisma/seed.js` | Remove | Generated/dead JavaScript must not live in source | 6 |
| `backend/src/utils/prisma.ts` | Remove | Replaced by config-aware `backend/src/database/prisma.ts` | 7 |

### Shared interfaces locked before task execution

```ts
export const EMPLOYEE_STATUSES = ["ACTIVE", "ON_LEAVE", "INACTIVE"] as const;
export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number];

export type EmployeeSortField =
  | "fullName"
  | "email"
  | "jobTitle"
  | "status"
  | "salary"
  | "hireDate";
export type SortOrder = "asc" | "desc";

export interface Employee {
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
  createdAt: Date;
  updatedAt: Date;
}

export interface EmployeeListOptions {
  page: number;
  pageSize: number;
  search?: string;
  status?: EmployeeStatus;
  sortBy: EmployeeSortField;
  sortOrder: SortOrder;
}

export interface EmployeeListResult {
  items: Employee[];
  totalItems: number;
}

export interface EmployeeListMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  sortBy: EmployeeSortField;
  sortOrder: SortOrder;
}

export interface EmployeeRepository {
  create(input: CreateEmployeeDTO): Promise<Employee>;
  findById(id: string): Promise<Employee | null>;
  findPage(options: EmployeeListOptions): Promise<EmployeeListResult>;
  findAllForExport(): Promise<Employee[]>;
  update(id: string, input: UpdateEmployeeDTO): Promise<Employee>;
  delete(id: string): Promise<void>;
}
```

```ts
export type CreateEmployeeDTO = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeDTO = z.infer<typeof updateEmployeeSchema>;
export type EmployeeIdParams = z.infer<typeof employeeIdParamsSchema>;
export type EmployeeListQueryInput = z.input<typeof employeeListQuerySchema>;
export type EmployeeListQueryDTO = z.output<typeof employeeListQuerySchema>;

export interface EmployeeDTO {
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

```ts
export type NodeEnvironment = "development" | "test" | "production";
export interface AppConfig {
  readonly databaseUrl: string;
  readonly port: number;
  readonly corsOrigin: string;
  readonly nodeEnv: NodeEnvironment;
}
export function parseEnvironment(source: NodeJS.ProcessEnv): AppConfig;

export interface AppDependencies {
  readonly employeeRouter: Router;
  readonly readinessCheck: () => Promise<void>;
}
export function createApp(config: AppConfig, dependencies?: AppDependencies): Express;
```

```ts
export type ErrorCode =
  | "MALFORMED_JSON"
  | "EMPLOYEE_NOT_FOUND"
  | "ROUTE_NOT_FOUND"
  | "EMAIL_CONFLICT"
  | "PAYLOAD_TOO_LARGE"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "VALIDATION_ERROR"
  | "INVALID_XLSX"
  | "INTERNAL_ERROR";

export interface ErrorDetail {
  readonly path: string;
  readonly code: string;
  readonly message: string;
}

export class ApplicationError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: readonly ErrorDetail[],
  );
}

export type ValidatedAction<T> = (
  input: T,
  request: Request,
  response: Response,
  next: NextFunction,
) => Promise<void>;

export function validatedHandler<T>(
  schema: z.ZodType<T>,
  select: (request: Request) => unknown,
  handler: ValidatedAction<T>,
): RequestHandler;
```

```ts
export interface ImportSummary {
  total: number;
  inserted: number;
  rejected: number;
}

export interface UploadedWorkbook {
  readonly buffer: Buffer;
  readonly mimetype: string;
  readonly originalname: string;
  readonly size: number;
}

export class EmployeeWorkbook {
  constructor(private readonly employees: EmployeeService);
  importFile(file: UploadedWorkbook): Promise<ImportSummary>;
  exportAll(): Promise<Buffer>;
}
```

---

### Task 1: Establish deterministic test, type, lint, and format infrastructure

**Deliverable:** Both packages have lockfile-backed quality commands; backend tests are discovered once from source; production compilation emits only non-test `src` files; the obsolete database-coupled test is gone.

**Files:**
- Create: `.editorconfig`
- Create: `.prettierignore`
- Create: `prettier.config.cjs`
- Create: `backend/eslint.config.js`
- Create: `backend/tsconfig.test.json`
- Create: `backend/src/test/config/jestDiscovery.unit.test.ts`
- Create: `frontend/eslint.config.js`
- Modify: `backend/package.json`
- Modify: `backend/package-lock.json`
- Modify: `backend/tsconfig.json`
- Modify: `backend/jest.config.js`
- Modify: `frontend/package.json`
- Modify: `frontend/package-lock.json`
- Modify (format-only): `backend/src/app.ts`
- Modify (format-only): `backend/src/controllers/EmployeeController.ts`
- Modify (format-only): `backend/src/dtos/EmployeeDTO.ts`
- Modify (format-only): `backend/src/middlewares/ErrorMiddleware.ts`
- Modify (format-only): `backend/src/repositories/EmployeeRepository.ts`
- Modify (format-only): `backend/src/routes/EmployeeRoute.ts`
- Modify (format-only): `backend/src/server.ts`
- Modify (format-only): `backend/src/services/EmployeeService.ts`
- Modify (format-only): `backend/src/utils/prisma.ts`
- Modify (format-only): `backend/src/utils/upload.ts`
- Modify (format-only): `frontend/index.html`
- Modify (format-only): `frontend/vite.config.ts`
- Modify (format-only): `frontend/tsconfig.json`
- Modify (format-only): `frontend/tsconfig.app.json`
- Modify (format-only): `frontend/tsconfig.node.json`
- Modify (format-only): `frontend/env.d.ts`
- Modify (format-only): `frontend/src/App.vue`
- Modify (format-only): `frontend/src/api/employee.ts`
- Modify (format-only): `frontend/src/composables/useEmployee.ts`
- Modify (format-only): `frontend/src/main.ts`
- Modify (format-only): `frontend/src/router/index.ts`
- Modify (format-only): `frontend/src/style.css`
- Modify (format-only): `frontend/src/types/employee.ts`
- Modify (format-only): `frontend/src/views/EmployeeView.vue`
- Modify (format-only): `frontend/src/components/EmployeeTable.vue`
- Modify (format-only): `frontend/src/components/EmployeeForm.vue`
- Modify (format-only): `frontend/src/components/EmployeeFilter.vue`
- Modify (format-only): `frontend/src/components/EmployeeEditModal.vue`
- Remove: `backend/src/tests/EmployeeService.test.ts`

**Interfaces:**
- Consumes: current Node 20/CommonJS backend, Vue/Vite ESM frontend, and both lockfile-v3 files.
- Produces: `npm run type-check`, `npm run lint`, `npm run format:check`, `npm run test:unit`, `npm run test:integration`, `npm test`, and production `npm run build` commands used by every later task.

- [ ] **Step 1: Write the failing discovery/configuration test**

```ts
// backend/src/test/config/jestDiscovery.unit.test.ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const readJson = (path: string) => JSON.parse(readFileSync(path, "utf8"));

test("quality scripts and production test exclusions are explicit", () => {
  const backendRoot = resolve(__dirname, "../../..");
  const repositoryRoot = resolve(backendRoot, "..");
  const backendPackage = readJson(resolve(backendRoot, "package.json"));
  const frontendPackage = readJson(resolve(repositoryRoot, "frontend/package.json"));
  const tsconfig = readJson(resolve(backendRoot, "tsconfig.json"));

  expect(backendPackage.scripts).toMatchObject({
    "type-check": "tsc --noEmit",
    "test:unit": "jest --selectProjects unit",
    "test:integration": expect.stringContaining("integration"),
  });
  expect(frontendPackage.scripts).toEqual(
    expect.objectContaining({ lint: expect.any(String), "format:check": expect.any(String) }),
  );
  expect(tsconfig.compilerOptions).toMatchObject({ rootDir: "src", outDir: "dist" });
  expect(tsconfig.exclude).toEqual(
    expect.arrayContaining(["src/**/*.test.ts", "src/test/**/*"]),
  );
});
```

- [ ] **Step 2: Run the test and observe the intended red state**

Run from `backend`: `npm test -- --runTestsByPath src/test/config/jestDiscovery.unit.test.ts`

Expected: FAIL because the quality scripts and `rootDir: "src"`/test exclusions do not exist.

- [ ] **Step 3: Add only the approved tooling and update both lockfiles through npm**

Run from `backend`:

```text
npm install zod
npm install --save-dev supertest @types/supertest eslint @eslint/js typescript-eslint globals eslint-config-prettier prettier
```

Run from `frontend`:

```text
npm install serve
npm install --save-dev eslint @eslint/js typescript-eslint eslint-plugin-vue globals eslint-config-prettier prettier
```

Do not run an audit-fix command or update unrelated packages. Confirm that npm corrects the frontend lockfile root package name to `employee-management-frontend` while preserving lockfile version 3.

- [ ] **Step 4: Add the minimal quality/build configuration**

Set backend scripts to:

```json
{
  "build": "tsc",
  "dev": "ts-node-dev --respawn src/server.ts",
  "start": "node dist/server.js",
  "prisma:generate": "prisma generate",
  "type-check": "tsc --noEmit",
  "lint": "eslint \"src/**/*.ts\"",
  "format:check": "prettier --check . --config ../prettier.config.cjs --ignore-path ../.prettierignore",
  "test:unit": "jest --selectProjects unit",
  "test:integration": "jest --selectProjects integration --passWithNoTests",
  "test": "npm run test:unit && npm run test:integration"
}
```

Keep the existing frontend `dev`, `build`, `preview`, `build-only`, and `type-check` scripts, and add:

```json
{
  "lint": "eslint \"src/**/*.{ts,vue}\" vite.config.ts",
  "format:check": "prettier --check . --config ../prettier.config.cjs --ignore-path ../.prettierignore"
}
```

Set `backend/tsconfig.json` to `rootDir: "src"`, `outDir: "dist"`, `include: ["src/**/*.ts"]`, and `exclude: ["src/**/*.test.ts", "src/test/**/*", "dist", "node_modules"]`. Make `backend/tsconfig.test.json` extend it with `rootDir: "."`, `noEmit: true`, and the test paths included.

Configure two Jest projects named `unit` and `integration`; use `**/*.unit.test.ts` and `**/*.integration.test.ts`, the ts-jest transform with `tsconfig.test.json`, and ignore both `dist` and `node_modules`. Set flat ESLint configurations for backend TypeScript and frontend Vue/TypeScript; report legacy unused/explicit-`any` findings as warnings during the coordinated cutover, disable only `vue/multi-word-component-names` and `vue/no-mutating-props`, and keep all other recommended rules. Use shared Prettier rules of `semi: true`, `singleQuote: false`, `trailingComma: "all"`, `printWidth: 100`.

Use this exact `.prettierignore` so tracked design/plan content, migrations, obsolete seed sources, generated output, dependencies, coverage, and local environment values are outside the mechanical pass:

```text
docs/
README.md
docker-compose.yml
**/node_modules/
**/dist/
**/coverage/
**/.env
**/.env.local
**/.env.*.local
backend/prisma/migrations/
backend/prisma/seed.ts
backend/prisma/seed.js
```

Run the mechanical formatting pass explicitly:

From `backend`:

```text
npx --no-install prettier --write "src/**/*.ts" package.json package-lock.json tsconfig.json tsconfig.test.json jest.config.js eslint.config.js ../prettier.config.cjs --config ../prettier.config.cjs --ignore-path ../.prettierignore
```

From `frontend`:

```text
npx --no-install prettier --write "src/**/*.{ts,vue,css}" index.html package.json package-lock.json tsconfig.json tsconfig.app.json tsconfig.node.json vite.config.ts env.d.ts eslint.config.js --config ../prettier.config.cjs --ignore-path ../.prettierignore
```

Inspect `git diff --word-diff=porcelain` and accept only whitespace/quote/semicolon/layout changes outside manifests/configuration.

- [ ] **Step 5: Remove the obsolete test and run focused verification**

Run from `backend`:

```text
npm ci
npm run test:unit -- jestDiscovery.unit.test.ts
npm run type-check
npm run lint
npm run format:check
npm run build
```

Run from `frontend`:

```text
npm ci
npm run type-check
npm run lint
npm run format:check
npm run build
```

Expected: the discovery test passes, each source test executes at most once, `backend/dist` contains no test files, and both packages pass clean-install quality gates.

- [ ] **Step 6: Commit the infrastructure boundary**

Stage exactly:

```text
.editorconfig
.prettierignore
prettier.config.cjs
backend/eslint.config.js
backend/tsconfig.test.json
backend/src/test/config/jestDiscovery.unit.test.ts
backend/src/tests/EmployeeService.test.ts
backend/package.json
backend/package-lock.json
backend/tsconfig.json
backend/jest.config.js
frontend/eslint.config.js
frontend/package.json
frontend/package-lock.json
backend/src/app.ts
backend/src/controllers/EmployeeController.ts
backend/src/dtos/EmployeeDTO.ts
backend/src/middlewares/ErrorMiddleware.ts
backend/src/repositories/EmployeeRepository.ts
backend/src/routes/EmployeeRoute.ts
backend/src/server.ts
backend/src/services/EmployeeService.ts
backend/src/utils/prisma.ts
backend/src/utils/upload.ts
frontend/index.html
frontend/vite.config.ts
frontend/tsconfig.json
frontend/tsconfig.app.json
frontend/tsconfig.node.json
frontend/env.d.ts
frontend/src/App.vue
frontend/src/api/employee.ts
frontend/src/composables/useEmployee.ts
frontend/src/main.ts
frontend/src/router/index.ts
frontend/src/style.css
frontend/src/types/employee.ts
frontend/src/views/EmployeeView.vue
frontend/src/components/EmployeeTable.vue
frontend/src/components/EmployeeForm.vue
frontend/src/components/EmployeeFilter.vue
frontend/src/components/EmployeeEditModal.vue
```

Commit: `chore: add phase 1 quality baseline`

---

### Task 2: Define canonical domain types, Zod schemas, normalization, and configuration parsing

**Deliverable:** One strict runtime source defines Employee inputs/list queries and a pure parser defines application configuration; Prisma types do not enter these modules.

**Files:**
- Create: `backend/src/domain/employee.ts`
- Create: `backend/src/validation/employeeSchemas.ts`
- Create: `backend/src/config/appConfig.ts`
- Create: `backend/src/test/validation/employeeSchemas.unit.test.ts`
- Create: `backend/src/test/config/appConfig.unit.test.ts`
- Remove: `backend/src/dtos/EmployeeDTO.ts`

**Interfaces:**
- Consumes: Zod installed in Task 1 and the shared `Employee`, `EmployeeStatus`, list, and DTO contracts declared above.
- Produces: `createEmployeeSchema`, `updateEmployeeSchema`, `employeeIdParamsSchema`, `employeeListQuerySchema`, `emptyExportQuerySchema`, `isDateOnly`, `dateOnlyToUtcDate`, `parseEnvironment`, `EmployeeListQueryInput`, `EmployeeListQueryDTO`, and their exact inferred types. `EmployeeListQueryDTO` must satisfy the Prisma-independent `EmployeeListOptions` interface structurally.

- [ ] **Step 1: Write exhaustive failing schema and configuration tests**

```ts
const emailAt254 = `${"a".repeat(64)}@${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(61)}`;
const emailAt255 = `${"a".repeat(64)}@${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(62)}`;

test.each([
  ["email", { email: emailAt254 }, true],
  ["email", { email: emailAt255 }, false],
  ["fullName", { fullName: "x".repeat(120) }, true],
  ["fullName", { fullName: "x".repeat(121) }, false],
  ["jobTitle", { jobTitle: "x".repeat(120) }, true],
  ["jobTitle", { jobTitle: "x".repeat(121) }, false],
])("enforces the %s boundary", (_field, override, valid) => {
  const result = createEmployeeSchema.safeParse({ ...validEmployeeInput, ...override });
  expect(result.success).toBe(valid);
});

test.each(["0.00", "003500.00", "3500", "3500.0", "1e3", "10000000000.00"])(
  "rejects noncanonical salary %s",
  (salary) => expect(createEmployeeSchema.safeParse({ ...validEmployeeInput, salary }).success).toBe(false),
);

test("normalizes list defaults without exposing raw sort properties", () => {
  expect(employeeListQuerySchema.parse({})).toEqual({
    page: 1,
    pageSize: 10,
    sortBy: "fullName",
    sortOrder: "asc",
  });
  expect(employeeListQuerySchema.safeParse({ sortBy: "uuid" }).success).toBe(false);
});

test("parses an explicit immutable configuration", () => {
  const config = parseEnvironment({
    DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/employees",
    PORT: "3000",
    CORS_ORIGIN: "http://localhost:5173",
    NODE_ENV: "test",
  });
  expect(config).toEqual({
    databaseUrl: "postgresql://postgres:postgres@127.0.0.1:5432/employees",
    port: 3000,
    corsOrigin: "http://localhost:5173",
    nodeEnv: "test",
  });
  expect(Object.isFrozen(config)).toBe(true);
});
```

Add table cases for below/at/above every optional length; trim/lowercase email; empty optional input to `null`; leap day and invalid calendar dates; UUID path; update empty/unknown/server fields; list page/pageSize/search/status/sort bounds; and strict empty export query.

- [ ] **Step 2: Run the focused tests and confirm the missing-contract failure**

Run from `backend`: `npm run test:unit -- employeeSchemas.unit.test.ts appConfig.unit.test.ts`

Expected: FAIL because the canonical modules and exported schemas do not exist.

- [ ] **Step 3: Implement the canonical domain and schema content**

Use strict Zod objects. Build optional text with preprocessing that maps blank trimmed strings to `null`; do not allow `null` for required create fields. Use this date logic rather than locale parsing:

```ts
export function isDateOnly(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  if (year < 1 || year > 9999) return false;
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function dateOnlyToUtcDate(value: string): Date {
  if (!isDateOnly(value)) throw new Error("Invalid canonical hire date");
  const [year, month, day] = value.split("-").map(Number);
  const result = new Date(0);
  result.setUTCFullYear(year, month - 1, day);
  result.setUTCHours(0, 0, 0, 0);
  return result;
}
```

Make salary a refined string using the exact regular expression and positive/max bounds. Make list query preprocessing accept HTTP strings, reject arrays/unknown keys, and output the defaulted `EmployeeListOptions`. Define `emptyExportQuerySchema = z.object({}).strict()`.

- [ ] **Step 4: Implement the pure environment parser**

Require `DATABASE_URL`, `PORT`, `CORS_ORIGIN`, and `NODE_ENV`. Accept only `postgresql:`/`postgres:` database URLs, integer ports 1–65535, an HTTP(S) CORS origin with no wildcard/path/query/hash, and the three approved environments. Return `Object.freeze(parsedConfig)` and never read `process.env` inside the module.

- [ ] **Step 5: Run focused and type verification**

Run from `backend`:

```text
npm run test:unit -- employeeSchemas.unit.test.ts appConfig.unit.test.ts
npm run type-check
npm run lint
npm run format:check
```

Expected: every exact boundary/normalization/default passes, invalid/unknown input fails with canonical paths, and no file in `domain`, `validation`, or `config` imports Express or Prisma.

- [ ] **Step 6: Commit the canonical contract boundary**

Stage exactly:

```text
backend/src/domain/employee.ts
backend/src/validation/employeeSchemas.ts
backend/src/config/appConfig.ts
backend/src/test/validation/employeeSchemas.unit.test.ts
backend/src/test/config/appConfig.unit.test.ts
backend/src/dtos/EmployeeDTO.ts
```

Commit: `feat: add canonical employee validation`

---

### Task 3: Establish errors, serialization, app construction, health, and single-listener bootstrap

**Deliverable:** Importing `app.ts` is side-effect free; tests construct Express with explicit configuration/dependencies; all failures use the global contract; only `server.ts` parses environment and listens.

**Files:**
- Create: `backend/src/errors/ApplicationError.ts`
- Create: `backend/src/serialization/employeeSerializer.ts`
- Create: `backend/src/http/validatedHandler.ts`
- Create: `backend/src/routes/HealthRoute.ts`
- Create: `backend/src/appDependencies.ts`
- Create: `backend/src/test/http/app.integration.test.ts`
- Modify: `backend/src/middlewares/ErrorMiddleware.ts`
- Modify: `backend/src/app.ts`
- Modify: `backend/src/server.ts`

**Interfaces:**
- Consumes: `Employee`, `EmployeeDTO`, `AppConfig`, `ApplicationError`, and `validatedHandler<T>` signatures above; temporarily injects the existing employee router until Tasks 8–9 replace its wiring.
- Produces: `serializeEmployee(employee: Employee): EmployeeDTO`, `createHealthRouter(readinessCheck: () => Promise<void>): Router`, `createProductionDependencies(config: AppConfig): AppDependencies`, and `createApp(config, dependencies?): Express`.

- [ ] **Step 1: Write failing Supertest and serializer tests**

```ts
test("constructs without reading env or opening a listener", async () => {
  const listen = jest.spyOn(express.application, "listen");
  const app = createApp(testConfig, {
    employeeRouter: Router(),
    readinessCheck: async () => undefined,
  });
  await request(app).get("/health/live").expect(200, { data: { status: "ok" } });
  expect(listen).not.toHaveBeenCalled();
});

test("serializes canonical decimal, date, nullable, and timestamp values", () => {
  expect(serializeEmployee(domainEmployee)).toEqual({
    ...publicEmployee,
    salary: "3500.00",
    hireDate: "2023-01-10",
    createdAt: "2026-08-28T12:00:00.000Z",
    updatedAt: "2026-08-28T12:00:00.000Z",
  });
});

test.each([
  [new ApplicationError("EMPLOYEE_NOT_FOUND", "Employee not found."), 404, "EMPLOYEE_NOT_FOUND"],
  [new ApplicationError("EMAIL_CONFLICT", "Email already exists."), 409, "EMAIL_CONFLICT"],
])("maps known errors", async (error, status, code) => {
  const router = Router().get("/failure", () => { throw error; });
  const app = createApp(testConfig, { employeeRouter: router, readinessCheck: async () => undefined });
  const response = await request(app).get("/employees/failure").expect(status);
  expect(response.body.error.code).toBe(code);
});
```

Also test malformed JSON as 400, unknown route as 404, failed readiness as sanitized non-success, and an unexpected error as 500 without stack/path/Prisma text.

- [ ] **Step 2: Run the focused suite and verify the current double-listener failure**

Run from `backend`: `npm run test:integration -- app.integration.test.ts`

Expected: FAIL because `createApp`, injected dependencies, health routes, canonical envelopes, and serializers do not exist; importing current `app.ts` attempts `listen(3000)`.

- [ ] **Step 3: Implement errors, serializers, and typed validation adapter**

Map codes to statuses only inside `ErrorMiddleware.ts` using this exhaustive table:

```ts
const ERROR_STATUS: Record<ErrorCode, number> = {
  MALFORMED_JSON: 400,
  EMPLOYEE_NOT_FOUND: 404,
  ROUTE_NOT_FOUND: 404,
  EMAIL_CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  VALIDATION_ERROR: 422,
  INVALID_XLSX: 422,
  INTERNAL_ERROR: 500,
};
```

Convert Zod issues to `{ path: issue.path.join("."), code: issue.code, message: issue.message }`. Detect JSON parser `SyntaxError`, Multer size errors, and `ApplicationError`; log unexpected failures server-side and emit only `INTERNAL_ERROR` publicly.

Implement `validatedHandler` with `schema.safeParse(select(request))`; on failure call `next(new ApplicationError("VALIDATION_ERROR", "Request validation failed.", details))`; on success pass the typed parsed value directly to the handler, eliminating controller body/query assertions.

- [ ] **Step 4: Implement app/dependency/health construction and server bootstrap**

```ts
export function createApp(
  config: AppConfig,
  dependencies: AppDependencies = createProductionDependencies(config),
): Express {
  const app = express();
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json());
  app.use(createHealthRouter(dependencies.readinessCheck));
  app.use("/employees", dependencies.employeeRouter);
  app.use((_req, _res, next) => next(new ApplicationError("ROUTE_NOT_FOUND", "Route not found.")));
  app.use(errorMiddleware);
  return app;
}
```

`server.ts` imports `dotenv/config`, executes `parseEnvironment(process.env)` once, calls `createApp(config)`, and calls `listen(config.port)` once inside a guarded `main()`. Configuration/listen failures set `process.exitCode = 1` and log no secret values.

- [ ] **Step 5: Run the focused app boundary checks**

Run from `backend`:

```text
npm run test:integration -- app.integration.test.ts
npm run test:unit -- employeeSchemas.unit.test.ts appConfig.unit.test.ts
npm run type-check
npm run lint
npm run build
```

Expected: Supertest uses explicit `testConfig`, app import never listens or reads unvalidated environment, liveness is database-independent, readiness reflects its injected check, error envelopes/statuses are exact, and `dist/server.js` exists.

- [ ] **Step 6: Commit the bootstrap boundary**

Stage exactly:

```text
backend/src/errors/ApplicationError.ts
backend/src/serialization/employeeSerializer.ts
backend/src/http/validatedHandler.ts
backend/src/routes/HealthRoute.ts
backend/src/appDependencies.ts
backend/src/test/http/app.integration.test.ts
backend/src/middlewares/ErrorMiddleware.ts
backend/src/app.ts
backend/src/server.ts
```

Commit: `refactor: separate app bootstrap and errors`

---

### Task 4: Add guarded disposable-database and migration-test infrastructure

**Deliverable:** Integration/migration tests allocate uniquely named databases inside a uniquely named temporary Compose project, refuse production-capable URLs, and clean only their recorded resources.

**Files:**
- Create: `backend/test/docker-compose.postgres.yml`
- Create: `backend/scripts/run-isolated-tests.mjs`
- Create: `backend/src/test/support/testDatabase.ts`
- Create: `backend/src/test/support/testDatabaseSafety.unit.test.ts`
- Create: `backend/src/test/support/testDatabase.integration.test.ts`
- Modify: `backend/jest.config.js`
- Modify: `backend/package.json`

**Interfaces:**
- Consumes: Prisma CLI/Client, PostgreSQL 15, Jest integration infrastructure, and Node `crypto.randomUUID()`/`child_process.spawn()`.
- Produces:

```ts
export interface TestDatabaseEnvironment {
  readonly adminUrl: string;
  readonly composeProject: string;
  readonly mutationAllowed: true;
}

export interface DisposableDatabase {
  readonly name: string;
  readonly url: string;
  executeSqlFile(path: string): Promise<void>;
  runPrisma(args: readonly string[]): Promise<{ stdout: string; stderr: string }>;
  dispose(): Promise<void>;
}

export function parseTestDatabaseEnvironment(source: NodeJS.ProcessEnv): TestDatabaseEnvironment;
export function allocateDisposableDatabase(label: string): Promise<DisposableDatabase>;
export function quoteIdentifier(identifier: string): string;
```

- [ ] **Step 1: Write failing safety tests before lifecycle code**

```ts
test.each([
  [{ NODE_ENV: "production" }, "NODE_ENV"],
  [{ NODE_ENV: "test", ALLOW_DATABASE_MUTATION: "false" }, "ALLOW_DATABASE_MUTATION"],
  [{ NODE_ENV: "test", ALLOW_DATABASE_MUTATION: "true", TEST_DATABASE_ADMIN_URL: "postgresql://prod/db" }, "loopback"],
  [{ NODE_ENV: "test", ALLOW_DATABASE_MUTATION: "true", TEST_DATABASE_ADMIN_URL: "postgresql://127.0.0.1/employees" }, "/postgres"],
])("refuses unsafe mutation configuration", (source, message) => {
  expect(() => parseTestDatabaseEnvironment(source as NodeJS.ProcessEnv)).toThrow(message);
});

test("quotes only generated test identifiers", () => {
  expect(quoteIdentifier("employee_phase1_test_seed_a1")).toBe('"employee_phase1_test_seed_a1"');
  expect(() => quoteIdentifier("employees")).toThrow("test-only prefix");
  expect(() => quoteIdentifier('x"; DROP DATABASE postgres;--')).toThrow("test-only prefix");
});
```

- [ ] **Step 2: Run the safety test and verify the missing-module failure**

Run from `backend`: `npm run test:unit -- testDatabaseSafety.unit.test.ts`

Expected: FAIL because the guarded parser/allocation module does not exist.

- [ ] **Step 3: Implement exact safety guards and allocation**

Require all of:

```text
NODE_ENV=test
ALLOW_DATABASE_MUTATION=true
TEST_COMPOSE_PROJECT begins employee-phase1-test-
TEST_DATABASE_ADMIN_URL protocol postgresql:/postgres:, host 127.0.0.1 or localhost, database /postgres
generated database name matches ^employee_phase1_test_[a-z0-9_]+$
```

Create/drop databases only through a Prisma client connected to the validated admin URL. Terminate connections only for the exact generated database name before `DROP DATABASE`. `dispose()` is idempotent and refuses all names outside the prefix.

`executeSqlFile(path)` must avoid a host `psql` dependency and avoid interpolating SQL into a shell string: spawn `docker compose -p <validated-project> -f test/docker-compose.postgres.yml exec -T postgres psql -v ON_ERROR_STOP=1 -U postgres -d <validated-database>` as an argument array and pipe `createReadStream(path)` to stdin. `runPrisma(args)` spawns `npx --no-install prisma ...args` with only the child process's `DATABASE_URL` replaced by the disposable URL and returns captured stdout/stderr on success or a rejected error containing the exit code on failure.

- [ ] **Step 4: Implement the isolated Compose runner**

Use `backend/test/docker-compose.postgres.yml` with PostgreSQL 15, `POSTGRES_DB=postgres`, `pg_isready`, a tmpfs data directory, no named volume, no `container_name`, and an ephemeral loopback host port (`127.0.0.1::5432`).

`run-isolated-tests.mjs` must:

1. Generate `employee-phase1-test-<process>-<random>` and validate that exact prefix.
2. Run `docker compose -p <project> -f test/docker-compose.postgres.yml up -d --wait`.
3. Read the assigned port through `docker compose ... port postgres 5432`.
4. Spawn Jest with the three guarded environment values and forward the requested project/path arguments.
5. Record container/network identifiers created under the exact Compose label.
6. In `finally`, run only `docker compose -p <project> -f ... down --volumes --remove-orphans` and verify the recorded resources are absent.
7. Print the project name, resources created, Jest exit code, cleanup command, and final resource state.

Add Jest project `migration` matching `**/migration/**/*.integration.test.ts`. Change scripts to:

```json
{
  "test:integration": "node scripts/run-isolated-tests.mjs integration",
  "test:migration": "node scripts/run-isolated-tests.mjs migration",
  "test": "npm run test:unit && npm run test:integration && npm run test:migration"
}
```

- [ ] **Step 5: Run safe focused verification**

Run from `backend`:

```text
npm run test:unit -- testDatabaseSafety.unit.test.ts
npm run test:integration -- testDatabase.integration.test.ts
```

Expected: unsafe URLs/names are rejected before any mutation; the integration run creates one uniquely named Compose project and one prefixed database, drops only that database, removes only that project's container/network, reports the exact resources, and exits with no allocated resource remaining.

- [ ] **Step 6: Commit the test-safety boundary**

Stage exactly:

```text
backend/test/docker-compose.postgres.yml
backend/scripts/run-isolated-tests.mjs
backend/src/test/support/testDatabase.ts
backend/src/test/support/testDatabaseSafety.unit.test.ts
backend/src/test/support/testDatabase.integration.test.ts
backend/jest.config.js
backend/package.json
```

Commit: `test: add isolated database harness`

---

### Task 5: Apply the atomic legacy migration and canonical Prisma schema

**Deliverable:** A reviewed transaction migrates every compatible legacy row without changing its identifier, assigns deterministic exhaustive emails, and leaves logical application schema/data unchanged on every tested failure.

**Files:**
- Create: `backend/prisma/migrations/20260829000100_employee_phase_1_foundation/migration.sql`
- Create: `backend/src/test/fixtures/legacyEmployees.ts`
- Create: `backend/src/test/migration/employeeFoundationMigration.integration.test.ts`
- Modify: `backend/prisma/schema.prisma`

**Interfaces:**
- Consumes: `allocateDisposableDatabase(label)`, `DisposableDatabase.executeSqlFile`, `DisposableDatabase.runPrisma`, the checked-in initial migration, physical `uuid TEXT`, and the exact canonical model from the specification.
- Produces: Prisma `EmployeeStatus`, mapped canonical `Employee`, migration `20260829000100_employee_phase_1_foundation`, and reusable exact legacy fixtures for the seed tests.

- [ ] **Step 1: Write the failing migration integration suite**

```ts
test("preserves original rows and assigns deterministic canonical/fallback emails", async () => {
  await withLegacyDatabase("canonical", LEGACY_TEN_WITH_REORDERED_DUPLICATES, async (database) => {
    const before = await snapshotLegacyEmployeeState(database.url);
    await database.runPrisma(["migrate", "deploy"]);
    const after = await snapshotCanonicalEmployeeState(database.url);

    expect(after.rows).toHaveLength(before.rows.length);
    expect(after.rows.map((row) => row.id).sort()).toEqual(before.rows.map((row) => row.uuid).sort());
    expect(after.emailBySeedKey).toEqual(CANONICAL_EMAIL_BY_SEED_KEY);
    expect(after.fallbackEmails.every((email) => /^legacy\+[0-9a-f-]+@example\.com$/.test(email))).toBe(true);
  });
});

test.each(INCOMPATIBLE_LEGACY_FIXTURES)("rolls back logical state: $name", async ({ rows }) => {
  await withLegacyDatabase("rollback", rows, async (database) => {
    const before = await snapshotLegacyEmployeeState(database.url);
    await expect(database.runPrisma(["migrate", "deploy"])).rejects.toThrow();
    const after = await snapshotLegacyEmployeeState(database.url);
    expect(after.applicationCatalog).toEqual(before.applicationCatalog);
    expect(after.orderedRows).toEqual(before.orderedRows);
  });
});
```

The fixture matrix must include original ten rows, exact duplicates inserted in different orders, unrelated custom rows, edited/partial matches, nullable and blank optionals, unsupported statuses, zero/negative/oversized/over-scale salaries, non-finite timestamps, dates outside the API range, and a temporary-copy exception immediately before `COMMIT`.

- [ ] **Step 2: Run the migration project and verify the missing-migration failure**

Run from `backend`: `npm run test:migration -- employeeFoundationMigration.integration.test.ts`

Expected: FAIL because the Phase 1 migration/schema and canonical catalog do not exist. The runner must still report its unique project and remove only that project's resources.

- [ ] **Step 3: Update Prisma schema to the exact mapped model**

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

- [ ] **Step 4: Write the explicit migration transaction and exhaustive preflight**

Begin the SQL file with:

```sql
BEGIN;
LOCK TABLE "Employee" IN ACCESS EXCLUSIVE MODE;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Employee" WHERE "uuid" = '' OR "uuid" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') THEN
    RAISE EXCEPTION 'Employee.uuid is not UUID-shaped';
  END IF;
  IF EXISTS (SELECT 1 FROM "Employee" WHERE length(btrim("name")) NOT BETWEEN 1 AND 120) THEN
    RAISE EXCEPTION 'Employee.name length is incompatible';
  END IF;
  IF EXISTS (SELECT 1 FROM "Employee" WHERE length(btrim("role")) NOT BETWEEN 1 AND 120) THEN
    RAISE EXCEPTION 'Employee.role length is incompatible';
  END IF;
  IF EXISTS (SELECT 1 FROM "Employee" WHERE upper(btrim("status")) NOT IN ('ACTIVE', 'ON_LEAVE', 'INACTIVE')) THEN
    RAISE EXCEPTION 'Employee.status is incompatible';
  END IF;
  IF EXISTS (SELECT 1 FROM "Employee" WHERE "salary" <= 0 OR "salary" > 9999999999.99 OR "salary" <> round("salary", 2)) THEN
    RAISE EXCEPTION 'Employee.salary is incompatible';
  END IF;
  IF EXISTS (SELECT 1 FROM "Employee" WHERE NOT isfinite("contract_date") OR "contract_date"::date NOT BETWEEN DATE '0001-01-01' AND DATE '9999-12-31') THEN
    RAISE EXCEPTION 'Employee.contract_date is incompatible';
  END IF;
END $$;
```

Add separate explicit checks for trimmed non-empty optional `phone` >30, `address` >200, `neighborhood` >100, and `zipcode` >20. Perform no DDL or row mutation before all assertions pass.

- [ ] **Step 5: Encode the complete fingerprint relation and deterministic representative selection**

Use a typed `VALUES` relation with these exact rows:

```sql
VALUES
  ('joao-silva', 'João Silva', 'Rua A', 'Centro', '14000-000', '119999999', 3500::decimal, timestamp '2023-01-10 00:00:00.000', 'Developer', 'active', 'joao.silva@example.com'),
  ('maria-souza', 'Maria Souza', 'Rua B', 'Jardim Paulista', '14000-001', '119999998', 4200::decimal, timestamp '2022-03-15 00:00:00.000', 'Designer', 'active', 'maria.souza@example.com'),
  ('carlos-lima', 'Carlos Lima', 'Rua C', 'Centro', '14000-002', '119999997', 5000::decimal, timestamp '2021-07-20 00:00:00.000', 'Manager', 'active', 'carlos.lima@example.com'),
  ('ana-costa', 'Ana Costa', 'Rua D', 'Vila Tibério', '14000-003', '119999996', 3200::decimal, timestamp '2023-05-01 00:00:00.000', 'Developer', 'inactive', 'ana.costa@example.com'),
  ('pedro-santos', 'Pedro Santos', 'Rua E', 'Campos Eliseos', '14000-004', '119999995', 4500::decimal, timestamp '2022-09-10 00:00:00.000', 'QA', 'active', 'pedro.santos@example.com'),
  ('lucas-pereira', 'Lucas Pereira', 'Rua F', 'Centro', '14000-005', '119999994', 3900::decimal, timestamp '2022-11-02 00:00:00.000', 'Developer', 'active', 'lucas.pereira@example.com'),
  ('fernanda-alves', 'Fernanda Alves', 'Rua G', 'Ipiranga', '14000-006', '119999993', 4100::decimal, timestamp '2021-04-12 00:00:00.000', 'Product Owner', 'active', 'fernanda.alves@example.com'),
  ('ricardo-gomes', 'Ricardo Gomes', 'Rua H', 'Centro', '14000-007', '119999992', 3800::decimal, timestamp '2020-06-30 00:00:00.000', 'Support', 'active', 'ricardo.gomes@example.com'),
  ('juliana-rocha', 'Juliana Rocha', 'Rua I', 'Jardim Paulista', '14000-008', '119999991', 4600::decimal, timestamp '2021-08-21 00:00:00.000', 'Developer', 'active', 'juliana.rocha@example.com'),
  ('bruno-martins', 'Bruno Martins', 'Rua J', 'Centro', '14000-009', '119999990', 3700::decimal, timestamp '2022-12-01 00:00:00.000', 'QA', 'inactive', 'bruno.martins@example.com')
```

Match every legacy value with `IS NOT DISTINCT FROM`, rank candidates by `row_number() OVER (PARTITION BY seed_key ORDER BY "uuid" COLLATE "C" ASC)`, assign the rank-1 canonical email, and assign every other row `legacy+<lowercase uuid>@example.com`.

- [ ] **Step 6: Complete conversions, constraints, and commit boundary inside SQL**

Inside the same transaction: create `EmployeeStatus`; add nullable `email`; materialize/assign backfill; trim required text; set blank optionals to `NULL`; drop `address NOT NULL`; convert status with `upper(btrim(status))`; convert salary to `DECIMAL(12,2)`; convert timestamp calendar portions to `date`; preserve `uuid`, `created_at`, and `updated_at`; set email non-null; add `Employee_email_key`, `Employee_email_normalized_check`, `Employee_salary_positive_check`, and `Employee_status_idx`; then `COMMIT`.

- [ ] **Step 7: Verify success, rollback, ledger separation, and test-only retry**

Run from `backend`:

```text
npm run prisma:generate
npx --no-install prisma validate
npm run test:migration -- employeeFoundationMigration.integration.test.ts
```

Expected: valid fixtures preserve all row IDs/values under canonical conversion; insertion order does not change representatives; every incompatible fixture and injected pre-commit exception restores logically identical catalog/ordered rows; `_prisma_migrations` bookkeeping is asserted separately; retry uses guarded `prisma migrate resolve --rolled-back 20260829000100_employee_phase_1_foundation` only in its disposable database.

- [ ] **Step 8: Commit the migration boundary**

Stage exactly:

```text
backend/prisma/schema.prisma
backend/prisma/migrations/20260829000100_employee_phase_1_foundation/migration.sql
backend/src/test/fixtures/legacyEmployees.ts
backend/src/test/migration/employeeFoundationMigration.integration.test.ts
```

Commit: `feat: migrate employee foundation schema`

---

### Task 6: Add the compiled idempotent canonical seed

**Deliverable:** The ten approved employees compile to `dist/database/seed.js`, insert only missing canonical emails, preserve edits/custom rows, and stop startup on failure.

**Files:**
- Create: `backend/src/database/seed.ts`
- Create: `backend/src/test/database/seed.integration.test.ts`
- Modify: `backend/package.json`
- Remove: `backend/prisma/seed.ts`
- Remove: `backend/prisma/seed.js`

**Interfaces:**
- Consumes: canonical Prisma schema, `dateOnlyToUtcDate`, Prisma `Decimal`, and isolated test databases.
- Produces: `CANONICAL_EMPLOYEES`, `seedEmployees(client: PrismaClient): Promise<number>`, and compiled artifact `dist/database/seed.js`.

- [ ] **Step 1: Write the failing seed integration test**

```ts
test("compiled seed is idempotent and non-destructive", async () => {
  await withMigratedDatabase("seed", async ({ url, prisma }) => {
    await runCompiledSeed(url);
    expect(await prisma.employee.count()).toBe(10);

    await prisma.employee.update({
      where: { email: "joao.silva@example.com" },
      data: { jobTitle: "Principal Developer" },
    });
    await runCompiledSeed(url);

    expect(await prisma.employee.count()).toBe(10);
    expect((await prisma.employee.findUniqueOrThrow({ where: { email: "joao.silva@example.com" } })).jobTitle)
      .toBe("Principal Developer");
  });
});
```

Also delete one canonical record between runs and assert the second run inserts exactly that missing email without changing the other nine.

- [ ] **Step 2: Run the focused test and artifact assertion in the red state**

Run from `backend`:

```text
npm run build
node -e "require('fs').accessSync('dist/database/seed.js')"
npm run test:integration -- seed.integration.test.ts
```

Expected: FAIL because `dist/database/seed.js` and the new seed exports do not exist.

- [ ] **Step 3: Define the exact ten-record source dataset**

```ts
export const CANONICAL_EMPLOYEES = [
  { email: "joao.silva@example.com", fullName: "João Silva", jobTitle: "Developer", status: "ACTIVE", salary: "3500.00", hireDate: "2023-01-10", phone: "119999999", address: "Rua A", neighborhood: "Centro", postalCode: "14000-000" },
  { email: "maria.souza@example.com", fullName: "Maria Souza", jobTitle: "Designer", status: "ACTIVE", salary: "4200.00", hireDate: "2022-03-15", phone: "119999998", address: "Rua B", neighborhood: "Jardim Paulista", postalCode: "14000-001" },
  { email: "carlos.lima@example.com", fullName: "Carlos Lima", jobTitle: "Manager", status: "ACTIVE", salary: "5000.00", hireDate: "2021-07-20", phone: "119999997", address: "Rua C", neighborhood: "Centro", postalCode: "14000-002" },
  { email: "ana.costa@example.com", fullName: "Ana Costa", jobTitle: "Developer", status: "INACTIVE", salary: "3200.00", hireDate: "2023-05-01", phone: "119999996", address: "Rua D", neighborhood: "Vila Tibério", postalCode: "14000-003" },
  { email: "pedro.santos@example.com", fullName: "Pedro Santos", jobTitle: "QA", status: "ACTIVE", salary: "4500.00", hireDate: "2022-09-10", phone: "119999995", address: "Rua E", neighborhood: "Campos Eliseos", postalCode: "14000-004" },
  { email: "lucas.pereira@example.com", fullName: "Lucas Pereira", jobTitle: "Developer", status: "ACTIVE", salary: "3900.00", hireDate: "2022-11-02", phone: "119999994", address: "Rua F", neighborhood: "Centro", postalCode: "14000-005" },
  { email: "fernanda.alves@example.com", fullName: "Fernanda Alves", jobTitle: "Product Owner", status: "ACTIVE", salary: "4100.00", hireDate: "2021-04-12", phone: "119999993", address: "Rua G", neighborhood: "Ipiranga", postalCode: "14000-006" },
  { email: "ricardo.gomes@example.com", fullName: "Ricardo Gomes", jobTitle: "Support", status: "ACTIVE", salary: "3800.00", hireDate: "2020-06-30", phone: "119999992", address: "Rua H", neighborhood: "Centro", postalCode: "14000-007" },
  { email: "juliana.rocha@example.com", fullName: "Juliana Rocha", jobTitle: "Developer", status: "ACTIVE", salary: "4600.00", hireDate: "2021-08-21", phone: "119999991", address: "Rua I", neighborhood: "Jardim Paulista", postalCode: "14000-008" },
  { email: "bruno.martins@example.com", fullName: "Bruno Martins", jobTitle: "QA", status: "INACTIVE", salary: "3700.00", hireDate: "2022-12-01", phone: "119999990", address: "Rua J", neighborhood: "Centro", postalCode: "14000-009" },
] as const;
```

- [ ] **Step 4: Implement idempotent execution and failure propagation**

Map salary to `new Prisma.Decimal(value)` and hire date through `dateOnlyToUtcDate`. Call `createMany({ data, skipDuplicates: true })` and return `result.count`; do not update/delete. The executable `main()` logs only the inserted count, sets `process.exitCode = 1` on error, and always disconnects. Set `package.json` Prisma seed command to `node dist/database/seed.js`.

- [ ] **Step 5: Run focused seed/build verification**

Run from `backend`:

```text
npm run prisma:generate
npm run build
node -e "require('fs').accessSync('dist/database/seed.js')"
npm run test:integration -- seed.integration.test.ts
```

Expected: exact compiled path exists; first run inserts missing canonical emails; second run inserts zero; edited records/custom rows remain; a seed failure returns non-zero.

- [ ] **Step 6: Commit the seed boundary**

Stage exactly:

```text
backend/src/database/seed.ts
backend/src/test/database/seed.integration.test.ts
backend/package.json
backend/prisma/seed.ts
backend/prisma/seed.js
```

Commit: `feat: add idempotent employee seed`

---

### Task 7: Implement Prisma-independent repository and service boundaries

**Deliverable:** Prisma mapping/conversion stays inside `PrismaEmployeeRepository`; `EmployeeService` accepts an injected domain repository and implements use cases without Express or Prisma imports.

**Files:**
- Create: `backend/src/database/prisma.ts`
- Create: `backend/src/test/repositories/EmployeeRepository.integration.test.ts`
- Create: `backend/src/test/services/EmployeeService.unit.test.ts`
- Modify: `backend/src/repositories/EmployeeRepository.ts`
- Modify: `backend/src/services/EmployeeService.ts`
- Remove: `backend/src/utils/prisma.ts`

**Interfaces:**
- Consumes: `EmployeeRepository`, `EmployeeListOptions`, canonical input DTOs, `dateOnlyToUtcDate`, and `ApplicationError`.
- Produces:

```ts
export function createPrismaClient(databaseUrl: string): PrismaClient;

export class PrismaEmployeeRepository implements EmployeeRepository {
  constructor(private readonly prisma: PrismaClient);
  create(input: CreateEmployeeDTO): Promise<Employee>;
  findById(id: string): Promise<Employee | null>;
  findPage(options: EmployeeListOptions): Promise<EmployeeListResult>;
  findAllForExport(): Promise<Employee[]>;
  update(id: string, input: UpdateEmployeeDTO): Promise<Employee>;
  delete(id: string): Promise<void>;
}

export class EmployeeService {
  constructor(private readonly repository: EmployeeRepository);
  create(input: CreateEmployeeDTO): Promise<Employee>;
  findById(id: string): Promise<Employee>;
  findAll(options: EmployeeListOptions): Promise<{ data: Employee[]; meta: EmployeeListMeta }>;
  update(id: string, input: UpdateEmployeeDTO): Promise<Employee>;
  delete(id: string): Promise<void>;
  findAllForExport(): Promise<Employee[]>;
}
```

- [ ] **Step 1: Write failing service-unit and repository-integration tests**

```ts
test("service forwards canonical list options and computes metadata", async () => {
  const repository = mockEmployeeRepository({
    findPage: jest.fn().mockResolvedValue({ items: [employee], totalItems: 21 }),
  });
  const service = new EmployeeService(repository);
  await expect(service.findAll({ page: 2, pageSize: 10, sortBy: "fullName", sortOrder: "asc" }))
    .resolves.toEqual({
      data: [employee],
      meta: { page: 2, pageSize: 10, totalItems: 21, totalPages: 3, sortBy: "fullName", sortOrder: "asc" },
    });
  expect(repository.findPage).toHaveBeenCalledWith({ page: 2, pageSize: 10, sortBy: "fullName", sortOrder: "asc" });
});

test("repository applies whitelist mapping and stable id tiebreaker", async () => {
  await repository.findPage({ page: 3, pageSize: 5, search: "dev", status: "ACTIVE", sortBy: "salary", sortOrder: "desc" });
  expect(prisma.employee.findMany).toHaveBeenCalledWith(expect.objectContaining({
    skip: 10,
    take: 5,
    orderBy: [{ salary: "desc" }, { id: "asc" }],
  }));
});
```

Also cover case-insensitive OR search over full name/email/job title, status equality, every six-field sort mapping, default and descending tie behavior, date/salary persistence conversion, nullable values, P2002 conflict, P2025 not-found race, and argument-free export ordering.

- [ ] **Step 2: Run focused tests in the red state**

Run from `backend`:

```text
npm run test:unit -- EmployeeService.unit.test.ts
npm run test:integration -- EmployeeRepository.integration.test.ts
```

Expected: FAIL because constructors/interfaces/mappings are still legacy and the service currently builds Prisma-style query objects.

- [ ] **Step 3: Implement config-aware Prisma creation and persistence mapping**

Construct Prisma with `{ datasources: { db: { url: databaseUrl } } }` and no eager `$connect`. In the repository, map canonical writes as:

```ts
const toCreateData = (input: CreateEmployeeDTO): Prisma.EmployeeCreateInput => ({
  email: input.email,
  fullName: input.fullName,
  jobTitle: input.jobTitle,
  status: input.status,
  salary: new Prisma.Decimal(input.salary),
  hireDate: dateOnlyToUtcDate(input.hireDate),
  phone: input.phone ?? null,
  address: input.address ?? null,
  neighborhood: input.neighborhood ?? null,
  postalCode: input.postalCode ?? null,
});
```

Map Prisma rows to `Employee` with `salary.toFixed(2)`, date-only UTC components, nullable fields, and `Date` timestamps. Translate only known persistence errors to `ApplicationError`; never expose Prisma errors or accept raw property names.

Build update data from keys that are actually present so a partial update never nulls or overwrites an omitted field:

```ts
const toUpdateData = (input: UpdateEmployeeDTO): Prisma.EmployeeUpdateInput => {
  const data: Prisma.EmployeeUpdateInput = {};
  if (input.email !== undefined) data.email = input.email;
  if (input.fullName !== undefined) data.fullName = input.fullName;
  if (input.jobTitle !== undefined) data.jobTitle = input.jobTitle;
  if (input.status !== undefined) data.status = input.status;
  if (input.salary !== undefined) data.salary = new Prisma.Decimal(input.salary);
  if (input.hireDate !== undefined) data.hireDate = dateOnlyToUtcDate(input.hireDate);
  if (input.phone !== undefined) data.phone = input.phone;
  if (input.address !== undefined) data.address = input.address;
  if (input.neighborhood !== undefined) data.neighborhood = input.neighborhood;
  if (input.postalCode !== undefined) data.postalCode = input.postalCode;
  return data;
};
```

- [ ] **Step 4: Implement explicit query mapping and use cases**

Build `where` only from canonical `search`/`status`; map sort through an exhaustive switch returning one approved Prisma key; append `{ id: "asc" }`; calculate `skip = (page - 1) * pageSize`; run find/count together. `findAllForExport()` takes no argument and orders `{ fullName: "asc" }, { id: "asc" }` without `skip`/`take`.

Service not-found behavior throws `ApplicationError("EMPLOYEE_NOT_FOUND", "Employee not found.")`; list metadata uses `totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize)`; create/update rely on repository uniqueness translation; service imports no Prisma or Express module.

- [ ] **Step 5: Run focused boundary verification**

Run from `backend`:

```text
npm run test:unit -- EmployeeService.unit.test.ts
npm run test:integration -- EmployeeRepository.integration.test.ts
rg -n "@prisma/client|Prisma\." src/services src/domain src/controllers
```

Expected: unit/integration tests pass; the search returns no Prisma import/use in service/domain/controller paths; all allowed sorts are mapped internally and raw client keys never reach Prisma.

- [ ] **Step 6: Commit the repository/service boundary**

Stage exactly:

```text
backend/src/database/prisma.ts
backend/src/repositories/EmployeeRepository.ts
backend/src/services/EmployeeService.ts
backend/src/test/repositories/EmployeeRepository.integration.test.ts
backend/src/test/services/EmployeeService.unit.test.ts
backend/src/utils/prisma.ts
```

Commit: `feat: add canonical employee service boundary`

---

### Task 8: Cut CRUD, list, controller, routing, and API error contracts over together

**Deliverable:** All Employee JSON endpoints use canonical schemas, envelopes, status codes, `PATCH`, pagination/search/filter/sort/stable order, and injected controller/service/repository construction.

**Files:**
- Create: `backend/src/test/http/employees.integration.test.ts`
- Modify: `backend/src/controllers/EmployeeController.ts`
- Modify: `backend/src/routes/EmployeeRoute.ts`
- Modify: `backend/src/appDependencies.ts`

**Interfaces:**
- Consumes: `validatedHandler`, all canonical schemas/DTOs, `EmployeeService`, `PrismaEmployeeRepository`, `serializeEmployee`, and `createPrismaClient`.
- Produces:

```ts
export interface EmployeeController {
  create: ValidatedAction<CreateEmployeeDTO>;
  findAll: ValidatedAction<EmployeeListQueryDTO>;
  findById: ValidatedAction<EmployeeIdParams>;
  update: ValidatedAction<{ params: EmployeeIdParams; body: UpdateEmployeeDTO }>;
  delete: ValidatedAction<EmployeeIdParams>;
}

export function createEmployeeController(service: EmployeeService): EmployeeController;
export function createEmployeeRouter(controller: EmployeeController): Router;
```

The JSON route matrix is fixed:

| Method and path | Validated input | Success | Contract failures |
|---|---|---|---|
| `POST /employees` | Strict `CreateEmployeeDTO` | 201 `{ data: EmployeeDTO }` | 400 malformed JSON; 409 normalized email conflict; 422 invalid/unknown field |
| `GET /employees` | Strict normalized `EmployeeListQueryDTO` | 200 `{ data: EmployeeDTO[], meta: EmployeeListMeta }` | 422 unknown/out-of-range query; an out-of-range page is 200 with empty `data` and accurate metadata |
| `GET /employees/:id` | UUID-shaped `id` | 200 `{ data: EmployeeDTO }` | 404 valid absent ID; 422 invalid ID |
| `PATCH /employees/:id` | UUID-shaped `id` plus strict non-empty `UpdateEmployeeDTO` | 200 `{ data: EmployeeDTO }` | 404 valid absent ID; 409 normalized email conflict; 422 invalid ID/body/unknown or server field |
| `DELETE /employees/:id` | UUID-shaped `id` | 204 with no body | 404 valid absent ID; 422 invalid ID |
| `PUT /employees/:id` | None; route is removed | None | 404 `ROUTE_NOT_FOUND` |

- [ ] **Step 1: Write the failing complete HTTP contract suite**

```ts
test("creates and serializes a canonical employee", async () => {
  const response = await request(app).post("/employees").send(validCreateInput).expect(201);
  expect(response.body).toEqual({ data: expect.objectContaining({
    email: "joao.silva@example.com",
    salary: "3500.00",
    hireDate: "2023-01-10",
    phone: null,
  }) });
  expect(response.body.data).not.toHaveProperty("uuid");
});

test("returns stable list metadata and ordering", async () => {
  const response = await request(app)
    .get("/employees?page=1&pageSize=2&search=dev&status=ACTIVE&sortBy=salary&sortOrder=desc")
    .expect(200);
  expect(response.body.meta).toEqual({
    page: 1, pageSize: 2, totalItems: expect.any(Number), totalPages: expect.any(Number),
    sortBy: "salary", sortOrder: "desc",
  });
});
```

Cover all endpoints and statuses: malformed JSON 400; not-found 404; email conflict 409; invalid UUID, unknown/server field, empty patch, invalid query, and unknown query 422; out-of-range/zero-result list; case-insensitive search; exact status; all sort keys/directions; duplicate primary values with `id ASC`; update race; delete 204; absence of legacy `PUT`.

- [ ] **Step 2: Run the API suite and verify the legacy-contract failure**

Run from `backend`: `npm run test:integration -- employees.integration.test.ts`

Expected: FAIL because routes still use `uuid`, unchecked request casts, raw response bodies, legacy `PUT`, and legacy query names.

- [ ] **Step 3: Implement typed controller actions and canonical routes**

Use `validatedHandler` selectors that build one typed input per route:

```ts
router.post("/", validatedHandler(createEmployeeSchema, (req) => req.body, controller.create));
router.get("/", validatedHandler(employeeListQuerySchema, (req) => req.query, controller.findAll));
router.get("/:id", validatedHandler(employeeIdParamsSchema, (req) => req.params, controller.findById));
router.patch("/:id", validatedHandler(
  z.object({ params: employeeIdParamsSchema, body: updateEmployeeSchema }).strict(),
  (req) => ({ params: req.params, body: req.body }),
  controller.update,
));
router.delete("/:id", validatedHandler(employeeIdParamsSchema, (req) => req.params, controller.delete));
```

Controllers invoke one service method, serialize every Employee, wrap singles as `{ data }`, pass service list `{ data, meta }`, and return no body for 204. They contain no Prisma, workbook parsing, or business branches.

- [ ] **Step 4: Wire production dependencies from validated configuration**

`createProductionDependencies(config)` creates one config-aware Prisma client, repository, service, controller, and router; readiness executes `SELECT 1`. The factory returns the router/readiness function without connecting/listening at module import.

- [ ] **Step 5: Run full backend contract verification after the coordinated API cutover**

Run from `backend`:

```text
npm run test:unit
npm run test:integration -- app.integration.test.ts employees.integration.test.ts EmployeeRepository.integration.test.ts
npm run type-check
npm run lint
npm run format:check
npm run build
```

Expected: canonical CRUD/list tests pass, `PUT` is 404, every error is sanitized/distinct, no controller assertion casts client input, exactly one listener remains, and TypeScript compilation is coherent after the schema/API cutover.

- [ ] **Step 6: Commit the CRUD/API boundary**

Stage exactly:

```text
backend/src/test/http/employees.integration.test.ts
backend/src/controllers/EmployeeController.ts
backend/src/routes/EmployeeRoute.ts
backend/src/appDependencies.ts
```

Commit: `feat: expose canonical employee CRUD API`

---

### Task 9: Mechanically align temporary XLSX import and export

**Deliverable:** Existing XLSX endpoints use canonical headers and use cases, retain deterministic partial success, reject file/query structure precisely, and round-trip all employee business fields without pagination.

**Files:**
- Create: `backend/src/xlsx/employeeWorkbook.ts`
- Create: `backend/src/test/xlsx/employeeWorkbook.integration.test.ts`
- Modify: `backend/src/controllers/EmployeeController.ts`
- Modify: `backend/src/routes/EmployeeRoute.ts`
- Modify: `backend/src/appDependencies.ts`
- Modify: `backend/src/utils/upload.ts`
- Modify: `backend/src/middlewares/ErrorMiddleware.ts`

**Interfaces:**
- Consumes: `EmployeeService.create`, `EmployeeService.findAllForExport`, canonical create/export-query schemas, `ApplicationError`, `UploadedWorkbook`, `ImportSummary`, and memory-backed Multer.
- Produces: `EmployeeWorkbook.importFile(file)`, `EmployeeWorkbook.exportAll()`, plus `POST /employees/import` and strict-queryless `GET /employees/export` handlers.

- [ ] **Step 1: Write the failing workbook and endpoint suite**

```ts
test("imports valid rows through the canonical create use case", async () => {
  const create = jest.spyOn(employeeService, "create").mockResolvedValue(employee);
  const summary = await workbook.importFile(validWorkbookFile([
    { email: "joao.silva@example.com", fullName: "João Silva", jobTitle: "Developer", status: "ACTIVE", salary: "3500.00", hireDate: "2023-01-10" },
  ]));
  expect(summary).toEqual({ total: 1, inserted: 1, rejected: 0 });
  expect(create).toHaveBeenCalledWith(expect.objectContaining({ salary: "3500.00", hireDate: "2023-01-10" }));
});

test.each(["page=1", "status=ACTIVE", "sortBy=salary", "unknown=x"])(
  "rejects every export query: %s",
  async (query) => {
    const response = await request(app).get(`/employees/export?${query}`).expect(422);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  },
);
```

Cover missing `file` detail path, extension/MIME 415, Multer 5 MiB 413, corrupt/missing-sheet/header-only/no-header/missing-required/duplicate/unknown header behavior, optional omitted/blank values, numeric salary normalization, invalid numeric scale/range, rejection of numeric Excel dates and ambiguous text dates, existing/same-file duplicate email, all-rejected HTTP 200, exact export column order, deterministic row order, all-row export, and import/export round trip in an empty isolated database.

- [ ] **Step 2: Run the focused XLSX suite and confirm legacy-header/use-case failure**

Run from `backend`: `npm run test:integration -- employeeWorkbook.integration.test.ts`

Expected: FAIL because current import uses legacy headers/direct repository calls and current export accepts filters and emits metadata/legacy columns.

- [ ] **Step 3: Parse and validate workbook structure deterministically**

Read only the first worksheet with a raw array representation. Required headers are `email`, `fullName`, `jobTitle`, `status`, `salary`, and `hireDate`; optional headers are `phone`, `address`, `neighborhood`, and `postalCode`; reject every unknown/duplicate header and every missing required header. A header-only sheet returns zero counts; a sheet without a header row throws `INVALID_XLSX`.

Validate transport separately: case-insensitive `.xlsx`, exact approved MIME, and 5 MiB Multer limit. Missing form part is `VALIDATION_ERROR` with one detail `{ path: "file", code: "required", message: "File is required." }`; structural parse failures are `INVALID_XLSX`.

- [ ] **Step 4: Normalize each row and retain bounded partial success**

For numeric salary cells, require a finite positive number, calculate integer cents with a tolerance check, reject more than two fractional digits or cents above `999999999999`, and emit `${whole}.${fraction.padStart(2, "0")}`. String salary uses the canonical schema unchanged. Accept hire date only as literal text passing `isDateOnly`; reject number/date cells.

Parse the normalized object again with `createEmployeeSchema` and call `EmployeeService.create`. Count Zod validation and `EMAIL_CONFLICT` as rejected rows, process rows in worksheet order, and rethrow unexpected infrastructure errors rather than hiding them. Return only `{ total, inserted, rejected }`.

- [ ] **Step 5: Emit exact import-compatible export columns**

Call `findAllForExport()` with no arguments. Use worksheet `Employees`, filename `employees.xlsx`, and this exact ordered row shape:

```ts
const exportRow = (employee: Employee) => ({
  email: employee.email,
  fullName: employee.fullName,
  jobTitle: employee.jobTitle,
  status: employee.status,
  salary: employee.salary,
  hireDate: employee.hireDate,
  phone: employee.phone ?? "",
  address: employee.address ?? "",
  neighborhood: employee.neighborhood ?? "",
  postalCode: employee.postalCode ?? "",
});
```

Register export through `emptyExportQuerySchema`; do not pass list query/filter/pagination input to the service.

- [ ] **Step 6: Run focused XLSX/API verification**

Run from `backend`:

```text
npm run test:integration -- employeeWorkbook.integration.test.ts employees.integration.test.ts
npm run test:unit -- employeeSchemas.unit.test.ts EmployeeService.unit.test.ts
npm run type-check
npm run lint
npm run build
```

Expected: canonical import/export tests pass, partial counts are English/deterministic, queryless export contains every row in stable order, every export query is 422, and exported workbooks re-import in an empty database.

- [ ] **Step 7: Commit the temporary XLSX boundary**

Stage exactly:

```text
backend/src/xlsx/employeeWorkbook.ts
backend/src/test/xlsx/employeeWorkbook.integration.test.ts
backend/src/controllers/EmployeeController.ts
backend/src/routes/EmployeeRoute.ts
backend/src/appDependencies.ts
backend/src/utils/upload.ts
backend/src/middlewares/ErrorMiddleware.ts
```

Commit: `feat: align XLSX with employee contract`

---

### Task 10: Mechanically cut the Vue client over to the canonical contract

**Deliverable:** Existing CRUD/filter/pagination/XLSX controls compile and operate with canonical names/envelopes, `PATCH`, required email, English copy, stable USD formatting, and literal hire dates without redesign.

**Files:**
- Create: `frontend/src/utils/employeeFormat.ts`
- Create: `frontend/src/types/employee.contract-check.ts`
- Modify: `frontend/env.d.ts`
- Modify: `frontend/src/types/employee.ts`
- Modify: `frontend/src/api/employee.ts`
- Modify: `frontend/src/composables/useEmployee.ts`
- Modify: `frontend/src/views/EmployeeView.vue`
- Modify: `frontend/src/components/EmployeeTable.vue`
- Modify: `frontend/src/components/EmployeeForm.vue`
- Modify: `frontend/src/components/EmployeeFilter.vue`
- Modify: `frontend/src/components/EmployeeEditModal.vue`

**Interfaces:**
- Consumes: canonical API JSON/envelopes, strict Employee list options, queryless export, and `VITE_API_BASE_URL` as a build-time value.
- Produces:

```ts
export type EmployeeStatus = "ACTIVE" | "ON_LEAVE" | "INACTIVE";
export interface Employee { id: string; email: string; fullName: string; jobTitle: string; status: EmployeeStatus; salary: string; hireDate: string; phone: string | null; address: string | null; neighborhood: string | null; postalCode: string | null; createdAt: string; updatedAt: string; }
export interface CreateEmployeeInput { email: string; fullName: string; jobTitle: string; status: EmployeeStatus; salary: string; hireDate: string; phone?: string | null; address?: string | null; neighborhood?: string | null; postalCode?: string | null; }
export type UpdateEmployeeInput = Partial<CreateEmployeeInput>;
export interface EmployeeListQuery { page: number; pageSize: number; search?: string; status?: EmployeeStatus; sortBy: "fullName" | "email" | "jobTitle" | "status" | "salary" | "hireDate"; sortOrder: "asc" | "desc"; }
export interface EmployeeListMeta { page: number; pageSize: number; totalItems: number; totalPages: number; sortBy: EmployeeListQuery["sortBy"]; sortOrder: EmployeeListQuery["sortOrder"]; }
export interface EmployeeListResponse { data: Employee[]; meta: EmployeeListMeta; }
export interface ImportSummary { total: number; inserted: number; rejected: number; }
export function formatSalaryUsd(value: string): string;
export function displayHireDate(value: string): string;
```

- [ ] **Step 1: Add a compile-time contract fixture before changing legacy types**

```ts
// frontend/src/types/employee.contract-check.ts
import type { CreateEmployeeInput, Employee, EmployeeListResponse, ImportSummary } from "./employee";

const employee: Employee = {
  id: "85c3a05e-bb06-4b2f-b6de-0d81da73120c",
  email: "joao.silva@example.com",
  fullName: "João Silva",
  jobTitle: "Developer",
  status: "ACTIVE",
  salary: "3500.00",
  hireDate: "2023-01-10",
  phone: null, address: null, neighborhood: null, postalCode: null,
  createdAt: "2026-08-28T12:00:00.000Z",
  updatedAt: "2026-08-28T12:00:00.000Z",
};
const createInput: CreateEmployeeInput = { email: employee.email, fullName: employee.fullName, jobTitle: employee.jobTitle, status: employee.status, salary: employee.salary, hireDate: employee.hireDate };
const list: EmployeeListResponse = { data: [employee], meta: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1, sortBy: "fullName", sortOrder: "asc" } };
const summary: ImportSummary = { total: 1, inserted: 1, rejected: 0 };
void [createInput, list, summary];
```

- [ ] **Step 2: Run type-check and observe the intended legacy-type failure**

Run from `frontend`: `npm run type-check`

Expected: FAIL because current interfaces expose `uuid`, `name`, numeric salary, `contract_date`, and Portuguese import keys.

- [ ] **Step 3: Replace types and implement a strictly typed API client**

Declare `ImportMetaEnv { readonly VITE_API_BASE_URL: string }` in `env.d.ts`. Normalize one trailing-slash-free build-time value and fail clearly when absent:

```ts
const publicApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/+$/, "");
if (!publicApiBaseUrl) throw new Error("VITE_API_BASE_URL is required at build time");
const api = axios.create({ baseURL: `${publicApiBaseUrl}/employees` });
```

Export typed functions returning canonical payloads: `getEmployees(query): Promise<EmployeeListResponse>`, `createEmployee(input): Promise<Employee>`, `updateEmployee(id, input): Promise<Employee>` using `patch`, `deleteEmployee(id): Promise<void>`, `importEmployees(file): Promise<ImportSummary>`, and argument-free `exportEmployees(): Promise<Blob>`. Remove debug logging and all `any`.

```ts
export function getEmployees(query: EmployeeListQuery): Promise<EmployeeListResponse>;
export function createEmployee(input: CreateEmployeeInput): Promise<Employee>;
export function updateEmployee(id: string, input: UpdateEmployeeInput): Promise<Employee>;
export function deleteEmployee(id: string): Promise<void>;
export function importEmployees(file: File): Promise<ImportSummary>;
export function exportEmployees(): Promise<Blob>;
```

- [ ] **Step 4: Implement exact presentation-only helpers**

```ts
const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const formatSalaryUsd = (value: string): string => usd.format(Number(value));
export const displayHireDate = (value: string): string => value;
```

Never call `new Date(hireDate)` or locale date formatting. Keep salary/hire-date state and API input unchanged.

- [ ] **Step 5: Mechanically update composable and components**

Use `id`, `email`, `fullName`, `jobTitle`, uppercase status, salary string, `hireDate`, nullable optionals, and `postalCode` everywhere. The create form contains all six required fields plus four optionals. The edit modal emits `UpdateEmployeeInput` through `PATCH`, includes email, and uses English `Cancel`/`Save`. The table displays Email, Full Name, Job Title, Status, Salary, Hire Date, Phone, Address, Neighborhood, Postal Code, Actions; salary/date call the exact helpers.

Filters submit `search`, status select, `sortBy`, and `sortOrder`; the composable owns `page`, `pageSize`, and full metadata. The view displays `inserted`/`rejected`, keeps queryless export, resets page to 1 when filters change, and handles zero `totalPages` without enabling invalid navigation.

- [ ] **Step 6: Run compile/build and the existing-interface smoke path**

Run from `frontend`:

```text
npm run type-check
npm run lint
npm run format:check
$env:VITE_API_BASE_URL = "http://127.0.0.1:3000"
npm run build
Remove-Item Env:VITE_API_BASE_URL
```

On a POSIX shell, the equivalent final command is `VITE_API_BASE_URL=http://127.0.0.1:3000 npm run build`.

Then run the existing UI against the isolated API and verify: create/edit/delete/list/filter/pagination; import counts; downloaded export; `$3,500.00`; literal `2023-01-10`; English labels; browser network bodies contain canonical unformatted strings; edit uses `PATCH`; no hard-coded `localhost:3000` remains in `frontend/src`.

Expected: compile/build passes and the smoke path preserves the existing layout/workflow while using only canonical contracts.

- [ ] **Step 7: Commit the frontend cutover**

Stage exactly:

```text
frontend/src/utils/employeeFormat.ts
frontend/src/types/employee.contract-check.ts
frontend/env.d.ts
frontend/src/types/employee.ts
frontend/src/api/employee.ts
frontend/src/composables/useEmployee.ts
frontend/src/views/EmployeeView.vue
frontend/src/components/EmployeeTable.vue
frontend/src/components/EmployeeForm.vue
frontend/src/components/EmployeeFilter.vue
frontend/src/components/EmployeeEditModal.vue
```

Commit: `feat: align frontend employee contract`

---

### Task 11: Build compiled images, health-gated Compose, and two-project isolation

**Deliverable:** Clean multi-stage backend/frontend images run compiled output, Compose has project-scoped resources and correct build-time URLs/CORS, and a safe verifier proves two disjoint projects while preserving the committed restart-policy baseline.

**Files:**
- Create: `backend/.dockerignore`
- Create: `frontend/.dockerignore`
- Create: `backend/.env.example`
- Create: `frontend/.env.example`
- Create: `scripts/verify-compose-isolation.mjs`
- Create: `backend/src/test/config/dockerContract.unit.test.ts`
- Modify: `backend/dockerfile`
- Modify: `frontend/dockerfile`
- Modify: `backend/package.json`
- Modify: `backend/package-lock.json`
- Modify: `frontend/package.json`
- Modify: `docker-compose.yml`

**Interfaces:**
- Consumes: `dist/database/seed.js`, `dist/server.js`, `/health/live`, `/health/ready`, required `VITE_API_BASE_URL`, backend `AppConfig`, and the existing Compose file whose database service already lacks `restart: always`.
- Produces: compiled non-root images, fail-fast startup, project-scoped `postgres_data`, host-port variables, health gates, and this JSON resource/evidence report from `verify-compose-isolation.mjs`:

```ts
export interface ComposeResourceSnapshot {
  readonly containers: readonly string[];
  readonly networks: readonly string[];
  readonly volumes: readonly string[];
  readonly images: readonly string[];
}

export interface ComposeProjectEvidence {
  readonly project: string;
  readonly apiPort: number;
  readonly frontendPort: number;
  readonly apiOrigin: string;
  readonly frontendOrigin: string;
  readonly created: ComposeResourceSnapshot;
  readonly final: ComposeResourceSnapshot;
}

export interface ComposeVerificationReport {
  readonly projects: readonly [ComposeProjectEvidence, ComposeProjectEvidence];
  readonly invalidStartupStoppedBeforeApi: boolean;
  readonly cleanupCommands: readonly string[];
}
```

- [ ] **Step 1: Write a failing static Docker/Compose contract test**

```ts
test("production files use compiled project-scoped contracts", () => {
  const backendDockerfile = read("backend/dockerfile");
  const frontendDockerfile = read("frontend/dockerfile");
  const compose = read("docker-compose.yml");
  expect(backendDockerfile).toContain("node dist/database/seed.js");
  expect(backendDockerfile).toContain("node dist/server.js");
  expect(frontendDockerfile).toContain("ARG VITE_API_BASE_URL");
  expect(compose).not.toMatch(/container_name:|restart:\s*always|command:\s/);
  expect(compose).toContain("VITE_API_BASE_URL:");
  expect(compose).toContain("condition: service_healthy");
});
```

- [ ] **Step 2: Run the static contract test in the red state**

Run from `backend`: `npm run test:unit -- dockerContract.unit.test.ts`

Expected: FAIL because both Dockerfiles install/run globally or from source-style paths and Compose still has fixed names, database host port, and command override.

- [ ] **Step 3: Put Prisma CLI in runtime dependencies and define startup scripts**

Run from `backend`:

```text
npm uninstall --save-dev prisma
npm install --save prisma@^6.19.2
```

Set `start` to `node dist/server.js`, `seed` to `node dist/database/seed.js`, and keep `prisma:generate`. Add frontend `start` as `serve -s dist -l 5173`; `serve` remains a normal lockfile-defined dependency from Task 1.

- [ ] **Step 4: Implement exact multi-stage images and build-context exclusions**

Backend builder uses `npm ci`, `npm run prisma:generate`, `npm run build`, and explicit `test -f dist/database/seed.js && test -f dist/server.js`. In the runtime stage, copy `package.json`, `package-lock.json`, and `prisma/` before `npm ci --omit=dev` so Prisma Client generation can see the schema; then copy `dist`, verify the generated client can be required, change ownership, and run as non-root. The runtime owns this chained command:

```dockerfile
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node dist/database/seed.js && node dist/server.js"]
```

Frontend builder uses `npm ci`, `ARG VITE_API_BASE_URL`, an explicit non-empty test, and `VITE_API_BASE_URL="$VITE_API_BASE_URL" npm run build`. Runtime uses `npm ci --omit=dev`, copies `dist`, runs non-root, and starts `node_modules/.bin/serve -s dist -l 5173`; no global package install or runtime Vite substitution.

Both `.dockerignore` files exclude `node_modules`, `dist`, coverage/test output, `.git`, local environment files, and editor/OS artifacts; backend does not exclude `prisma/schema.prisma` or `prisma/migrations`.

- [ ] **Step 5: Apply only remaining Compose changes**

Remove all `container_name`, the database host port, backend command override, source/dist bind mounts, fixed physical volume names, and external application volumes. Keep logical `postgres_data`. Add database `pg_isready`, API readiness health check, and frontend liveness health check; use `condition: service_healthy` for db→api and api→frontend.

Use Node 20 itself for HTTP health checks rather than assuming `curl` exists in the runtime images:

```yaml
api:
  healthcheck:
    test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:3000/health/ready').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]
frontend:
  healthcheck:
    test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:5173').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]
```

Use `${API_PORT:-3000}:3000` and `${FRONTEND_PORT:-5173}:5173`; pass backend `DATABASE_URL`, `PORT=3000`, `${CORS_ORIGIN:?set the public frontend origin}`, and `NODE_ENV=production`; pass frontend build arg `${VITE_API_BASE_URL:?set a public API base URL}`. Do not add, remove, stage separately, or claim ownership of the already absent `restart: always` line.

- [ ] **Step 6: Implement safe two-project verification**

The Node verifier allocates two random project names prefixed `employee-phase1-compose-test-`, selects distinct free API/frontend host ports, and sets each project's public API/frontend origins. It runs `docker compose -p <exact> build` then `up -d --wait`, records IDs/names/labels for only those containers, networks, volumes, and images, and asserts the two sets are disjoint.

For each frontend, fetch its page/assets and verify the compiled API URL belongs to that project; call its API with its own and the other project's `Origin` and verify only its own origin is allowed. Verify image startup order/failure using a disposable project with an invalid database URL. In `finally`, down only both exact projects with volumes, remove only image IDs recorded as newly created by the run, and print created/final resource states. Never run a global prune or broad label cleanup.

- [ ] **Step 7: Run image, artifact, health, and isolation gates**

Run from `backend`:

```text
npm ci
npm run prisma:generate
npm run build
npm run test:unit -- dockerContract.unit.test.ts
```

Run from `frontend` in PowerShell:

```text
npm ci
$env:VITE_API_BASE_URL = "http://127.0.0.1:33001"
npm run build
Remove-Item Env:VITE_API_BASE_URL
```

Run from repository root:

```text
docker build -f backend/dockerfile -t employee-phase1-backend-check ./backend
docker run --rm --entrypoint sh employee-phase1-backend-check -c "test -f dist/database/seed.js && test -f dist/server.js"
node scripts/verify-compose-isolation.mjs
```

On a POSIX shell, the frontend build can instead use `VITE_API_BASE_URL=http://127.0.0.1:33001 npm run build`.

Expected: clean builds succeed; backend artifacts are exact; startup stops before API on migration/seed failure; two project-scoped stacks use correct distinct URLs/origins/resources; verifier reports and removes only its exact resources. Manually compare `git diff d8f8c6e..HEAD -- docker-compose.yml` and confirm the historical restart-policy deletion is not part of this task's diff.

- [ ] **Step 8: Commit only remaining Docker/Compose work**

Stage exactly:

```text
backend/.dockerignore
frontend/.dockerignore
backend/.env.example
frontend/.env.example
scripts/verify-compose-isolation.mjs
backend/src/test/config/dockerContract.unit.test.ts
backend/dockerfile
frontend/dockerfile
backend/package.json
backend/package-lock.json
frontend/package.json
docker-compose.yml
```

Before commit, inspect `git diff --cached -- docker-compose.yml` and verify it contains no `restart: always` deletion.

Commit: `build: add compiled isolated containers`

---

### Task 12: Remove confirmed unused dependencies and produce final Phase 1 evidence

**Deliverable:** Direct unused `pg`/`uuid` dependencies are absent, clean installs and every approved gate pass or report an explicit production-security blocker, and the final scope/resource report proves Phase 1 stayed within bounds.

**Files:**
- Create: `backend/src/test/config/dependencyPolicy.unit.test.ts`
- Modify: `backend/package.json`
- Modify: `backend/package-lock.json`

**Interfaces:**
- Consumes: every command/interface/artifact from Tasks 1–11 and baseline commit `d8f8c6e` for the final scope comparison.
- Produces: lockfile-backed runtime dependency policy and the executor's final command/resource/security/scope evidence report; no additional specification, plan, README, or portfolio document.

- [ ] **Step 1: Write the failing dependency-policy test**

```ts
test("runtime dependencies contain only approved direct requirements", () => {
  const backend = readPackage("backend/package.json");
  const frontend = readPackage("frontend/package.json");
  expect(backend.dependencies.prisma).toBeDefined();
  expect(backend.dependencies.pg).toBeUndefined();
  expect(backend.dependencies.uuid).toBeUndefined();
  expect(frontend.dependencies.serve).toBeDefined();
});
```

- [ ] **Step 2: Run the policy test in the red state**

Run from `backend`: `npm run test:unit -- dependencyPolicy.unit.test.ts`

Expected: FAIL because `pg` and `uuid` remain direct dependencies.

- [ ] **Step 3: Confirm absence of imports and update only matching manifest/lockfile entries**

Run from repository root: `rg -n 'from ["''](pg|uuid)["'']|require\(["''](pg|uuid)["'']\)' backend -g '!package-lock.json' -g '!node_modules/**'`

Expected: no source/build/runtime adapter imports either package. Then run from `backend`: `npm uninstall pg uuid`. Do not remove transitive PostgreSQL packages required internally by Prisma and do not update unrelated dependency ranges.

- [ ] **Step 4: Run clean-install backend and frontend gates**

Run from `backend`:

```text
npm ci
npm run prisma:generate
npm run type-check
npm run lint
npm run format:check
npm run test:unit
npm run test:integration
npm run test:migration
npm test
npm run build
npx --no-install prisma validate
```

Run from `frontend`:

```text
npm ci
npm run type-check
npm run lint
npm run format:check
$env:VITE_API_BASE_URL = "http://127.0.0.1:3000"
npm run build
Remove-Item Env:VITE_API_BASE_URL
```

On a POSIX shell, the equivalent build command is `VITE_API_BASE_URL=http://127.0.0.1:3000 npm run build`.

Expected: all commands exit zero, Jest executes each source test once, and compiled backend artifacts remain exact.

- [ ] **Step 5: Run security review without automatic mutation**

Run `npm audit --omit=dev --json` separately in `backend` and `frontend`. Record production vulnerability totals, advisory identifiers, affected dependency paths, and whether each is direct/transitive. Never run `npm audit fix`. The expected acceptance state has no unresolved high/critical runtime finding. If one exists, record it as an explicit release blocker and stop before claiming Phase 1 completion; because its package/version cannot be pre-reviewed in this plan, any compatible manifest+lockfile remedy requires a separately approved plan correction rather than an unlisted change in this task.

- [ ] **Step 6: Re-run Docker/Compose and final scope audits**

Run from repository root:

```text
node scripts/verify-compose-isolation.mjs
git diff --name-status d8f8c6e..HEAD
git diff --check d8f8c6e..HEAD
rg -n -i 'password|secret|token|api[_-]?key' backend frontend docker-compose.yml -g '!package-lock.json' -g '!node_modules/**'
```

Review every changed path against this plan, verify no Phase 2–5 route/component/workflow/README/CI/deployment/portfolio artifact exists, confirm Compose still omits `restart: always`, and include exact Docker resources created and final state in the executor's final report.

- [ ] **Step 7: Commit the dependency and final-verification boundary**

Stage exactly:

```text
backend/src/test/config/dependencyPolicy.unit.test.ts
backend/package.json
backend/package-lock.json
```

Commit: `chore: complete phase 1 verification`

- [ ] **Step 8: Capture post-commit evidence without pushing**

Run:

```text
git status --short --branch
git log --oneline --decorate -14
git diff --quiet d8f8c6e..HEAD -- docs/superpowers/specs/2026-08-28-employee-management-phase-1-foundation-design.md
git diff d8f8c6e..HEAD -- docker-compose.yml
```

Expected: clean index/worktree; natural task commit chain; approved specification unchanged; Compose diff contains only remaining Task 11 changes and never reintroduces or recommits the earlier restart-policy removal; nothing is pushed.

---

## Dependency Order

```text
Task 1 quality/test foundation
  -> Task 2 canonical types/validation/config
  -> Task 3 errors/app/bootstrap/health
  -> Task 4 isolated database harness
  -> Task 5 atomic migration + Prisma schema
  -> Task 6 compiled canonical seed
  -> Task 7 repository/service boundary
  -> Task 8 CRUD/list/controller/API cutover
  -> Task 9 temporary XLSX compatibility
  -> Task 10 mechanical frontend cutover
  -> Task 11 compiled images + Compose isolation
  -> Task 12 clean-install/security/regression/scope evidence
```

Tasks are sequential because each consumes explicit interfaces or artifacts produced by its predecessor. Do not reorder migration before its safety harness, seed before canonical schema, HTTP routes before service/repository boundaries, frontend before finalized API envelopes, or containers before compiled paths and health endpoints.

## Specification Coverage Matrix

| Specification area | Implementing tasks | Verification evidence |
|---|---|---|
| §§1–4 purpose, goals, exclusions, repository baseline | 1–12 | Final path/scope audit; Compose baseline comparison |
| §5 architecture/responsibilities | 2, 3, 7, 8, 9 | Import scans, injected unit tests, app/API integration tests |
| §6 canonical model/fields/DTOs | 2, 5, 7, 10 | Boundary tables, Prisma validation, serializer/frontend checks |
| §7 complete Employee HTTP API | 8, 9 | Supertest CRUD/list/XLSX endpoint matrix |
| §8 global error contract | 3, 7, 8, 9 | Status/code/details/sanitization tests |
| §9 atomic migration and rollback | 4, 5 | Disposable migration suite, logical snapshots, guarded retry |
| §10 ten-record compiled seed | 5, 6 | Exact fixture/data comparison, compiled idempotency suite |
| §11 temporary XLSX boundary | 2, 7, 9 | Workbook structure/row/partial/export/round-trip suite |
| §12 mechanical frontend compatibility | 10 | Compile-time contract, build, network/UI smoke evidence |
| §13 startup, Docker, health, Compose | 3, 6, 11 | Artifact checks, direct startup, health and two-project verifier |
| §14 dependency/reproducibility policy | 1, 11, 12 | Manifest/lock review, `npm ci`, audits, dependency policy test |
| §15 tests/local quality baseline | 1, 4, 5, 6, 7, 8, 9, 10, 11, 12 | Every listed local command plus exact resource cleanup reports |
| §16 expected implementation surface | 1–12 | Implementation-surface map and final changed-path audit |
| §17.1 data/migration acceptance | 4, 5 | Catalog/rows/order/preflight/rollback/type/index assertions |
| §17.2 seed acceptance | 6 | Exact path/data/idempotency/failure tests |
| §17.3 API acceptance | 2, 3, 7, 8 | Validation/repository/service/Supertest suites |
| §17.4 XLSX acceptance | 9 | Import/export integration and round-trip suite |
| §17.5 frontend acceptance | 10 | Type/build/network/UI smoke checks |
| §17.6 Docker/Compose acceptance | 3, 6, 11 | Compiled paths, startup gates, isolation/cleanup verifier |
| §17.7 dependency/quality acceptance | 1, 11, 12 | Clean installs, full commands, audits, discovery test |
| §17.8 scope acceptance | 12 | Baseline-to-HEAD changed-path and leakage review |
| §18 consolidated decisions | 1–12 | Cross-task interface registry plus final regression/scope evidence |

## Plan Self-Review Record

| Review | Result encoded by this plan |
|---|---|
| Specification coverage | Every section (§§1–18) and acceptance group (§17.1–§17.8) maps to at least one task above. |
| Type/signature consistency | Backend canonical types are defined once in Task 2; repository/service/app/XLSX signatures consume them, and Task 10 mirrors the public contract at the frontend boundary. |
| File-path accuracy | Every baseline modified/removed path exists in the inspected repository; `appDependencies.ts` is created in Task 3 before Tasks 8–9 modify it; every create path is mapped before first use. |
| Dependency order | Safety precedes migration; schema precedes seed; repository/service precede HTTP; API precedes XLSX/frontend; compiled artifacts precede Docker. |
| Database safety | Only prefixed loopback disposable databases/projects can mutate; catalog/rows and Prisma ledger are separated; cleanup is exact and idempotent. |
| Docker safety | Verification records two exact random project resource sets and removes only those; no prune, broad deletion, fixed name, or shared application volume is allowed. |
| Commit boundaries | Every task has one explicit path list and message; Task 11 owns only remaining Compose changes and never recommits the existing restart-policy removal. |
| Phase leakage | Authentication/reset, redesign, advanced XLSX UX/filter-aware export, deployment/CI, README, and portfolio work are excluded from every task. |
| Execution handoff | Plan approval is required before using the specified Superpowers execution workflow; this document offers no execution start during review. |
