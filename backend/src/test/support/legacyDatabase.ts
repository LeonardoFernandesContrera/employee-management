import { randomBytes } from "node:crypto";
import { cp, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

import { Prisma, PrismaClient } from "@prisma/client";

import type { EmployeeStatus } from "../../domain/employee";
import type { LegacyEmployeeFixture, RetryFixtureCorrection } from "../fixtures/legacyEmployees";
import {
  allocateDisposableDatabase,
  assertDisposableDatabaseUrl,
  assertIsolatedTestDatabaseUrl,
  assertTemporaryWorkspaceSafe,
  type DisposableDatabase,
  type ProcessResult,
} from "./testDatabase";

export interface PrismaWorkspace {
  readonly root: string;
  readonly schemaPath: string;
  dispose(): Promise<void>;
}

export interface CatalogColumn {
  readonly name: string;
  readonly dataType: string;
  readonly udtName: string;
  readonly nullable: boolean;
  readonly defaultExpression: string | null;
}

export interface NamedDefinition {
  readonly name: string;
  readonly definition: string;
}

export interface ApplicationCatalogSnapshot {
  readonly columns: readonly CatalogColumn[];
  readonly constraints: readonly NamedDefinition[];
  readonly indexes: readonly NamedDefinition[];
  readonly enumLabels: readonly string[];
}

export interface LegacyEmployeeRowSnapshot {
  readonly uuid: string;
  readonly name: string;
  readonly address: string;
  readonly neighborhood: string | null;
  readonly zipcode: string | null;
  readonly phone: string | null;
  readonly salary: string;
  readonly contract_date: string;
  readonly role: string;
  readonly status: string;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface CanonicalEmployeeRowSnapshot {
  readonly id: string;
  readonly email: string;
  readonly fullName: string;
  readonly jobTitle: string;
  readonly status: EmployeeStatus;
  readonly salary: string;
  readonly hireDate: string;
  readonly phone: string | null;
  readonly address: string | null;
  readonly neighborhood: string | null;
  readonly postalCode: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface LegacyEmployeeState {
  readonly applicationCatalog: ApplicationCatalogSnapshot;
  readonly orderedRows: readonly LegacyEmployeeRowSnapshot[];
}

export interface CanonicalEmployeeState {
  readonly applicationCatalog: ApplicationCatalogSnapshot;
  readonly orderedRows: readonly CanonicalEmployeeRowSnapshot[];
}

export interface MigrationLedgerEntry {
  readonly id: string;
  readonly migrationName: string;
  readonly checksum: string;
  readonly startedAt: string;
  readonly finishedAt: string | null;
  readonly rolledBackAt: string | null;
  readonly logs: string | null;
}

const backendRoot = resolve(__dirname, "../../..");
const repositoryPrismaRoot = join(backendRoot, "prisma");
const repositorySchemaPath = join(repositoryPrismaRoot, "schema.prisma");
const initialMigrationName = "20260308150134_init";
const phase1MigrationName = "20260829000100_employee_phase_1_foundation";
const initialWorkspacePrefix = "employee-phase1-prisma-initial-";
const failureWorkspacePrefix = "employee-phase1-prisma-failure-";
const fixedTimestamp = "2026-08-28 12:00:00.000";

const resourceLog = (action: "created" | "disposed", type: string, value: string) => {
  console.info(`[task6-resource] ${type} ${action} ${value}`);
};

const createWorkspaceDisposer = (root: string) => {
  let disposed = false;
  return async () => {
    if (disposed) return;
    const safeRoot = assertTemporaryWorkspaceSafe(root);
    await rm(safeRoot, { recursive: true, force: true });
    disposed = true;
    resourceLog("disposed", "workspace", safeRoot);
  };
};

const assertSuccessfulProcess = (result: ProcessResult, operation: string) => {
  if (result.exitCode !== 0) {
    throw new Error(`${operation} exited ${result.exitCode}: ${result.stderr || result.stdout}`);
  }
};

const assertDatabase = (database: DisposableDatabase) => {
  assertDisposableDatabaseUrl(database.name, database.url);
};

const withDatabaseClient = async <T>(
  database: DisposableDatabase,
  run: (client: PrismaClient) => Promise<T>,
): Promise<T> => {
  assertDatabase(database);
  const client = new PrismaClient({ datasourceUrl: database.url });
  try {
    return await run(client);
  } finally {
    await client.$disconnect();
  }
};

export function encodePostgresLiteral(value: string | null): string {
  if (value === null) return "NULL";
  return `E'${value.replace(/\\/gu, "\\\\").replace(/'/gu, "''")}'`;
}

export async function createInitialOnlyPrismaWorkspace(): Promise<PrismaWorkspace> {
  const root = await mkdtemp(join(tmpdir(), initialWorkspacePrefix));
  const safeRoot = assertTemporaryWorkspaceSafe(root);
  const prismaRoot = join(safeRoot, "prisma");
  const migrationRoot = join(prismaRoot, "migrations", initialMigrationName);
  const dispose = createWorkspaceDisposer(safeRoot);

  try {
    await mkdir(migrationRoot, { recursive: true });
    await copyFile(repositorySchemaPath, join(prismaRoot, "schema.prisma"));
    await copyFile(
      join(repositoryPrismaRoot, "migrations", "migration_lock.toml"),
      join(prismaRoot, "migrations", "migration_lock.toml"),
    );
    await copyFile(
      join(repositoryPrismaRoot, "migrations", initialMigrationName, "migration.sql"),
      join(migrationRoot, "migration.sql"),
    );
  } catch (error) {
    await dispose();
    throw error;
  }

  resourceLog("created", "workspace", safeRoot);
  return { root: safeRoot, schemaPath: join(prismaRoot, "schema.prisma"), dispose };
}

export async function createInjectedFailureWorkspace(): Promise<PrismaWorkspace> {
  const root = await mkdtemp(join(tmpdir(), failureWorkspacePrefix));
  const safeRoot = assertTemporaryWorkspaceSafe(root);
  const prismaRoot = join(safeRoot, "prisma");
  const dispose = createWorkspaceDisposer(safeRoot);

  try {
    await mkdir(prismaRoot, { recursive: true });
    await copyFile(repositorySchemaPath, join(prismaRoot, "schema.prisma"));
    await cp(join(repositoryPrismaRoot, "migrations"), join(prismaRoot, "migrations"), {
      recursive: true,
    });

    const migrationPath = join(prismaRoot, "migrations", phase1MigrationName, "migration.sql");
    const migrationSql = await readFile(migrationPath, "utf8");
    const commitMatches = [...migrationSql.matchAll(/^[ \t]*COMMIT;[ \t]*$/gimu)];
    const terminalCommit = /COMMIT;[ \t]*(?:\r?\n)?$/u.exec(migrationSql);
    if (commitMatches.length !== 1 || !terminalCommit || terminalCommit.index === undefined) {
      throw new Error("Phase 1 migration must contain exactly one terminal COMMIT;.");
    }

    const injectedFailure = [
      "DO $task6_failure$",
      "BEGIN",
      "  RAISE EXCEPTION 'test-only pre-commit failure';",
      "END",
      "$task6_failure$;",
      "",
    ].join("\n");
    const modifiedSql =
      migrationSql.slice(0, terminalCommit.index) +
      injectedFailure +
      migrationSql.slice(terminalCommit.index);
    await writeFile(migrationPath, modifiedSql, "utf8");
  } catch (error) {
    await dispose();
    throw error;
  }

  resourceLog("created", "workspace", safeRoot);
  return { root: safeRoot, schemaPath: join(prismaRoot, "schema.prisma"), dispose };
}

export async function insertLegacyFixtures(
  database: DisposableDatabase,
  rows: readonly LegacyEmployeeFixture[],
): Promise<void> {
  assertDatabase(database);
  if (rows.length === 0) return;

  const workspaceRoot = assertTemporaryWorkspaceSafe(
    await mkdtemp(join(tmpdir(), initialWorkspacePrefix)),
  );
  const sqlPath = join(workspaceRoot, `legacy-fixtures-${randomBytes(6).toString("hex")}.sql`);
  resourceLog("created", "workspace", workspaceRoot);

  const values = rows
    .map((row) =>
      [
        encodePostgresLiteral(row.uuid),
        encodePostgresLiteral(row.name),
        encodePostgresLiteral(row.address),
        encodePostgresLiteral(row.neighborhood),
        encodePostgresLiteral(row.zipcode),
        encodePostgresLiteral(row.phone),
        `${encodePostgresLiteral(row.salary)}::decimal`,
        `${encodePostgresLiteral(row.contractDate)}::timestamp`,
        encodePostgresLiteral(row.role),
        encodePostgresLiteral(row.status),
        `${encodePostgresLiteral(fixedTimestamp)}::timestamp`,
        `${encodePostgresLiteral(fixedTimestamp)}::timestamp`,
      ].join(", "),
    )
    .map((value) => `  (${value})`)
    .join(",\n");
  const sql = [
    'INSERT INTO "Employee" (',
    '  "uuid", "name", "address", "neighborhood", "zipcode", "phone",',
    '  "salary", "contract_date", "role", "status", "created_at", "updated_at"',
    ") VALUES",
    `${values};`,
    "",
  ].join("\n");

  try {
    await writeFile(sqlPath, sql, "utf8");
    await database.executeSqlFile(sqlPath);
  } finally {
    await rm(assertTemporaryWorkspaceSafe(workspaceRoot), { recursive: true, force: true });
    resourceLog("disposed", "workspace", workspaceRoot);
  }
}

export async function withLegacyDatabase<T>(
  label: string,
  rows: readonly LegacyEmployeeFixture[],
  run: (database: DisposableDatabase) => Promise<T>,
): Promise<T> {
  const database = await allocateDisposableDatabase(label);
  let workspace: PrismaWorkspace | undefined;
  try {
    workspace = await createInitialOnlyPrismaWorkspace();
    const migration = await database.runPrisma(["migrate", "deploy"], workspace.schemaPath);
    assertSuccessfulProcess(migration, "Initial migration deployment");
    await insertLegacyFixtures(database, rows);
    return await run(database);
  } finally {
    try {
      await workspace?.dispose();
    } finally {
      await database.dispose();
    }
  }
}

export async function applyRepositoryMigrations(database: DisposableDatabase): Promise<void> {
  assertDatabase(database);
  const result = await database.runPrisma(["migrate", "deploy"], "prisma/schema.prisma");
  assertSuccessfulProcess(result, "Repository migration deployment");
}

export async function withMigratedDatabase<T>(
  label: string,
  run: (database: DisposableDatabase) => Promise<T>,
): Promise<T> {
  const database = await allocateDisposableDatabase(label);
  try {
    await applyRepositoryMigrations(database);
    return await run(database);
  } finally {
    await database.dispose();
  }
}

async function snapshotApplicationCatalog(
  database: DisposableDatabase,
): Promise<ApplicationCatalogSnapshot> {
  return withDatabaseClient(database, async (client) => {
    const columns = await client.$queryRawUnsafe<CatalogColumn[]>(`
      SELECT
        column_name AS "name",
        data_type AS "dataType",
        udt_name AS "udtName",
        (is_nullable = 'YES') AS "nullable",
        column_default AS "defaultExpression"
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'Employee'
      ORDER BY ordinal_position ASC
    `);
    const constraints = await client.$queryRawUnsafe<NamedDefinition[]>(`
      SELECT constraint_definition.conname AS "name",
             pg_get_constraintdef(constraint_definition.oid, true) AS "definition"
      FROM pg_constraint AS constraint_definition
      JOIN pg_class AS employee_table ON employee_table.oid = constraint_definition.conrelid
      JOIN pg_namespace AS employee_schema ON employee_schema.oid = employee_table.relnamespace
      WHERE employee_schema.nspname = 'public' AND employee_table.relname = 'Employee'
      ORDER BY constraint_definition.conname COLLATE "C" ASC
    `);
    const indexes = await client.$queryRawUnsafe<NamedDefinition[]>(`
      SELECT indexname AS "name", indexdef AS "definition"
      FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'Employee'
      ORDER BY indexname COLLATE "C" ASC
    `);
    const enumRows = await client.$queryRawUnsafe<Array<{ label: string }>>(`
      SELECT enum_value.enumlabel AS "label"
      FROM pg_type AS enum_type
      JOIN pg_enum AS enum_value ON enum_value.enumtypid = enum_type.oid
      JOIN pg_namespace AS enum_schema ON enum_schema.oid = enum_type.typnamespace
      WHERE enum_schema.nspname = 'public' AND enum_type.typname = 'EmployeeStatus'
      ORDER BY enum_value.enumsortorder ASC
    `);
    return { columns, constraints, indexes, enumLabels: enumRows.map((row) => row.label) };
  });
}

export async function snapshotLegacyEmployeeState(
  database: DisposableDatabase,
): Promise<LegacyEmployeeState> {
  const applicationCatalog = await snapshotApplicationCatalog(database);
  const orderedRows = await withDatabaseClient(database, (client) =>
    client.$queryRawUnsafe<LegacyEmployeeRowSnapshot[]>(`
      SELECT
        "uuid", "name", "address", "neighborhood", "zipcode", "phone",
        "salary"::text AS "salary",
        "contract_date"::text AS "contract_date",
        "role", "status",
        "created_at"::text AS "created_at",
        "updated_at"::text AS "updated_at"
      FROM "Employee"
      ORDER BY "uuid" COLLATE "C" ASC
    `),
  );
  return { applicationCatalog, orderedRows };
}

export async function snapshotCanonicalEmployeeState(
  database: DisposableDatabase,
): Promise<CanonicalEmployeeState> {
  const applicationCatalog = await snapshotApplicationCatalog(database);
  const orderedRows = await withDatabaseClient(database, (client) =>
    client.$queryRawUnsafe<CanonicalEmployeeRowSnapshot[]>(`
      SELECT
        "uuid" AS "id",
        "email",
        "name" AS "fullName",
        "role" AS "jobTitle",
        "status"::text AS "status",
        "salary"::text AS "salary",
        "contract_date"::text AS "hireDate",
        "phone", "address", "neighborhood",
        "zipcode" AS "postalCode",
        "created_at"::text AS "createdAt",
        "updated_at"::text AS "updatedAt"
      FROM "Employee"
      ORDER BY "uuid" COLLATE "C" ASC
    `),
  );
  return { applicationCatalog, orderedRows };
}

interface RawMigrationLedgerEntry {
  readonly id: string;
  readonly migrationName: string;
  readonly checksum: string;
  readonly startedAt: Date;
  readonly finishedAt: Date | null;
  readonly rolledBackAt: Date | null;
  readonly logs: string | null;
}

export async function readMigrationLedger(
  database: DisposableDatabase,
): Promise<readonly MigrationLedgerEntry[]> {
  return withDatabaseClient(database, async (client) => {
    const rows = await client.$queryRawUnsafe<RawMigrationLedgerEntry[]>(`
      SELECT
        "id",
        "migration_name" AS "migrationName",
        "checksum",
        "started_at" AS "startedAt",
        "finished_at" AS "finishedAt",
        "rolled_back_at" AS "rolledBackAt",
        "logs"
      FROM "_prisma_migrations"
      ORDER BY "started_at" ASC, ("finished_at" IS NOT NULL) ASC, "id" ASC
    `);
    return rows.map((row) => ({
      id: row.id,
      migrationName: row.migrationName,
      checksum: row.checksum,
      startedAt: row.startedAt.toISOString(),
      finishedAt: row.finishedAt?.toISOString() ?? null,
      rolledBackAt: row.rolledBackAt?.toISOString() ?? null,
      logs: row.logs,
    }));
  });
}

export async function markPhase1MigrationRolledBack(
  database: DisposableDatabase,
): Promise<ProcessResult> {
  assertDatabase(database);
  return database.runPrisma(
    ["migrate", "resolve", "--rolled-back", phase1MigrationName],
    "prisma/schema.prisma",
  );
}

export async function correctRetryFixture(
  database: DisposableDatabase,
  uuid: string,
  correction: RetryFixtureCorrection,
): Promise<void> {
  assertDatabase(database);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(uuid)) {
    throw new Error("Retry fixture UUID must be UUID-shaped.");
  }

  const updates: Prisma.Sql[] = [];
  if (correction.status !== undefined) {
    updates.push(Prisma.sql`"status" = ${correction.status}`);
  }
  if (correction.salary !== undefined) {
    updates.push(Prisma.sql`"salary" = ${correction.salary}::decimal`);
  }
  if (correction.contractDate !== undefined) {
    updates.push(Prisma.sql`"contract_date" = ${correction.contractDate}::timestamp`);
  }
  if (updates.length === 0) return;

  await withDatabaseClient(database, async (client) => {
    const changed = await client.$executeRaw(
      Prisma.sql`UPDATE "Employee" SET ${Prisma.join(updates, ", ")} WHERE "uuid" = ${uuid}`,
    );
    if (changed !== 1) throw new Error("Retry correction must update exactly one test fixture.");
  });
}

export async function runCompiledSeed(databaseUrl: string): Promise<ProcessResult> {
  const guardedUrl = assertIsolatedTestDatabaseUrl(databaseUrl);
  const { spawn } = await import("node:child_process");

  return new Promise((resolveProcess, rejectProcess) => {
    const child = spawn(process.execPath, ["dist/database/seed.js"], {
      cwd: backendRoot,
      env: { ...process.env, DATABASE_URL: guardedUrl },
      shell: false,
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.once("error", rejectProcess);
    child.once("close", (exitCode) => {
      resolveProcess({ exitCode: exitCode ?? -1, stdout, stderr });
    });
  });
}
