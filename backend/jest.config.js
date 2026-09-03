const { createDefaultPreset } = require("ts-jest");

const tsJestTransform = createDefaultPreset().transform;

const project = (displayName, testMatch, testPathIgnorePatterns = []) => ({
  displayName,
  testEnvironment: "node",
  rootDir: ".",
  testMatch,
  testPathIgnorePatterns,
  modulePathIgnorePatterns: ["<rootDir>/dist/", "<rootDir>/node_modules/"],
  transform: tsJestTransform,
  globals: { "ts-jest": { tsconfig: "<rootDir>/tsconfig.test.json" } },
});

/** @type {import("jest").Config} **/
module.exports = {
  projects: [
    project("unit", ["<rootDir>/src/**/*.unit.test.ts"]),
    project(
      "integration",
      ["<rootDir>/src/**/*.integration.test.ts"],
      ["<rootDir>/src/test/migration/"],
    ),
    project("migration", ["<rootDir>/src/test/migration/**/*.integration.test.ts"]),
  ],
};
