import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const backendRoot = fileURLToPath(new URL("../", import.meta.url));
const composeFile = resolve(backendRoot, "test", "docker-compose.postgres.yml");
const dockerExecutable = process.platform === "win32" ? "docker.exe" : "docker";
const projectPattern = /^employee-phase1-test-[0-9]+-[a-f0-9]{12}$/u;
const integrationDatabase = "employee_phase1_test_suite";
const authorityVariables = [
  "TEST_DATABASE_ADMIN_URL",
  "TEST_COMPOSE_PROJECT",
  "ALLOW_DATABASE_MUTATION",
];

const mode = process.argv[2];
const forwardedArguments = process.argv.slice(3);

if (mode !== "integration" && mode !== "migration") {
  throw new Error("Usage: node scripts/run-isolated-tests.mjs <integration|migration> [jest args]");
}
if (!process.env.npm_execpath) {
  throw new Error("npm_execpath is required; run isolated tests through an npm test script");
}

const npxCliPath = resolve(dirname(process.env.npm_execpath), "npx-cli.js");

const project = `employee-phase1-test-${process.pid}-${randomBytes(6).toString("hex")}`;
if (!projectPattern.test(project)) {
  throw new Error(`Generated Compose project name is unsafe: ${project}`);
}

const composeArguments = ["compose", "-p", project, "-f", composeFile];

function runCommand(executable, args, options = {}) {
  const result = spawnSync(executable, args, {
    cwd: backendRoot,
    encoding: "utf8",
    env: options.env ?? process.env,
    input: options.input,
    maxBuffer: 32 * 1024 * 1024,
    shell: false,
  });

  if (options.echo !== false) {
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
  }
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `${executable} ${args.join(" ")} exited ${result.status}.\n${result.stderr || result.stdout}`,
    );
  }

  return result.stdout.trim();
}

function runNpx(args, options = {}) {
  return runCommand(process.execPath, [npxCliPath, "--no-install", ...args], options);
}

function resourceLines(args) {
  const output = runCommand(dockerExecutable, args, { echo: false });
  return output ? output.split(/\r?\n/u).filter(Boolean).sort() : [];
}

function snapshotResources() {
  const label = `label=com.docker.compose.project=${project}`;
  return {
    containers: resourceLines([
      "ps",
      "-a",
      "--filter",
      label,
      "--format",
      '{{.ID}}|{{.Names}}|{{.Label "com.docker.compose.project"}}',
    ]),
    networks: resourceLines([
      "network",
      "ls",
      "--filter",
      label,
      "--format",
      '{{.ID}}|{{.Name}}|{{.Label "com.docker.compose.project"}}',
    ]),
    volumes: resourceLines([
      "volume",
      "ls",
      "--filter",
      label,
      "--format",
      '{{.Name}}|{{.Label "com.docker.compose.project"}}',
    ]),
  };
}

function resourceCount(snapshot) {
  return snapshot.containers.length + snapshot.networks.length + snapshot.volumes.length;
}

function childEnvironment() {
  const environment = { ...process.env, NODE_ENV: "test" };
  for (const variable of authorityVariables) delete environment[variable];
  return environment;
}

let projectOwned = false;
let created = { containers: [], networks: [], volumes: [] };
let final = { containers: [], networks: [], volumes: [] };
let primaryError;
let cleanupError;
let databaseName = null;

try {
  const before = snapshotResources();
  if (resourceCount(before) !== 0) {
    throw new Error(`Generated project unexpectedly exists; refusing cleanup: ${project}`);
  }

  projectOwned = true;
  runCommand(dockerExecutable, [...composeArguments, "up", "-d", "--wait"]);
  created = snapshotResources();
  if (
    created.containers.length !== 1 ||
    created.networks.length !== 1 ||
    created.volumes.length !== 0
  ) {
    throw new Error(`Unexpected isolated Compose resources: ${JSON.stringify(created)}`);
  }

  const portOutput = runCommand(
    dockerExecutable,
    [...composeArguments, "port", "postgres", "5432"],
    { echo: false },
  );
  const portMatch = /^127\.0\.0\.1:([0-9]+)$/u.exec(portOutput);
  if (!portMatch) {
    throw new Error(`PostgreSQL was not bound to a loopback address: ${portOutput}`);
  }

  const port = Number(portMatch[1]);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Docker assigned an invalid PostgreSQL port: ${portMatch[1]}`);
  }

  const adminUrl = `postgresql://postgres:postgres@127.0.0.1:${port}/postgres`;
  const jestEnvironment = childEnvironment();

  if (mode === "integration") {
    databaseName = integrationDatabase;
    runCommand(dockerExecutable, [
      ...composeArguments,
      "exec",
      "-T",
      "postgres",
      "createdb",
      "-U",
      "postgres",
      integrationDatabase,
    ]);

    const databaseUrl = `postgresql://postgres:postgres@127.0.0.1:${port}/${integrationDatabase}`;
    jestEnvironment.DATABASE_URL = databaseUrl;
    runNpx(["prisma", "migrate", "deploy", "--schema", "prisma/schema.prisma"], {
      env: jestEnvironment,
    });
  } else {
    delete jestEnvironment.DATABASE_URL;
    jestEnvironment.TEST_DATABASE_ADMIN_URL = adminUrl;
    jestEnvironment.TEST_COMPOSE_PROJECT = project;
    jestEnvironment.ALLOW_DATABASE_MUTATION = "true";
  }

  runNpx(
    ["jest", "--selectProjects", mode, "--runInBand", "--passWithNoTests", ...forwardedArguments],
    { env: jestEnvironment },
  );
} catch (error) {
  primaryError = error;
} finally {
  if (projectOwned) {
    try {
      runCommand(dockerExecutable, [...composeArguments, "down", "--volumes", "--remove-orphans"]);
    } catch (error) {
      cleanupError = error;
    }
  }

  try {
    final = snapshotResources();
    if (resourceCount(final) !== 0) {
      cleanupError ??= new Error(`Temporary project resources remain: ${JSON.stringify(final)}`);
    }
  } catch (error) {
    cleanupError ??= error;
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        mode,
        project,
        databaseName,
        created,
        final,
        cleanupCommand: [
          dockerExecutable,
          ...composeArguments,
          "down",
          "--volumes",
          "--remove-orphans",
        ],
      },
      null,
      2,
    )}\n`,
  );
}

if (cleanupError) throw cleanupError;
if (primaryError) throw primaryError;
