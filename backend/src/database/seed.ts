import { Prisma, PrismaClient } from "@prisma/client";

import { createPrismaClient } from "./prisma";
import { dateOnlyToUtcDate, type CanonicalSeedEmployee } from "../validation/employeeSchemas";

export const CANONICAL_EMPLOYEES = [
  {
    email: "joao.silva@example.com",
    fullName: "João Silva",
    jobTitle: "Developer",
    status: "ACTIVE",
    salary: "3500.00",
    hireDate: "2023-01-10",
    phone: "119999999",
    address: "Rua A",
    neighborhood: "Centro",
    postalCode: "14000-000",
  },
  {
    email: "maria.souza@example.com",
    fullName: "Maria Souza",
    jobTitle: "Designer",
    status: "ACTIVE",
    salary: "4200.00",
    hireDate: "2022-03-15",
    phone: "119999998",
    address: "Rua B",
    neighborhood: "Jardim Paulista",
    postalCode: "14000-001",
  },
  {
    email: "carlos.lima@example.com",
    fullName: "Carlos Lima",
    jobTitle: "Manager",
    status: "ACTIVE",
    salary: "5000.00",
    hireDate: "2021-07-20",
    phone: "119999997",
    address: "Rua C",
    neighborhood: "Centro",
    postalCode: "14000-002",
  },
  {
    email: "ana.costa@example.com",
    fullName: "Ana Costa",
    jobTitle: "Developer",
    status: "INACTIVE",
    salary: "3200.00",
    hireDate: "2023-05-01",
    phone: "119999996",
    address: "Rua D",
    neighborhood: "Vila Tibério",
    postalCode: "14000-003",
  },
  {
    email: "pedro.santos@example.com",
    fullName: "Pedro Santos",
    jobTitle: "QA",
    status: "ACTIVE",
    salary: "4500.00",
    hireDate: "2022-09-10",
    phone: "119999995",
    address: "Rua E",
    neighborhood: "Campos Eliseos",
    postalCode: "14000-004",
  },
  {
    email: "lucas.pereira@example.com",
    fullName: "Lucas Pereira",
    jobTitle: "Developer",
    status: "ACTIVE",
    salary: "3900.00",
    hireDate: "2022-11-02",
    phone: "119999994",
    address: "Rua F",
    neighborhood: "Centro",
    postalCode: "14000-005",
  },
  {
    email: "fernanda.alves@example.com",
    fullName: "Fernanda Alves",
    jobTitle: "Product Owner",
    status: "ACTIVE",
    salary: "4100.00",
    hireDate: "2021-04-12",
    phone: "119999993",
    address: "Rua G",
    neighborhood: "Ipiranga",
    postalCode: "14000-006",
  },
  {
    email: "ricardo.gomes@example.com",
    fullName: "Ricardo Gomes",
    jobTitle: "Support",
    status: "ACTIVE",
    salary: "3800.00",
    hireDate: "2020-06-30",
    phone: "119999992",
    address: "Rua H",
    neighborhood: "Centro",
    postalCode: "14000-007",
  },
  {
    email: "juliana.rocha@example.com",
    fullName: "Juliana Rocha",
    jobTitle: "Developer",
    status: "ACTIVE",
    salary: "4600.00",
    hireDate: "2021-08-21",
    phone: "119999991",
    address: "Rua I",
    neighborhood: "Jardim Paulista",
    postalCode: "14000-008",
  },
  {
    email: "bruno.martins@example.com",
    fullName: "Bruno Martins",
    jobTitle: "QA",
    status: "INACTIVE",
    salary: "3700.00",
    hireDate: "2022-12-01",
    phone: "119999990",
    address: "Rua J",
    neighborhood: "Centro",
    postalCode: "14000-009",
  },
] as const satisfies readonly CanonicalSeedEmployee[];

export async function seedEmployees(client: PrismaClient): Promise<number> {
  const result = await client.employee.createMany({
    data: CANONICAL_EMPLOYEES.map((employee) => ({
      ...employee,
      salary: new Prisma.Decimal(employee.salary),
      hireDate: dateOnlyToUtcDate(employee.hireDate),
    })),
    skipDuplicates: true,
  });
  return result.count;
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required for seeding.");
  const client = createPrismaClient(databaseUrl);
  try {
    const inserted = await seedEmployees(client);
    console.info(`Inserted ${inserted} employee(s).`);
  } finally {
    await client.$disconnect();
  }
}

if (require.main === module) {
  main().catch(() => {
    console.error("Employee seed failed.");
    process.exitCode = 1;
  });
}
