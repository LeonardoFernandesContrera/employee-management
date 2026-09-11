import { Prisma, type Employee as PersistedEmployee, type PrismaClient } from "@prisma/client";

import type {
  Employee,
  EmployeeListOptions,
  EmployeeListResult,
  EmployeeRepository,
  EmployeeSortField,
  SortOrder,
} from "../domain/employee";
import {
  dateOnlyToUtcDate,
  type CreateEmployeeDTO,
  type UpdateEmployeeDTO,
} from "../validation/employeeSchemas";

const toDomainEmployee = (employee: PersistedEmployee): Employee => ({
  id: employee.id,
  email: employee.email,
  fullName: employee.fullName,
  jobTitle: employee.jobTitle,
  status: employee.status,
  salary: employee.salary.toFixed(2),
  hireDate: employee.hireDate.toISOString().slice(0, 10),
  phone: employee.phone,
  address: employee.address,
  neighborhood: employee.neighborhood,
  postalCode: employee.postalCode,
  createdAt: employee.createdAt,
  updatedAt: employee.updatedAt,
});

const toCreateData = (input: CreateEmployeeDTO): Prisma.EmployeeCreateInput => ({
  ...input,
  salary: new Prisma.Decimal(input.salary),
  hireDate: dateOnlyToUtcDate(input.hireDate),
});

const toUpdateData = (input: UpdateEmployeeDTO): Prisma.EmployeeUpdateInput => {
  const data: Prisma.EmployeeUpdateInput = {};
  if (input.email !== undefined) data.email = input.email;
  if (input.fullName !== undefined) data.fullName = input.fullName;
  if (input.jobTitle !== undefined) data.jobTitle = input.jobTitle;
  if (input.status !== undefined) data.status = input.status;
  if (input.salary !== undefined) data.salary = new Prisma.Decimal(input.salary);
  if (input.hireDate !== undefined) data.hireDate = dateOnlyToUtcDate(input.hireDate);
  if (input.phone !== undefined) data.phone = input.phone;
  if (input.address !== undefined) data.address = input.address;
  if (input.neighborhood !== undefined) data.neighborhood = input.neighborhood;
  if (input.postalCode !== undefined) data.postalCode = input.postalCode;
  return data;
};

const primaryOrderBy = (
  sortBy: EmployeeSortField,
  sortOrder: SortOrder,
): Prisma.EmployeeOrderByWithRelationInput => {
  switch (sortBy) {
    case "fullName":
      return { fullName: sortOrder };
    case "email":
      return { email: sortOrder };
    case "jobTitle":
      return { jobTitle: sortOrder };
    case "status":
      return { status: sortOrder };
    case "salary":
      return { salary: sortOrder };
    case "hireDate":
      return { hireDate: sortOrder };
  }
};

export class PrismaEmployeeRepository implements EmployeeRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public async create(input: CreateEmployeeDTO): Promise<Employee> {
    return toDomainEmployee(await this.prisma.employee.create({ data: toCreateData(input) }));
  }

  public async findById(id: string): Promise<Employee | null> {
    const employee = await this.prisma.employee.findUnique({ where: { id } });
    return employee ? toDomainEmployee(employee) : null;
  }

  public async findPage(options: EmployeeListOptions): Promise<EmployeeListResult> {
    const where: Prisma.EmployeeWhereInput = {
      ...(options.search
        ? {
            OR: [
              { fullName: { contains: options.search, mode: "insensitive" } },
              { email: { contains: options.search, mode: "insensitive" } },
              { jobTitle: { contains: options.search, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(options.status ? { status: options.status } : {}),
    };
    const [items, totalItems] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        skip: (options.page - 1) * options.pageSize,
        take: options.pageSize,
        orderBy: [primaryOrderBy(options.sortBy, options.sortOrder), { id: "asc" }],
      }),
      this.prisma.employee.count({ where }),
    ]);
    return { items: items.map(toDomainEmployee), totalItems };
  }

  public async findAllForExport(): Promise<Employee[]> {
    const employees = await this.prisma.employee.findMany({
      orderBy: [{ fullName: "asc" }, { id: "asc" }],
    });
    return employees.map(toDomainEmployee);
  }

  public async update(id: string, input: UpdateEmployeeDTO): Promise<Employee> {
    return toDomainEmployee(
      await this.prisma.employee.update({ where: { id }, data: toUpdateData(input) }),
    );
  }

  public async delete(id: string): Promise<void> {
    await this.prisma.employee.delete({ where: { id } });
  }
}
