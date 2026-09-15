import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const composeFile = resolve(repositoryRoot, "docker-compose.yml");
const dockerExecutable = process.platform === "win32" ? "docker.exe" : "docker";
const projectPattern =
  /^employee-phase1-compose-test-(?:isolation-a|isolation-b|invalid-startup)-[0-9]+-[a-f0-9]{12}$/u;
const smokeProjectPattern = /^employee-phase1-compose-smoke-[0-9]+-[a-f0-9]{12}$/u;
const directTagPattern = /^employee-phase1-backend-check-[0-9]+-[a-f0-9]{12}$/u;
const emptySnapshot = () => ({ containers: [], networks: [], volumes: [], images: [] });

function runResult(executable, args, options = {}) {
  const result = spawnSync(executable, args, {
    cwd: options.cwd ?? repositoryRoot,
    encoding: "utf8",
    env: options.env ?? process.env,
    input: options.input,
    maxBuffer: 64 * 1024 * 1024,
    shell: false,
  });

  if (options.echo !== false) {
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
  }
  if (result.error) throw result.error;
  return result;
}

function runCommand(executable, args, options = {}) {
  const result = runResult(executable, args, options);
  if (result.status !== 0) {
    throw new Error(
      `${executable} ${args.join(" ")} exited ${result.status}.\n${result.stderr || result.stdout}`,
    );
  }
  return result.stdout.trim();
}

function outputLines(output) {
  return output ? output.split(/\r?\n/u).filter(Boolean).sort() : [];
}

function dockerLines(args) {
  return outputLines(runCommand(dockerExecutable, args, { echo: false }));
}

function resourceCount(snapshot) {
  return (
    snapshot.containers.length +
    snapshot.networks.length +
    snapshot.volumes.length +
    snapshot.images.length
  );
}

function imageExists(reference) {
  return runResult(dockerExecutable, ["image", "inspect", reference], { echo: false }).status === 0;
}

function containerExists(name) {
  return runResult(dockerExecutable, ["container", "inspect", name], { echo: false }).status === 0;
}

function imageId(reference) {
  return runCommand(dockerExecutable, ["image", "inspect", "--format", "{{.Id}}", reference], {
    echo: false,
  });
}

function snapshotImageIds() {
  return new Set(dockerLines(["image", "ls", "-aq", "--no-trunc"]));
}

function normalizeImageReference(reference) {
  const lastSlash = reference.lastIndexOf("/");
  const lastColon = reference.lastIndexOf(":");
  return lastColon > lastSlash ? reference : `${reference}:latest`;
}

function composeArguments(project) {
  return ["compose", "-p", project, "-f", composeFile];
}

function runCompose(state, args, options = {}) {
  return runCommand(dockerExecutable, [...composeArguments(state.project), ...args], {
    ...options,
    env: state.environment,
  });
}

function commandText(executable, args) {
  return [executable, ...args].map((part) => JSON.stringify(part)).join(" ");
}

function snapshotProject(state) {
  const label = `label=com.docker.compose.project=${state.project}`;
  const images = state.imageReferences.flatMap((reference) =>
    imageExists(reference) ? [`${imageId(reference)}|${reference}`] : [],
  );

  return {
    containers: dockerLines([
      "ps",
      "-a",
      "--filter",
      label,
      "--format",
      '{{.ID}}|{{.Names}}|{{.Label "com.docker.compose.project"}}',
    ]),
    networks: dockerLines([
      "network",
      "ls",
      "--filter",
      label,
      "--format",
      '{{.ID}}|{{.Name}}|{{.Label "com.docker.compose.project"}}',
    ]),
    volumes: dockerLines([
      "volume",
      "ls",
      "--filter",
      label,
      "--format",
      '{{.Name}}|{{.Label "com.docker.compose.project"}}',
    ]),
    images: images.sort(),
  };
}

function configuredProjectImages(state) {
  const configured = outputLines(runCompose(state, ["config", "--images"], { echo: false }));
  const projectImages = configured
    .filter((reference) => reference !== "postgres:15")
    .map(normalizeImageReference);

  if (
    projectImages.length !== 2 ||
    projectImages.some((reference) => !reference.includes(state.project))
  ) {
    throw new Error(
      `Unexpected Compose image references for ${state.project}: ${JSON.stringify(configured)}`,
    );
  }
  return projectImages;
}

function assertProjectAbsent(state) {
  state.imageReferences = configuredProjectImages(state);
  const labeled = snapshotProject(state);
  const namedContainers = dockerLines([
    "ps",
    "-a",
    "--filter",
    `name=${state.project}`,
    "--format",
    "{{.ID}}|{{.Names}}",
  ]);
  const networkExists =
    runResult(dockerExecutable, ["network", "inspect", `${state.project}_default`], {
      echo: false,
    }).status === 0;
  const volumeExists =
    runResult(dockerExecutable, ["volume", "inspect", `${state.project}_postgres_data`], {
      echo: false,
    }).status === 0;

  if (
    resourceCount(labeled) !== 0 ||
    namedContainers.length !== 0 ||
    networkExists ||
    volumeExists ||
    state.imageReferences.some(imageExists)
  ) {
    throw new Error(`Generated project unexpectedly exists; refusing cleanup: ${state.project}`);
  }
  state.owned = true;
}

async function allocatePort(allocated) {
  for (;;) {
    const port = await new Promise((resolvePort, reject) => {
      const server = createServer();
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => {
        const address = server.address();
        if (!address || typeof address === "string") {
          server.close();
          reject(new Error("Could not allocate a TCP port."));
          return;
        }
        server.close((error) => (error ? reject(error) : resolvePort(address.port)));
      });
    });
    if (!allocated.has(port)) {
      allocated.add(port);
      return port;
    }
  }
}

async function createProjectState(purpose, allocated, smoke = false) {
  const prefix = smoke
    ? "employee-phase1-compose-smoke"
    : `employee-phase1-compose-test-${purpose}`;
  const project = `${prefix}-${process.pid}-${randomBytes(6).toString("hex")}`;
  const pattern = smoke ? smokeProjectPattern : projectPattern;
  if (!pattern.test(project))
    throw new Error(`Generated Compose project name is unsafe: ${project}`);

  const apiPort = await allocatePort(allocated);
  const frontendPort = await allocatePort(allocated);
  const apiUrl = `http://127.0.0.1:${apiPort}`;
  const frontendUrl = `http://127.0.0.1:${frontendPort}`;
  return {
    project,
    purpose,
    apiPort,
    frontendPort,
    apiUrl,
    frontendUrl,
    imageReferences: [],
    owned: false,
    created: emptySnapshot(),
    final: emptySnapshot(),
    environment: {
      ...process.env,
      API_PORT: String(apiPort),
      FRONTEND_PORT: String(frontendPort),
      VITE_API_BASE_URL: apiUrl,
      CORS_ORIGIN: frontendUrl,
      POSTGRES_USER: "postgres",
      POSTGRES_PASSWORD: "postgres",
      POSTGRES_DB: "employees",
    },
  };
}

function assertCreatedProject(state, expectedContainers) {
  const snapshot = snapshotProject(state);
  if (
    snapshot.containers.length !== expectedContainers ||
    snapshot.networks.length !== 1 ||
    snapshot.volumes.length !== 1 ||
    snapshot.images.length !== 2
  ) {
    throw new Error(`Unexpected resources for ${state.project}: ${JSON.stringify(snapshot)}`);
  }
  for (const resource of [...snapshot.containers, ...snapshot.networks, ...snapshot.volumes]) {
    if (!resource.endsWith(`|${state.project}`)) {
      throw new Error(`Resource has the wrong Compose label: ${resource}`);
    }
  }
  state.created = snapshot;
}

async function fetchResponse(url, options = {}) {
  return fetch(url, { ...options, signal: AbortSignal.timeout(5_000) });
}

async function verifyValidProject(state, forbiddenApiUrl) {
  const health = await fetchResponse(`${state.apiUrl}/health/live`, {
    headers: { Origin: state.frontendUrl },
  });
  if (!health.ok) throw new Error(`API liveness failed for ${state.project}: ${health.status}`);
  if (health.headers.get("access-control-allow-origin") !== state.frontendUrl) {
    throw new Error(`API CORS origin is incorrect for ${state.project}.`);
  }

  const frontend = await fetchResponse(state.frontendUrl);
  if (!frontend.ok)
    throw new Error(`Frontend liveness failed for ${state.project}: ${frontend.status}`);
  const html = await frontend.text();
  const scriptSources = [...html.matchAll(/<script[^>]+src="([^"]+)"/gu)].map((match) => match[1]);
  if (scriptSources.length === 0)
    throw new Error(`No compiled frontend script found for ${state.project}.`);
  const bundles = await Promise.all(
    scriptSources.map(async (source) =>
      (await fetchResponse(new URL(source, state.frontendUrl))).text(),
    ),
  );
  if (!bundles.some((bundle) => bundle.includes(state.apiUrl))) {
    throw new Error(`Frontend did not embed ${state.apiUrl} for ${state.project}.`);
  }
  if (forbiddenApiUrl && bundles.some((bundle) => bundle.includes(forbiddenApiUrl))) {
    throw new Error(`Frontend for ${state.project} embedded another project's API URL.`);
  }
}

function assertDisjoint(first, second) {
  for (const key of ["containers", "networks", "volumes", "images"]) {
    const overlap = first.created[key].filter((entry) => second.created[key].includes(entry));
    if (overlap.length !== 0) {
      throw new Error(`Compose projects share ${key}: ${JSON.stringify(overlap)}`);
    }
  }
}

function verifyDirectImage(direct, preExistingImageIds) {
  runCommand(dockerExecutable, [
    "build",
    "--file",
    resolve(repositoryRoot, "backend", "dockerfile"),
    "--tag",
    direct.tag,
    resolve(repositoryRoot, "backend"),
  ]);
  direct.imageId = imageId(direct.tag);
  direct.imageIdExistedBefore = preExistingImageIds.has(direct.imageId);
  const user = runCommand(
    dockerExecutable,
    ["image", "inspect", "--format", "{{.Config.User}}", direct.tag],
    { echo: false },
  );
  if (user !== "node")
    throw new Error(`Backend runtime image is not configured for user node: ${user}`);

  runCommand(dockerExecutable, [
    "create",
    "--name",
    direct.container,
    direct.tag,
    "sh",
    "-c",
    'test -f dist/database/seed.js && test -f dist/server.js && test "$(id -u)" -ne 0',
  ]);
  direct.containerOwned = true;
  runCommand(dockerExecutable, ["start", "--attach", direct.container]);
}

function startValidProject(state) {
  runCompose(state, ["up", "-d", "--build", "--wait"]);
  assertCreatedProject(state, 3);
}

async function waitForContainerExit(containerId) {
  const deadline = Date.now() + 60_000;
  for (;;) {
    const state = runCommand(
      dockerExecutable,
      ["container", "inspect", "--format", "{{.State.Status}}|{{.State.ExitCode}}", containerId],
      { echo: false },
    );
    if (state.startsWith("exited|")) return state;
    if (Date.now() >= deadline) throw new Error(`Container did not exit in time: ${containerId}`);
    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  }
}

async function verifyInvalidStartup(state) {
  runCompose(state, ["build", "api", "frontend"]);
  runCompose(state, ["up", "-d", "--wait", "db"]);

  state.migrationContainer = `${state.project}-migration-check`;
  if (containerExists(state.migrationContainer)) {
    throw new Error(
      `Generated migration container unexpectedly exists: ${state.migrationContainer}`,
    );
  }
  runCompose(state, [
    "run",
    "--name",
    state.migrationContainer,
    "--no-deps",
    "api",
    "node_modules/.bin/prisma",
    "migrate",
    "deploy",
  ]);

  const constraint = "employee_phase1_seed_block_test";
  const sql = `ALTER TABLE "Employee" ADD CONSTRAINT "${constraint}" CHECK ("email" <> 'joao.silva@example.com');\n`;
  runCompose(
    state,
    ["exec", "-T", "db", "psql", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "employees"],
    {
      input: sql,
    },
  );

  runCompose(state, ["up", "-d", "--no-deps", "api"]);
  const apiContainers = outputLines(runCompose(state, ["ps", "-a", "-q", "api"], { echo: false }));
  const regularApiContainers = apiContainers.filter((containerId) => {
    const name = runCommand(
      dockerExecutable,
      ["container", "inspect", "--format", "{{.Name}}", containerId],
      { echo: false },
    ).replace(/^\//u, "");
    return name !== state.migrationContainer;
  });
  if (regularApiContainers.length !== 1) {
    throw new Error(
      `Expected one normal invalid-startup API container: ${JSON.stringify(apiContainers)}`,
    );
  }
  const [apiContainer] = regularApiContainers;
  const exitState = await waitForContainerExit(apiContainer);
  const exitCode = Number(exitState.split("|")[1]);
  if (!Number.isInteger(exitCode) || exitCode === 0) {
    throw new Error(`Invalid-startup API did not fail: ${exitState}`);
  }

  const logs = runCompose(state, ["logs", "--no-color", "api"], { echo: false });
  if (!/No pending migrations to apply|database schema is up to date/iu.test(logs)) {
    throw new Error(`Invalid-startup API did not report an already-current migration: ${logs}`);
  }
  if (!logs.includes("Employee seed failed.")) {
    throw new Error(`Invalid-startup API did not report compiled seed failure: ${logs}`);
  }
  if (logs.includes("Server listening on port")) {
    throw new Error(`Server started after seed failure in ${state.project}.`);
  }

  const rowCount = runCompose(
    state,
    [
      "exec",
      "-T",
      "db",
      "psql",
      "-At",
      "-v",
      "ON_ERROR_STOP=1",
      "-U",
      "postgres",
      "-d",
      "employees",
      "-c",
      'SELECT count(*) FROM "Employee";',
    ],
    { echo: false },
  );
  if (rowCount !== "0") throw new Error(`Failed seed left employee rows behind: ${rowCount}`);

  let apiListening = false;
  try {
    const response = await fetchResponse(`${state.apiUrl}/health/live`);
    apiListening = response.ok;
  } catch {
    apiListening = false;
  }
  if (apiListening) throw new Error(`Invalid-startup API became reachable: ${state.apiUrl}`);

  assertCreatedProject(state, 3);
  return true;
}

function cleanupDirect(direct, cleanupCommands) {
  if (direct.containerOwned && containerExists(direct.container)) {
    const args = ["container", "rm", "--force", direct.container];
    runCommand(dockerExecutable, args);
    cleanupCommands.push(commandText(dockerExecutable, args));
  }
  if (direct.owned && imageExists(direct.tag)) {
    const args = ["image", "rm", direct.tag];
    runCommand(dockerExecutable, args);
    cleanupCommands.push(commandText(dockerExecutable, args));
  }
}

function cleanupProject(state, cleanupCommands) {
  if (!state.owned) return;
  if (state.migrationContainer && containerExists(state.migrationContainer)) {
    const args = ["container", "rm", "--force", state.migrationContainer];
    runCommand(dockerExecutable, args);
    cleanupCommands.push(commandText(dockerExecutable, args));
  }
  const downArgs = [...composeArguments(state.project), "down", "--volumes", "--remove-orphans"];
  runCommand(dockerExecutable, downArgs, { env: state.environment });
  cleanupCommands.push(commandText(dockerExecutable, downArgs));

  for (const reference of [...state.imageReferences].reverse()) {
    if (imageExists(reference)) {
      const args = ["image", "rm", reference];
      runCommand(dockerExecutable, args);
      cleanupCommands.push(commandText(dockerExecutable, args));
    }
  }
  state.final = snapshotProject(state);
  if (resourceCount(state.final) !== 0) {
    throw new Error(
      `Resources remain after cleanup for ${state.project}: ${JSON.stringify(state.final)}`,
    );
  }
}

function assertPreExistingImagesRemain(before) {
  const after = snapshotImageIds();
  const missing = [...before].filter((id) => !after.has(id));
  if (missing.length !== 0) {
    throw new Error(`Pre-existing image IDs were removed: ${JSON.stringify(missing)}`);
  }
}

async function runNormalVerification() {
  const allocatedPorts = new Set();
  const projects = [
    await createProjectState("isolation-a", allocatedPorts),
    await createProjectState("isolation-b", allocatedPorts),
    await createProjectState("invalid-startup", allocatedPorts),
  ];
  const direct = {
    tag: `employee-phase1-backend-check-${process.pid}-${randomBytes(6).toString("hex")}`,
    container: "",
    owned: false,
    containerOwned: false,
    imageId: "",
    imageIdExistedBefore: false,
  };
  if (!directTagPattern.test(direct.tag))
    throw new Error(`Generated image tag is unsafe: ${direct.tag}`);
  direct.container = `${direct.tag}-verify`;

  if (imageExists(direct.tag) || containerExists(direct.container)) {
    throw new Error(`Generated direct verification resource unexpectedly exists: ${direct.tag}`);
  }
  direct.owned = true;
  for (const project of projects) assertProjectAbsent(project);
  const preExistingImageIds = snapshotImageIds();
  const cleanupCommands = [];
  let invalidStartupStoppedBeforeApi = false;
  let primaryError;
  const cleanupErrors = [];

  try {
    process.stdout.write(`[task9-resource] direct image ${direct.tag}\n`);
    process.stdout.write(`[task9-resource] direct container ${direct.container}\n`);
    for (const project of projects) {
      process.stdout.write(`[task9-resource] compose project ${project.project}\n`);
    }

    verifyDirectImage(direct, preExistingImageIds);
    startValidProject(projects[0]);
    startValidProject(projects[1]);
    await verifyValidProject(projects[0], projects[1].apiUrl);
    await verifyValidProject(projects[1], projects[0].apiUrl);
    assertDisjoint(projects[0], projects[1]);
    invalidStartupStoppedBeforeApi = await verifyInvalidStartup(projects[2]);
  } catch (error) {
    primaryError = error;
  } finally {
    for (const project of [...projects].reverse()) {
      try {
        cleanupProject(project, cleanupCommands);
      } catch (error) {
        cleanupErrors.push(
          new Error(`Cleanup failed for Compose project ${project.project}.`, { cause: error }),
        );
      }

      try {
        project.final = snapshotProject(project);
      } catch (error) {
        project.final = null;
        cleanupErrors.push(
          new Error(`Final-state inspection failed for Compose project ${project.project}.`, {
            cause: error,
          }),
        );
      }
    }

    try {
      cleanupDirect(direct, cleanupCommands);
    } catch (error) {
      cleanupErrors.push(
        new Error(`Cleanup failed for direct resource ${direct.tag}.`, { cause: error }),
      );
    }

    try {
      assertPreExistingImagesRemain(preExistingImageIds);
    } catch (error) {
      cleanupErrors.push(
        new Error("Post-cleanup image-preservation check failed.", { cause: error }),
      );
    }
  }

  let directContainerAbsent = null;
  let directTagAbsent = null;
  let directImageIdAbsent = null;
  try {
    directContainerAbsent = !containerExists(direct.container);
    directTagAbsent = !imageExists(direct.tag);
    directImageIdAbsent = direct.imageId ? !imageExists(direct.imageId) : null;
  } catch (error) {
    cleanupErrors.push(
      new Error(`Final-state inspection failed for direct resource ${direct.tag}.`, {
        cause: error,
      }),
    );
  }

  if (directContainerAbsent === false) {
    cleanupErrors.push(new Error(`Direct verification container remains: ${direct.container}`));
  }
  if (directTagAbsent === false) {
    cleanupErrors.push(new Error(`Direct image tag remains: ${direct.tag}`));
  }
  if (direct.imageIdExistedBefore && directImageIdAbsent === true) {
    cleanupErrors.push(new Error(`Pre-existing direct image ID was removed: ${direct.imageId}`));
  }
  if (direct.imageId && !direct.imageIdExistedBefore && directImageIdAbsent === false) {
    cleanupErrors.push(new Error(`New direct image ID remains: ${direct.imageId}`));
  }

  const report = {
    directImage: {
      tag: direct.tag,
      tagExistedBefore: false,
      imageId: direct.imageId,
      imageIdExistedBefore: direct.imageIdExistedBefore,
      container: direct.container,
      containerAbsentAfter: directContainerAbsent,
      removedExactTagAfter: directTagAbsent,
      imageIdAbsentAfter: directImageIdAbsent,
    },
    projects: projects.map(({ project, purpose, apiPort, frontendPort, created, final }) => ({
      project,
      purpose,
      apiPort,
      frontendPort,
      created,
      final,
    })),
    invalidStartupStoppedBeforeApi,
    cleanupCommands,
    cleanupErrors: cleanupErrors.map((error) => ({
      message: error.message,
      cause: error.cause instanceof Error ? error.cause.message : String(error.cause ?? ""),
    })),
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

  if (primaryError) throw primaryError;
  if (cleanupErrors.length !== 0) {
    throw new AggregateError(cleanupErrors, "Task 9 cleanup failed.");
  }
}

async function waitForSmokeRelease() {
  process.stdout.write("Smoke project is ready. Press Enter to clean it up.\n");
  await new Promise((resolveRelease) => {
    process.stdin.once("data", resolveRelease);
    process.once("SIGINT", resolveRelease);
    process.once("SIGTERM", resolveRelease);
  });
}

async function runHoldSmoke() {
  const allocatedPorts = new Set();
  const state = await createProjectState("smoke", allocatedPorts, true);
  assertProjectAbsent(state);
  const preExistingImageIds = snapshotImageIds();
  const cleanupCommands = [];
  let primaryError;
  let cleanupError;

  try {
    process.stdout.write(`[task9-resource] smoke project ${state.project}\n`);
    startValidProject(state);
    await verifyValidProject(state);
    process.stdout.write(
      `${JSON.stringify(
        {
          mode: "hold-smoke-ready",
          project: state.project,
          frontendUrl: state.frontendUrl,
          apiUrl: state.apiUrl,
          created: state.created,
        },
        null,
        2,
      )}\n`,
    );
    await waitForSmokeRelease();
  } catch (error) {
    primaryError = error;
  } finally {
    try {
      cleanupProject(state, cleanupCommands);
      assertPreExistingImagesRemain(preExistingImageIds);
    } catch (error) {
      cleanupError = error;
    }
  }

  const evidence = {
    project: state.project,
    frontendUrl: state.frontendUrl,
    apiUrl: state.apiUrl,
    created: state.created,
    final: state.final,
  };
  process.stdout.write(`${JSON.stringify({ evidence, cleanupCommands }, null, 2)}\n`);
  if (cleanupError) throw cleanupError;
  if (primaryError) throw primaryError;
}

const mode = process.argv[2];
if (mode !== undefined && mode !== "--hold-smoke") {
  throw new Error("Usage: node scripts/verify-compose-isolation.mjs [--hold-smoke]");
}

if (mode === "--hold-smoke") {
  await runHoldSmoke();
} else {
  await runNormalVerification();
}
