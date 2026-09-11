import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { tmpdir } from "node:os";

import { PrismaClient } from "@prisma/client";

export interface ProcessResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

export interface DisposableDatabase {
  readonly name: string;
  readonly url: string;
  executeSqlFile(path: string): Promise<void>;
  runPrisma(args: readonly string[], schemaPath?: string): Promise<ProcessResult>;
  dispose(): Promise<void>;
}

export interface TestDatabaseEnvironment {
  readonly adminUrl: string;
  readonly composeProject: string;
  readonly mutationAllowed: true;
}

const backendRoot = resolve(__dirname, "../../..");
const composeFile = resolve(backendRoot, "test", "docker-compose.postgres.yml");
const dockerExecutable = process.platform === "win32" ? "docker.exe" : "docker";
const composeProjectPattern = /^employee-phase1-test-[0-9]+-[a-f0-9]{12}$/u;
const databaseNamePattern = /^employee_phase1_test_[a-z0-9_]+$/u;
const temporaryWorkspacePrefixes = [
  "employee-phase1-prisma-initial-",
  "employee-phase1-prisma-failure-",
] as const;
const loopbackHosts = new Set(["127.0.0.1", "localhost", "[::1]"]);

const normalizeAdminUrl = (value: string | undefined): string => {
  if (!value) throw new Error("TEST_DATABASE_ADMIN_URL is required.");

  const trimmed = value.trim();
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("TEST_DATABASE_ADMIN_URL must be a PostgreSQL URL.");
  }

  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
    throw new Error("TEST_DATABASE_ADMIN_URL must be a PostgreSQL URL.");
  }
  if (!loopbackHosts.has(url.hostname)) {
    throw new Error("TEST_DATABASE_ADMIN_URL must use a loopback host.");
  }
  if (url.pathname !== "/postgres") {
    throw new Error("TEST_DATABASE_ADMIN_URL path must be exactly /postgres.");
  }
  if (url.search || url.hash) {
    throw new Error("TEST_DATABASE_ADMIN_URL must not contain a query or fragment.");
  }

  return trimmed;
};

export function parseTestDatabaseEnvironment(source: NodeJS.ProcessEnv): TestDatabaseEnvironment {
  if (source.NODE_ENV !== "test") {
    throw new Error("NODE_ENV must be test before database mutation.");
  }
  if (source.ALLOW_DATABASE_MUTATION !== "true") {
    throw new Error("ALLOW_DATABASE_MUTATION must be true before database mutation.");
  }

  const composeProject = source.TEST_COMPOSE_PROJECT?.trim() ?? "";
  if (!composeProjectPattern.test(composeProject)) {
    throw new Error("Compose project must be a uniquely generated employee-phase1-test project.");
  }

  return {
    adminUrl: normalizeAdminUrl(source.TEST_DATABASE_ADMIN_URL),
    composeProject,
    mutationAllowed: true,
  };
}

export function quoteIdentifier(identifier: string): string {
  if (!databaseNamePattern.test(identifier) || identifier.length > 63) {
    throw new Error("Database identifier must use the generated test-only prefix.");
  }
  return `"${identifier}"`;
}

export function assertTemporaryWorkspaceSafe(path: string): string {
  if (!isAbsolute(path)) {
    throw new Error("Path is not an absolute test-owned temporary workspace.");
  }

  const resolvedPath = resolve(path);
  const resolvedTemporaryRoot = resolve(tmpdir());
  const pathRelativeToTemporaryRoot = relative(resolvedTemporaryRoot, resolvedPath);
  const isBelowTemporaryRoot =
    pathRelativeToTemporaryRoot !== "" &&
    pathRelativeToTemporaryRoot !== ".." &&
    !pathRelativeToTemporaryRoot.startsWith(`..${sep}`) &&
    !isAbsolute(pathRelativeToTemporaryRoot);
  const firstSegment = pathRelativeToTemporaryRoot.split(sep)[0] ?? "";
  const hasOwnedPrefix = temporaryWorkspacePrefixes.some((prefix) =>
    firstSegment.startsWith(prefix),
  );

  if (!isBelowTemporaryRoot || !hasOwnedPrefix) {
    throw new Error("Path is not a test-owned temporary workspace.");
  }

  return resolvedPath;
}

export function assertDisposableDatabaseUrl(name: string, databaseUrl: string): string {
  quoteIdentifier(name);
  const environment = parseTestDatabaseEnvironment(process.env);
  const expectedUrl = new URL(environment.adminUrl);
  expectedUrl.pathname = `/${name}`;

  let actualUrl: URL;
  try {
    actualUrl = new URL(databaseUrl);
  } catch {
    throw new Error("Disposable database URL is invalid.");
  }

  if (actualUrl.toString() !== expectedUrl.toString()) {
    throw new Error("Disposable database URL does not match the guarded test allocation.");
  }

  return actualUrl.toString();
}

export function assertIsolatedTestDatabaseUrl(databaseUrl: string): string {
  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new Error("Test database URL is invalid.");
  }

  const databaseName = url.pathname.slice(1);
  if (
    (url.protocol !== "postgresql:" && url.protocol !== "postgres:") ||
    !loopbackHosts.has(url.hostname) ||
    !databaseNamePattern.test(databaseName) ||
    url.search !== "" ||
    url.hash !== ""
  ) {
    throw new Error("Database URL is not an isolated Phase 1 test database.");
  }

  return url.toString();
}

function createDatabaseUrl(adminUrl: string, name: string): string {
  const url = new URL(adminUrl);
  url.pathname = `/${name}`;
  return url.toString();
}

function createDatabaseName(label: string): string {
  if (!/^[a-z0-9_]{1,16}$/u.test(label)) {
    throw new Error("Disposable database label must contain only lowercase test-safe characters.");
  }
  const name = `employee_phase1_test_${label}_${process.pid}_${randomBytes(6).toString("hex")}`;
  quoteIdentifier(name);
  return name;
}

async function runProcess(
  executable: string,
  args: readonly string[],
  environment: NodeJS.ProcessEnv,
  stdinPath?: string,
): Promise<ProcessResult> {
  return new Promise((resolveProcess, rejectProcess) => {
    const child = spawn(executable, [...args], {
      cwd: backendRoot,
      env: environment,
      shell: false,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let settled = false;

    const rejectOnce = (error: Error) => {
      if (settled) return;
      settled = true;
      rejectProcess(error);
    };

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.once("error", rejectOnce);
    child.once("close", (exitCode) => {
      if (settled) return;
      settled = true;
      resolveProcess({ exitCode: exitCode ?? -1, stdout, stderr });
    });

    if (stdinPath) {
      const input = createReadStream(stdinPath);
      input.once("error", (error) => {
        child.kill();
        rejectOnce(error);
      });
      input.pipe(child.stdin);
    } else {
      child.stdin.end();
    }
  });
}

function prismaArguments(args: readonly string[], schemaPath: string): readonly string[] {
  const npmExecutablePath = process.env.npm_execpath;
  if (!npmExecutablePath) {
    throw new Error("npm_execpath is required; run Prisma helpers through an npm test script.");
  }
  const npxCliPath = resolve(dirname(npmExecutablePath), "npx-cli.js");
  return [npxCliPath, "--no-install", "prisma", ...args, "--schema", schemaPath];
}

export async function allocateDisposableDatabase(label: string): Promise<DisposableDatabase> {
  const environment = parseTestDatabaseEnvironment(process.env);
  const name = createDatabaseName(label);
  const url = createDatabaseUrl(environment.adminUrl, name);
  const adminClient = new PrismaClient({ datasourceUrl: environment.adminUrl });
  let disposed = false;

  try {
    await adminClient.$executeRawUnsafe(`CREATE DATABASE ${quoteIdentifier(name)}`);
  } catch (error) {
    await adminClient.$disconnect();
    throw error;
  }

  console.info(`[task6-resource] database created ${name}`);

  return {
    name,
    url,
    async executeSqlFile(path: string): Promise<void> {
      assertDisposableDatabaseUrl(name, url);
      const result = await runProcess(
        dockerExecutable,
        [
          "compose",
          "-p",
          environment.composeProject,
          "-f",
          composeFile,
          "exec",
          "-T",
          "postgres",
          "psql",
          "-v",
          "ON_ERROR_STOP=1",
          "-U",
          "postgres",
          "-d",
          name,
        ],
        process.env,
        resolve(path),
      );
      if (result.exitCode !== 0) {
        throw new Error(`psql exited ${result.exitCode}: ${result.stderr || result.stdout}`);
      }
    },
    async runPrisma(args: readonly string[], schemaPath = "prisma/schema.prisma") {
      assertDisposableDatabaseUrl(name, url);
      return runProcess(process.execPath, prismaArguments(args, schemaPath), {
        ...process.env,
        DATABASE_URL: url,
      });
    },
    async dispose(): Promise<void> {
      if (disposed) return;
      assertDisposableDatabaseUrl(name, url);
      try {
        await adminClient.$executeRaw`
          SELECT pg_terminate_backend(pid)
          FROM pg_stat_activity
          WHERE datname = ${name} AND pid <> pg_backend_pid()
        `;
        await adminClient.$executeRawUnsafe(`DROP DATABASE IF EXISTS ${quoteIdentifier(name)}`);
        disposed = true;
        console.info(`[task6-resource] database disposed ${name}`);
      } finally {
        await adminClient.$disconnect();
      }
    },
  };
}

export async function disposableDatabaseExists(name: string): Promise<boolean> {
  quoteIdentifier(name);
  const environment = parseTestDatabaseEnvironment(process.env);
  const client = new PrismaClient({ datasourceUrl: environment.adminUrl });
  try {
    const rows = await client.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = ${name}) AS "exists"
    `;
    return rows[0]?.exists === true;
  } finally {
    await client.$disconnect();
  }
}
