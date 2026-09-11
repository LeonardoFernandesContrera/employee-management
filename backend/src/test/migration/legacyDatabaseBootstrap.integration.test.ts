import { access, readdir } from "node:fs/promises";
import { join } from "node:path";

import { LEGACY_TEN, type LegacyEmployeeFixture } from "../fixtures/legacyEmployees";
import {
  createInitialOnlyPrismaWorkspace,
  readMigrationLedger,
  snapshotLegacyEmployeeState,
  withLegacyDatabase,
} from "../support/legacyDatabase";
import { disposableDatabaseExists } from "../support/testDatabase";

test("creates and idempotently disposes an exact initial-only Prisma workspace", async () => {
  const workspace = await createInitialOnlyPrismaWorkspace();
  const root = workspace.root;
  try {
    await expect(access(workspace.schemaPath)).resolves.toBeUndefined();
    await expect(
      readdir(join(root, "prisma", "migrations")).then((entries) => entries.sort()),
    ).resolves.toEqual(["20260308150134_init", "migration_lock.toml"]);
  } finally {
    await workspace.dispose();
    await workspace.dispose();
  }

  await expect(access(root)).rejects.toMatchObject({ code: "ENOENT" });
  console.info(`[task6-assertion] workspace absent ${root}`);
});

test("deploys only the checked-in initial migration before the ten fixtures", async () => {
  let databaseName = "";
  await withLegacyDatabase("bootstrap", LEGACY_TEN, async (database) => {
    databaseName = database.name;
    await expect(disposableDatabaseExists(database.name)).resolves.toBe(true);
    const ledger = await readMigrationLedger(database);
    expect(ledger.map((entry) => entry.migrationName)).toEqual(["20260308150134_init"]);

    const state = await snapshotLegacyEmployeeState(database);
    expect(state.orderedRows).toHaveLength(10);
    expect(state.orderedRows.map((row) => row.uuid)).toEqual(
      LEGACY_TEN.map((row) => row.uuid).sort(),
    );
  });

  await expect(disposableDatabaseExists(databaseName)).resolves.toBe(false);
  console.info(`[task6-assertion] database absent ${databaseName}`);
});

test("round-trips quoted, backslash, and null fixture literals through stdin SQL", async () => {
  const specialFixture: LegacyEmployeeFixture = {
    ...LEGACY_TEN[0],
    uuid: "30000000-0000-4000-8000-000000000001",
    name: "O'Brien \\ QA",
    address: "C:\\Employees\\HQ",
    neighborhood: null,
    zipcode: null,
    phone: null,
    role: "Lead's \\ Support",
  };
  let databaseName = "";

  await withLegacyDatabase("literals", [specialFixture], async (database) => {
    databaseName = database.name;
    const state = await snapshotLegacyEmployeeState(database);
    expect(state.orderedRows).toEqual([
      expect.objectContaining({
        uuid: specialFixture.uuid,
        name: specialFixture.name,
        address: specialFixture.address,
        neighborhood: null,
        zipcode: null,
        phone: null,
        role: specialFixture.role,
      }),
    ]);
  });

  await expect(disposableDatabaseExists(databaseName)).resolves.toBe(false);
  console.info(`[task6-assertion] database absent ${databaseName}`);
});
