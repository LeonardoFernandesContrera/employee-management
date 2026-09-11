import { createPrismaClient } from "../../database/prisma";
import { CANONICAL_EMPLOYEES } from "../../database/seed";
import { runCompiledSeed } from "../support/legacyDatabase";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for seed integration tests.");

const client = createPrismaClient(databaseUrl);
const canonicalEmails = CANONICAL_EMPLOYEES.map(({ email }) => email);

const removeCanonicalEmployees = () =>
  client.employee.deleteMany({ where: { email: { in: canonicalEmails } } });

beforeEach(removeCanonicalEmployees);

afterAll(async () => {
  await removeCanonicalEmployees();
  await client.$disconnect();
});

describe("compiled canonical seed", () => {
  test("is idempotent, preserves edits, and restores only a missing canonical email", async () => {
    const first = await runCompiledSeed(databaseUrl);
    expect(first).toMatchObject({ exitCode: 0, stderr: "" });
    expect(first.stdout).toContain("Inserted 10 employee(s).");

    const joaoEmail = "joao.silva@example.com";
    await client.employee.update({
      where: { email: joaoEmail },
      data: { fullName: "Developer Edit" },
    });

    const second = await runCompiledSeed(databaseUrl);
    expect(second).toMatchObject({ exitCode: 0, stderr: "" });
    expect(second.stdout).toContain("Inserted 0 employee(s).");
    await expect(
      client.employee.findUniqueOrThrow({ where: { email: joaoEmail } }),
    ).resolves.toMatchObject({ fullName: "Developer Edit" });

    const missingEmail = "bruno.martins@example.com";
    await client.employee.delete({ where: { email: missingEmail } });
    const third = await runCompiledSeed(databaseUrl);
    expect(third).toMatchObject({ exitCode: 0, stderr: "" });
    expect(third.stdout).toContain("Inserted 1 employee(s).");

    const rows = await client.employee.findMany({
      where: { email: { in: canonicalEmails } },
      orderBy: { email: "asc" },
    });
    expect(rows).toHaveLength(10);
    expect(rows.map(({ email }) => email)).toEqual(canonicalEmails.slice().sort());
    const restored = rows.find(({ email }) => email === missingEmail);
    expect(restored).toMatchObject({
      fullName: "Bruno Martins",
      jobTitle: "QA",
      status: "INACTIVE",
      hireDate: new Date("2022-12-01T00:00:00.000Z"),
    });
    expect(restored?.salary.toFixed(2)).toBe("3700.00");
  });
});
