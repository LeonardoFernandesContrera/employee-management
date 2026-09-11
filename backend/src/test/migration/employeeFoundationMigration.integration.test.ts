import {
  CANONICAL_EMAIL_BY_SEED_KEY,
  INCOMPATIBLE_LEGACY_FIXTURES,
  LEGACY_TEN,
  LEGACY_TEN_WITH_REORDERED_DUPLICATES,
  canonicalEmailBySeedKey,
  type LegacyEmployeeFixture,
} from "../fixtures/legacyEmployees";
import {
  applyRepositoryMigrations,
  correctRetryFixture,
  createInjectedFailureWorkspace,
  markPhase1MigrationRolledBack,
  readMigrationLedger,
  snapshotCanonicalEmployeeState,
  snapshotLegacyEmployeeState,
  withLegacyDatabase,
} from "../support/legacyDatabase";

jest.setTimeout(30_000);

const migrationName = "20260829000100_employee_phase_1_foundation";

const customFixtures: readonly LegacyEmployeeFixture[] = [
  {
    uuid: "40000000-0000-4000-8000-000000000001",
    name: "  Custom Person  ",
    address: "  Custom Street  ",
    neighborhood: null,
    zipcode: " ",
    phone: null,
    salary: "1234.50",
    contractDate: "2024-02-29 23:59:59.999",
    role: "  Architect  ",
    status: " on_leave ",
  },
  {
    ...LEGACY_TEN[0],
    uuid: "40000000-0000-4000-8000-000000000002",
    name: "Edited João Silva",
  },
  {
    ...LEGACY_TEN[1],
    uuid: "40000000-0000-4000-8000-000000000003",
    phone: "different",
  },
  {
    ...LEGACY_TEN[2],
    uuid: "40000000-0000-4000-8000-000000000004",
    address: "   ",
    neighborhood: " ",
    zipcode: null,
    phone: "",
  },
];

describe("Phase 1 foundation migration", () => {
  test.each([
    ["original canonical rows", LEGACY_TEN],
    ["reordered exact duplicates", LEGACY_TEN_WITH_REORDERED_DUPLICATES],
    ["custom, edited, partial and nullable rows", customFixtures],
  ] as const)("preserves every identifier and compatible row for %s", async (_name, fixtures) => {
    await withLegacyDatabase("preserve", fixtures, async (database) => {
      const before = await snapshotLegacyEmployeeState(database);
      await applyRepositoryMigrations(database);
      const after = await snapshotCanonicalEmployeeState(database);

      expect(after.orderedRows).toHaveLength(before.orderedRows.length);
      expect(after.orderedRows.map(({ id }) => id).sort()).toEqual(
        before.orderedRows.map(({ uuid }) => uuid).sort(),
      );
      expect(after.orderedRows.every(({ salary }) => /^\d+\.\d{2}$/u.test(salary))).toBe(true);
      expect(after.orderedRows.every(({ hireDate }) => /^\d{4}-\d{2}-\d{2}$/u.test(hireDate))).toBe(
        true,
      );

      if (fixtures === LEGACY_TEN || fixtures === LEGACY_TEN_WITH_REORDERED_DUPLICATES) {
        expect(canonicalEmailBySeedKey(after)).toEqual(CANONICAL_EMAIL_BY_SEED_KEY);
      }
      if (fixtures === LEGACY_TEN_WITH_REORDERED_DUPLICATES) {
        expect(after.orderedRows.filter(({ email }) => email.startsWith("legacy+"))).toHaveLength(
          10,
        );
      }
      if (fixtures === customFixtures) {
        expect(after.orderedRows).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: customFixtures[0].uuid,
              email: `legacy+${customFixtures[0].uuid}@example.com`,
              fullName: "Custom Person",
              jobTitle: "Architect",
              status: "ON_LEAVE",
              hireDate: "2024-02-29",
              address: "Custom Street",
              neighborhood: null,
              postalCode: null,
            }),
            expect.objectContaining({
              id: customFixtures[3].uuid,
              address: null,
              neighborhood: null,
              postalCode: null,
              phone: null,
            }),
          ]),
        );
      }
    });
  });

  test("creates the exact canonical catalog without losing the legacy created_at default", async () => {
    await withLegacyDatabase("catalog", LEGACY_TEN, async (database) => {
      const before = await snapshotLegacyEmployeeState(database);
      const beforeColumns = Object.fromEntries(
        before.applicationCatalog.columns.map((column) => [column.name, column]),
      );
      expect(beforeColumns.status.defaultExpression).toBeNull();
      expect(beforeColumns.salary.defaultExpression).toBeNull();
      expect(beforeColumns.contract_date.defaultExpression).toBeNull();
      expect(beforeColumns.created_at.defaultExpression).toMatch(/CURRENT_TIMESTAMP|now\(\)/iu);

      await applyRepositoryMigrations(database);
      const after = await snapshotCanonicalEmployeeState(database);
      const columns = Object.fromEntries(
        after.applicationCatalog.columns.map((column) => [column.name, column]),
      );
      expect(columns.uuid).toMatchObject({ dataType: "text", nullable: false });
      expect(columns.email).toMatchObject({ dataType: "text", nullable: false });
      expect(columns.status).toMatchObject({ dataType: "USER-DEFINED", udtName: "EmployeeStatus" });
      expect(columns.salary).toMatchObject({ dataType: "numeric", nullable: false });
      expect(columns.contract_date).toMatchObject({ dataType: "date", nullable: false });
      expect(columns.address.nullable).toBe(true);
      expect(columns.status.defaultExpression).toBeNull();
      expect(columns.salary.defaultExpression).toBeNull();
      expect(columns.contract_date.defaultExpression).toBeNull();
      expect(columns.created_at.defaultExpression).toMatch(/CURRENT_TIMESTAMP|now\(\)/iu);
      expect(after.applicationCatalog.enumLabels).toEqual(["ACTIVE", "ON_LEAVE", "INACTIVE"]);
      expect(after.applicationCatalog.constraints.map(({ name }) => name)).toEqual(
        expect.arrayContaining([
          "Employee_pkey",
          "Employee_email_normalized_check",
          "Employee_salary_positive_check",
        ]),
      );
      expect(after.applicationCatalog.indexes.map(({ name }) => name)).toEqual(
        expect.arrayContaining(["Employee_email_key", "Employee_status_idx"]),
      );
    });
  });

  test.each(INCOMPATIBLE_LEGACY_FIXTURES)(
    "rolls back logical application state for $name",
    async ({ rows }) => {
      await withLegacyDatabase("rollback", rows, async (database) => {
        const before = await snapshotLegacyEmployeeState(database);
        await expect(applyRepositoryMigrations(database)).rejects.toThrow();
        const after = await snapshotLegacyEmployeeState(database);

        expect(after.applicationCatalog).toEqual(before.applicationCatalog);
        expect(after.orderedRows).toEqual(before.orderedRows);
        expect(await readMigrationLedger(database)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ migrationName, finishedAt: null, rolledBackAt: null }),
          ]),
        );
      });
    },
  );

  test("rolls back after a test-only exception immediately before commit", async () => {
    await withLegacyDatabase("injected", LEGACY_TEN, async (database) => {
      const before = await snapshotLegacyEmployeeState(database);
      const workspace = await createInjectedFailureWorkspace();
      try {
        const failed = await database.runPrisma(["migrate", "deploy"], workspace.schemaPath);
        expect(failed.exitCode).not.toBe(0);
        const after = await snapshotLegacyEmployeeState(database);
        expect(after.applicationCatalog).toEqual(before.applicationCatalog);
        expect(after.orderedRows).toEqual(before.orderedRows);
        expect(await readMigrationLedger(database)).toEqual(
          expect.arrayContaining([expect.objectContaining({ migrationName, finishedAt: null })]),
        );
      } finally {
        await workspace.dispose();
      }
    });
  });

  test("retains failed-and-resolved history before a corrected retry succeeds", async () => {
    const invalid = INCOMPATIBLE_LEGACY_FIXTURES[0].rows;
    await withLegacyDatabase("retry", invalid, async (database) => {
      await expect(applyRepositoryMigrations(database)).rejects.toThrow();

      const beforeResolve = (await readMigrationLedger(database)).filter(
        (entry) => entry.migrationName === migrationName,
      );
      expect(beforeResolve).toHaveLength(1);
      expect(beforeResolve[0]).toEqual(
        expect.objectContaining({ finishedAt: null, rolledBackAt: null }),
      );

      expect((await markPhase1MigrationRolledBack(database)).exitCode).toBe(0);
      const afterResolve = (await readMigrationLedger(database)).filter(
        (entry) => entry.migrationName === migrationName,
      );
      expect(afterResolve).toHaveLength(1);
      expect(afterResolve[0]).toEqual(
        expect.objectContaining({ finishedAt: null, rolledBackAt: expect.any(String) }),
      );

      await correctRetryFixture(database, invalid[0].uuid, { status: "active" });
      await applyRepositoryMigrations(database);

      const ledger = await readMigrationLedger(database);
      expect(ledger).toHaveLength(3);
      expect(ledger[0]).toEqual(
        expect.objectContaining({
          migrationName: "20260308150134_init",
          finishedAt: expect.any(String),
          rolledBackAt: null,
        }),
      );
      expect(ledger.slice(1)).toEqual([
        expect.objectContaining({
          migrationName,
          finishedAt: null,
          rolledBackAt: expect.any(String),
        }),
        expect.objectContaining({
          migrationName,
          finishedAt: expect.any(String),
          rolledBackAt: null,
        }),
      ]);
      await expect(snapshotCanonicalEmployeeState(database)).resolves.toMatchObject({
        orderedRows: [expect.objectContaining({ status: "ACTIVE" })],
      });
    });
  });
});
