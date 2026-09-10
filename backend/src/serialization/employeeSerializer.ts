import type { Employee, EmployeeDTO } from "../domain/employee";

export function serializeEmployee(employee: Employee): EmployeeDTO {
  return {
    id: employee.id,
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
    createdAt: employee.createdAt.toISOString(),
    updatedAt: employee.updatedAt.toISOString(),
  };
}
