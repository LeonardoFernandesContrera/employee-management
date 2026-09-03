import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const backendRoot = fileURLToPath(new URL("../", import.meta.url));
const sourceRoot = resolve(backendRoot, "src");
const projectNames = ["unit", "integration", "migration"];

if (!process.env.npm_execpath) {
  throw new Error("npm_execpath is required; run discovery through npm run test:discovery");
}

const npxCliPath = resolve(dirname(process.env.npm_execpath), "npx-cli.js");

const normalizePath = (value) => resolve(value.trim()).replaceAll("\\", "/").toLowerCase();

function enumerateSourceTests(directory) {
  const tests = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      tests.push(...enumerateSourceTests(entryPath));
    } else if (
      entry.name.endsWith(".unit.test.ts") ||
      entry.name.endsWith(".integration.test.ts")
    ) {
      tests.push(normalizePath(entryPath));
    }
  }

  return tests.sort();
}

function listProjectTests(projectName) {
  const result = spawnSync(
    process.execPath,
    [npxCliPath, "--no-install", "jest", "--selectProjects", projectName, "--listTests"],
    {
      cwd: backendRoot,
      encoding: "utf8",
      env: { ...process.env, FORCE_COLOR: "0" },
      shell: false,
    },
  );

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(
      `Jest discovery failed for ${projectName} (exit ${result.status}).\n${result.stderr}`,
    );
  }

  const outputLines = result.stdout
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
  const unexpectedOutput = outputLines.filter(
    (line) =>
      !line.endsWith(".unit.test.ts") &&
      !line.endsWith(".integration.test.ts") &&
      !line.startsWith("Running one project:"),
  );
  if (unexpectedOutput.length) {
    throw new Error(`Unexpected Jest --listTests output: ${JSON.stringify(unexpectedOutput)}`);
  }

  return outputLines
    .filter((line) => line.endsWith(".unit.test.ts") || line.endsWith(".integration.test.ts"))
    .map(normalizePath)
    .sort();
}

function expectedProject(testPath) {
  if (testPath.endsWith(".unit.test.ts")) return "unit";
  if (testPath.includes("/src/test/migration/")) return "migration";
  return "integration";
}

const filesystemTests = enumerateSourceTests(sourceRoot);
const discovered = Object.fromEntries(projectNames.map((name) => [name, listProjectTests(name)]));
const owners = new Map(filesystemTests.map((testPath) => [testPath, []]));
const unexpected = [];

for (const projectName of projectNames) {
  for (const testPath of discovered[projectName]) {
    if (!owners.has(testPath)) {
      unexpected.push(testPath);
      continue;
    }
    owners.get(testPath).push(projectName);
  }
}

const duplicates = [...owners.entries()]
  .filter(([, projectOwners]) => projectOwners.length > 1)
  .map(([testPath]) => testPath)
  .sort();
const missing = [...owners.entries()]
  .filter(([, projectOwners]) => projectOwners.length === 0)
  .map(([testPath]) => testPath)
  .sort();
const wrongOwners = [...owners.entries()]
  .filter(
    ([testPath, projectOwners]) =>
      projectOwners.length === 1 && projectOwners[0] !== expectedProject(testPath),
  )
  .map(([testPath, projectOwners]) => ({
    testPath,
    expected: expectedProject(testPath),
    actual: projectOwners[0],
  }));

const report = {
  unit: discovered.unit,
  integration: discovered.integration,
  migration: discovered.migration,
  duplicates,
  missing,
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

if (duplicates.length || missing.length || unexpected.length || wrongOwners.length) {
  throw new Error(
    `Jest ownership is not exclusive and exhaustive: ${JSON.stringify({ unexpected, wrongOwners })}`,
  );
}
