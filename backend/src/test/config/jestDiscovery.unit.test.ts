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
