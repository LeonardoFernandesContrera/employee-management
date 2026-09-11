import { Prisma } from "@prisma/client";

import { createPrismaClient } from "../../database/prisma";
import type { EmployeeSortField } from "../../domain/employee";
import { PrismaEmployeeRepository } from "../../repositories/EmployeeRepository";
import type { CreateEmployeeDTO } from "../../validation/employeeSchemas";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for repository integration tests.");

const client = createPrismaClient(databaseUrl);
const repository = new PrismaEmployeeRepository(client);
const taskEmailSuffix = "@task7.repository.test";

const input = (
  sequence: number,
  overrides: Partial<CreateEmployeeDTO> = {},
): CreateEmployeeDTO => ({
  email: `employee-${sequence}${taskEmailSuffix}`,
  fullName: `Employee ${sequence}`,
  jobTitle: sequence % 2 === 0 ? "Developer" : "Designer",
  status: sequence % 2 === 0 ? "ACTIVE" : "INACTIVE",
  salary: `${3000 + sequence}.00`,
  hireDate: `2024-01-${sequence.toString().padStart(2, "0")}`,
  phone: null,
  address: null,
  neighborhood: null,
  postalCode: null,
  ...overrides,
});

beforeEach(async () => {
  await client.employee.deleteMany({ where: { email: { endsWith: taskEmailSuffix } } });
});

afterAll(async () => {
  await client.employee.deleteMany({ where: { email: { endsWith: taskEmailSuffix } } });
  await client.$disconnect();
});

describe("PrismaEmployeeRepository", () => {
  test("converts canonical salary, date and nullable values in both persistence directions", async () => {
    const created = await repository.create(
      input(1, {
        fullName: "Canonical Name",
        salary: "3500.10",
        hireDate: "2024-02-29",
        phone: null,
      }),
    );

    expect(created).toMatchObject({
      email: `employee-1${taskEmailSuffix}`,
      fullName: "Canonical Name",
      salary: "3500.10",
      hireDate: "2024-02-29",
      phone: null,
    });
    const persisted = await client.employee.findUniqueOrThrow({ where: { id: created.id } });
    expect(persisted.salary).toEqual(new Prisma.Decimal("3500.10"));
    expect(persisted.hireDate.toISOString()).toBe("2024-02-29T00:00:00.000Z");
    await expect(repository.findById(created.id)).resolves.toEqual(created);
  });

  test("applies case-insensitive OR search and exact status filtering", async () => {
    await repository.create(
      input(1, { fullName: "Álvaro Search", jobTitle: "Architect", status: "ACTIVE" }),
    );
    await repository.create(
      input(2, {
        email: `needle${taskEmailSuffix}`,
        fullName: "Other Person",
        jobTitle: "Developer",
        status: "INACTIVE",
      }),
    );
    await repository.create(
      input(3, { fullName: "Third Person", jobTitle: "NEEDLE Specialist", status: "ACTIVE" }),
    );

    const byName = await repository.findPage({
      page: 1,
      pageSize: 10,
      search: "álvaro",
      sortBy: "fullName",
      sortOrder: "asc",
    });
    expect(byName.items.map(({ fullName }) => fullName)).toEqual(["Álvaro Search"]);

    const byEmailOrTitle = await repository.findPage({
      page: 1,
      pageSize: 10,
      search: "needle",
      sortBy: "email",
      sortOrder: "asc",
    });
    expect(byEmailOrTitle.items.map(({ fullName }) => fullName)).toEqual([
      "Third Person",
      "Other Person",
    ]);

    const active = await repository.findPage({
      page: 1,
      pageSize: 10,
      status: "ACTIVE",
      sortBy: "fullName",
      sortOrder: "asc",
    });
    expect(new Set(active.items.map(({ fullName }) => fullName))).toEqual(
      new Set(["Third Person", "Álvaro Search"]),
    );
  });

  test("maps pagination and all six whitelisted primary sorts", async () => {
    await Promise.all([
      repository.create(
        input(1, {
          fullName: "Charlie",
          jobTitle: "QA",
          status: "INACTIVE",
          salary: "5000.00",
          hireDate: "2024-03-01",
        }),
      ),
      repository.create(
        input(2, {
          fullName: "Alpha",
          jobTitle: "Developer",
          status: "ACTIVE",
          salary: "3000.00",
          hireDate: "2024-01-01",
        }),
      ),
      repository.create(
        input(3, {
          fullName: "Bravo",
          jobTitle: "Manager",
          status: "ON_LEAVE",
          salary: "4000.00",
          hireDate: "2024-02-01",
        }),
      ),
    ]);

    const expectedFirst: Record<EmployeeSortField, string> = {
      fullName: "Alpha",
      email: "Charlie",
      jobTitle: "Alpha",
      status: "Alpha",
      salary: "Alpha",
      hireDate: "Alpha",
    };
    for (const sortBy of Object.keys(expectedFirst) as EmployeeSortField[]) {
      const page = await repository.findPage({
        page: 1,
        pageSize: 1,
        sortBy,
        sortOrder: "asc",
      });
      expect(page.totalItems).toBe(3);
      expect(page.items[0]?.fullName).toBe(expectedFirst[sortBy]);
    }

    const secondPage = await repository.findPage({
      page: 2,
      pageSize: 1,
      sortBy: "fullName",
      sortOrder: "asc",
    });
    expect(secondPage.items[0]?.fullName).toBe("Bravo");
  });

  test("keeps id ascending as the final tiebreaker for either primary direction", async () => {
    const shared = input(1, { fullName: "Same Name" });
    await client.employee.createMany({
      data: [
        {
          ...shared,
          id: "20000000-0000-4000-8000-000000000002",
          salary: new Prisma.Decimal(shared.salary),
          hireDate: new Date(`${shared.hireDate}T00:00:00.000Z`),
        },
        {
          ...shared,
          id: "20000000-0000-4000-8000-000000000001",
          email: `employee-tie${taskEmailSuffix}`,
          salary: new Prisma.Decimal(shared.salary),
          hireDate: new Date(`${shared.hireDate}T00:00:00.000Z`),
        },
      ],
    });

    for (const sortOrder of ["asc", "desc"] as const) {
      const result = await repository.findPage({
        page: 1,
        pageSize: 10,
        search: "Same Name",
        sortBy: "fullName",
        sortOrder,
      });
      expect(result.items.map(({ id }) => id)).toEqual([
        "20000000-0000-4000-8000-000000000001",
        "20000000-0000-4000-8000-000000000002",
      ]);
    }
  });

  test("returns every export row in fullName and id order", async () => {
    const later = await repository.create(input(1, { fullName: "Zulu" }));
    const earlier = await repository.create(input(2, { fullName: "Alpha" }));

    await expect(repository.findAllForExport()).resolves.toEqual([
      expect.objectContaining({ id: earlier.id, fullName: "Alpha" }),
      expect.objectContaining({ id: later.id, fullName: "Zulu" }),
    ]);
  });

  test("preserves Prisma P2002 and P2025 codes for central translation", async () => {
    const created = await repository.create(input(1));
    await expect(repository.create(input(2, { email: created.email }))).rejects.toMatchObject({
      code: "P2002",
    });
    await expect(
      repository.update("00000000-0000-4000-8000-000000000000", { jobTitle: "Missing" }),
    ).rejects.toMatchObject({ code: "P2025" });
    await expect(repository.delete("00000000-0000-4000-8000-000000000000")).rejects.toMatchObject({
      code: "P2025",
    });
  });
});
