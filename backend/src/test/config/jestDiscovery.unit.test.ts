import { readFileSync } from "node:fs";
import { resolve } from "node:path";

interface PackageManifest {
  scripts: Record<string, string>;
}

function readPackage(relativePath: string): PackageManifest {
  return JSON.parse(readFileSync(resolve(__dirname, relativePath), "utf8")) as PackageManifest;
}

test("assigns every source test to exactly one Jest project", () => {
  const config = jest.requireActual("../../../jest.config.js");
  const byName = Object.fromEntries(
    config.projects.map((project: { displayName: string }) => [project.displayName, project]),
  );

  expect(Object.keys(byName).sort()).toEqual(["integration", "migration", "unit"]);
  expect(byName.unit.testMatch).toEqual(["<rootDir>/src/**/*.unit.test.ts"]);
  expect(byName.integration.testMatch).toEqual(["<rootDir>/src/**/*.integration.test.ts"]);
  expect(byName.integration.testPathIgnorePatterns).toContain("<rootDir>/src/test/migration/");
  expect(byName.migration.testMatch).toEqual([
    "<rootDir>/src/test/migration/**/*.integration.test.ts",
  ]);
  for (const project of Object.values(byName) as Array<{ modulePathIgnorePatterns: string[] }>) {
    expect(project.modulePathIgnorePatterns).toContain("<rootDir>/dist/");
  }
});

test("defines the deterministic format check for both packages", () => {
  const backendPackage = readPackage("../../../package.json");
  const frontendPackage = readPackage("../../../../frontend/package.json");

  expect(backendPackage.scripts["format:check"]).toBe(
    "prettier --check . --config ../prettier.config.cjs --ignore-path ../.prettierignore",
  );

  expect(frontendPackage.scripts["format:check"]).toBe(
    "prettier --check . --config ../prettier.config.cjs --ignore-path ../.prettierignore",
  );
});
