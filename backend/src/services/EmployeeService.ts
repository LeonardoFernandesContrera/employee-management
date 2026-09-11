import type {
  Employee,
  EmployeeListMeta,
  EmployeeListOptions,
  EmployeeRepository,
} from "../domain/employee";
import { ApplicationError } from "../errors/ApplicationError";
import type { CreateEmployeeDTO, UpdateEmployeeDTO } from "../validation/employeeSchemas";

const requestCode = (error: unknown): string | undefined =>
  typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
    ? error.code
    : undefined;

const translatePersistenceError = (error: unknown): never => {
  const code = requestCode(error);
  if (code === "P2002") {
    throw new ApplicationError("EMAIL_CONFLICT", "Email is already in use.");
  }
  if (code === "P2025") {
    throw new ApplicationError("EMPLOYEE_NOT_FOUND", "Employee not found.");
  }
  throw error;
};

export class EmployeeService {
  public constructor(private readonly repository: EmployeeRepository) {}

  public async create(input: CreateEmployeeDTO): Promise<Employee> {
    try {
      return await this.repository.create(input);
    } catch (error) {
      return translatePersistenceError(error);
    }
  }

  public async findById(id: string): Promise<Employee> {
    const employee = await this.repository.findById(id);
    if (!employee) throw new ApplicationError("EMPLOYEE_NOT_FOUND", "Employee not found.");
    return employee;
  }

  public async findAll(
    options: EmployeeListOptions,
  ): Promise<{ data: Employee[]; meta: EmployeeListMeta }> {
    const { items, totalItems } = await this.repository.findPage(options);
    return {
      data: items,
      meta: {
        page: options.page,
        pageSize: options.pageSize,
        totalItems,
        totalPages: totalItems === 0 ? 0 : Math.ceil(totalItems / options.pageSize),
        sortBy: options.sortBy,
        sortOrder: options.sortOrder,
      },
    };
  }

  public async update(id: string, input: UpdateEmployeeDTO): Promise<Employee> {
    try {
      return await this.repository.update(id, input);
    } catch (error) {
      return translatePersistenceError(error);
    }
  }

  public async delete(id: string): Promise<void> {
    try {
      await this.repository.delete(id);
    } catch (error) {
      translatePersistenceError(error);
    }
  }

  public findAllForExport(): Promise<Employee[]> {
    return this.repository.findAllForExport();
  }
}
