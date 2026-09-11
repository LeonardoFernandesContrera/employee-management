import { join } from "node:path";
import { tmpdir } from "node:os";

import { encodePostgresLiteral } from "./legacyDatabase";
import {
  assertTemporaryWorkspaceSafe,
  parseTestDatabaseEnvironment,
  quoteIdentifier,
} from "./testDatabase";

const composeProject = "employee-phase1-test-1234-abcdef012345";
const adminUrl = "postgresql://postgres:postgres@127.0.0.1:5432/postgres";

const validEnvironment = {
  NODE_ENV: "test",
  ALLOW_DATABASE_MUTATION: "true",
  TEST_COMPOSE_PROJECT: composeProject,
  TEST_DATABASE_ADMIN_URL: adminUrl,
} as NodeJS.ProcessEnv;

describe("test database safety", () => {
  test.each([
    [{ ...validEnvironment, NODE_ENV: "production" }, "NODE_ENV"],
    [{ ...validEnvironment, ALLOW_DATABASE_MUTATION: "false" }, "ALLOW_DATABASE_MUTATION"],
    [
      { ...validEnvironment, TEST_COMPOSE_PROJECT: "employee-phase1-test-shared" },
      "Compose project",
    ],
    [
      { ...validEnvironment, TEST_DATABASE_ADMIN_URL: "postgresql://prod.example.com/postgres" },
      "loopback",
    ],
    [
      { ...validEnvironment, TEST_DATABASE_ADMIN_URL: "postgresql://127.0.0.1/employees" },
      "/postgres",
    ],
  ])("refuses unsafe mutation configuration", (source, message) => {
    expect(() => parseTestDatabaseEnvironment(source)).toThrow(message);
  });

  test("accepts only a guarded migration-runner environment", () => {
    expect(parseTestDatabaseEnvironment(validEnvironment)).toEqual({
      adminUrl,
      composeProject,
      mutationAllowed: true,
    });
  });

  test.each([
    "postgresql://postgres:postgres@localhost:5432/postgres",
    "postgresql://postgres:postgres@[::1]:5432/postgres",
  ])("accepts the loopback PostgreSQL admin URL %s", (loopbackUrl) => {
    expect(
      parseTestDatabaseEnvironment({
        ...validEnvironment,
        TEST_DATABASE_ADMIN_URL: loopbackUrl,
      }).adminUrl,
    ).toBe(loopbackUrl);
  });

  test("quotes only generated test database identifiers", () => {
    expect(quoteIdentifier("employee_phase1_test_seed_a1")).toBe('"employee_phase1_test_seed_a1"');
    expect(() => quoteIdentifier("employees")).toThrow("test-only prefix");
    expect(() => quoteIdentifier('employee_phase1_test_safe";DROP DATABASE postgres;--')).toThrow(
      "test-only prefix",
    );
  });

  test("accepts only absolute task-owned temporary workspace roots", () => {
    const initialWorkspace = join(tmpdir(), "employee-phase1-prisma-initial-a1");
    const failureWorkspace = join(tmpdir(), "employee-phase1-prisma-failure-b2");

    expect(assertTemporaryWorkspaceSafe(initialWorkspace)).toBe(initialWorkspace);
    expect(assertTemporaryWorkspaceSafe(failureWorkspace)).toBe(failureWorkspace);
    expect(() => assertTemporaryWorkspaceSafe("relative-workspace")).toThrow("temporary workspace");
    expect(() => assertTemporaryWorkspaceSafe(join(tmpdir(), "employee-phase1-other-a1"))).toThrow(
      "temporary workspace",
    );
  });

  test("encodes PostgreSQL fixture literals for nulls, quotes, and backslashes", () => {
    expect(encodePostgresLiteral(null)).toBe("NULL");
    expect(encodePostgresLiteral("O'Brien")).toBe("E'O''Brien'");
    expect(encodePostgresLiteral("C:\\fixtures\\employees.xlsx")).toBe(
      "E'C:\\\\fixtures\\\\employees.xlsx'",
    );
  });
});
