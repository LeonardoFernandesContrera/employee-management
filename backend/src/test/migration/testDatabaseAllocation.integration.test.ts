import { allocateDisposableDatabase, disposableDatabaseExists } from "../support/testDatabase";

test("allocates and idempotently disposes only a generated database", async () => {
  const database = await allocateDisposableDatabase("allocation");
  const name = database.name;

  expect(name).toMatch(/^employee_phase1_test_allocation_[0-9]+_[a-f0-9]{12}$/u);
  try {
    await expect(disposableDatabaseExists(name)).resolves.toBe(true);
  } finally {
    await database.dispose();
    await database.dispose();
  }

  await expect(disposableDatabaseExists(name)).resolves.toBe(false);
  console.info(`[task6-assertion] database absent ${name}`);
});
