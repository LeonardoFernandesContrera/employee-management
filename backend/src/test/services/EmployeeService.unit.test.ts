import type { Employee, EmployeeListOptions, EmployeeRepository } from "../../domain/employee";
import { ApplicationError } from "../../errors/ApplicationError";
import { EmployeeService } from "../../services/EmployeeService";
import type { CreateEmployeeDTO } from "../../validation/employeeSchemas";

const employee: Employee = {
  id: "85c3a05e-bb06-4b2f-b6de-0d81da73120c",
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
  createdAt: new Date("2026-08-28T12:00:00.000Z"),
  updatedAt: new Date("2026-08-28T12:00:00.000Z"),
};

const createInput: CreateEmployeeDTO = {
  email: employee.email,
  fullName: employee.fullName,
  jobTitle: employee.jobTitle,
  status: employee.status,
  salary: employee.salary,
  hireDate: employee.hireDate,
  phone: employee.phone,
  address: employee.address,
  neighborhood: employee.neighborhood,
  postalCode: employee.postalCode,
};

const repositoryDouble = (
  overrides: Partial<jest.Mocked<EmployeeRepository>> = {},
): jest.Mocked<EmployeeRepository> => ({
  create: jest.fn().mockResolvedValue(employee),
  findById: jest.fn().mockResolvedValue(employee),
  findPage: jest.fn().mockResolvedValue({ items: [employee], totalItems: 1 }),
  findAllForExport: jest.fn().mockResolvedValue([employee]),
  update: jest.fn().mockResolvedValue(employee),
  delete: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

describe("EmployeeService", () => {
  test("forwards canonical create input and returns the domain employee", async () => {
    const repository = repositoryDouble();
    const service = new EmployeeService(repository);

    await expect(service.create(createInput)).resolves.toBe(employee);
    expect(repository.create).toHaveBeenCalledWith(createInput);
  });

  test("translates a unique-email race without importing Prisma query shapes", async () => {
    const repository = repositoryDouble({
      create: jest.fn().mockRejectedValue({ code: "P2002", meta: { target: ["email"] } }),
    });
    const service = new EmployeeService(repository);

    await expect(service.create(createInput)).rejects.toMatchObject({
      name: "ApplicationError",
      code: "EMAIL_CONFLICT",
    });
  });

  test("returns EMPLOYEE_NOT_FOUND for a valid absent identifier", async () => {
    const repository = repositoryDouble({ findById: jest.fn().mockResolvedValue(null) });
    const service = new EmployeeService(repository);

    await expect(service.findById(employee.id)).rejects.toEqual(
      new ApplicationError("EMPLOYEE_NOT_FOUND", "Employee not found."),
    );
  });

  test("computes list metadata while forwarding Prisma-independent options", async () => {
    const options: EmployeeListOptions = {
      page: 2,
      pageSize: 10,
      search: "developer",
      status: "ACTIVE",
      sortBy: "fullName",
      sortOrder: "asc",
    };
    const repository = repositoryDouble({
      findPage: jest.fn().mockResolvedValue({ items: [employee], totalItems: 21 }),
    });
    const service = new EmployeeService(repository);

    await expect(service.findAll(options)).resolves.toEqual({
      data: [employee],
      meta: {
        page: 2,
        pageSize: 10,
        totalItems: 21,
        totalPages: 3,
        sortBy: "fullName",
        sortOrder: "asc",
      },
    });
    expect(repository.findPage).toHaveBeenCalledWith(options);
  });

  test("reports zero total pages when no employee matches", async () => {
    const repository = repositoryDouble({
      findPage: jest.fn().mockResolvedValue({ items: [], totalItems: 0 }),
    });
    const service = new EmployeeService(repository);

    await expect(
      service.findAll({ page: 1, pageSize: 10, sortBy: "fullName", sortOrder: "asc" }),
    ).resolves.toMatchObject({ meta: { totalItems: 0, totalPages: 0 } });
  });

  test("passes only the supplied partial update to the repository", async () => {
    const repository = repositoryDouble();
    const service = new EmployeeService(repository);
    const update = { phone: null, salary: "4100.00" } as const;

    await expect(service.update(employee.id, update)).resolves.toBe(employee);
    expect(repository.update).toHaveBeenCalledWith(employee.id, update);
  });

  test.each(["update", "delete"] as const)(
    "translates a %s mutation race into EMPLOYEE_NOT_FOUND",
    async (operation) => {
      const repository = repositoryDouble({
        [operation]: jest.fn().mockRejectedValue({ code: "P2025" }),
      });
      const service = new EmployeeService(repository);

      const result =
        operation === "update"
          ? service.update(employee.id, { jobTitle: "Manager" })
          : service.delete(employee.id);
      await expect(result).rejects.toMatchObject({
        name: "ApplicationError",
        code: "EMPLOYEE_NOT_FOUND",
      });
    },
  );

  test("delegates delete without a preliminary read", async () => {
    const repository = repositoryDouble();
    const service = new EmployeeService(repository);

    await expect(service.delete(employee.id)).resolves.toBeUndefined();
    expect(repository.findById).not.toHaveBeenCalled();
    expect(repository.delete).toHaveBeenCalledWith(employee.id);
  });

  test("exports all employees through the argument-free repository method", async () => {
    const repository = repositoryDouble();
    const service = new EmployeeService(repository);

    await expect(service.findAllForExport()).resolves.toEqual([employee]);
    expect(repository.findAllForExport).toHaveBeenCalledWith();
  });
});
