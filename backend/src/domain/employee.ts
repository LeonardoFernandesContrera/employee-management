import type { CreateEmployeeDTO, UpdateEmployeeDTO } from "../validation/employeeSchemas";

export const EMPLOYEE_STATUSES = ["ACTIVE", "ON_LEAVE", "INACTIVE"] as const;

export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number];

export type EmployeeSortField =
  "fullName" | "email" | "jobTitle" | "status" | "salary" | "hireDate";

export type SortOrder = "asc" | "desc";

export interface Employee {
  id: string;
  email: string;
  fullName: string;
  jobTitle: string;
  status: EmployeeStatus;
  salary: string;
  hireDate: string;
  phone: string | null;
  address: string | null;
  neighborhood: string | null;
  postalCode: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmployeeListOptions {
  page: number;
  pageSize: number;
  search?: string;
  status?: EmployeeStatus;
  sortBy: EmployeeSortField;
  sortOrder: SortOrder;
}

export interface EmployeeListResult {
  items: Employee[];
  totalItems: number;
}

export interface EmployeeListMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  sortBy: EmployeeSortField;
  sortOrder: SortOrder;
}

export interface EmployeeRepository {
  create(input: CreateEmployeeDTO): Promise<Employee>;
  findById(id: string): Promise<Employee | null>;
  findPage(options: EmployeeListOptions): Promise<EmployeeListResult>;
  findAllForExport(): Promise<Employee[]>;
  update(id: string, input: UpdateEmployeeDTO): Promise<Employee>;
  delete(id: string): Promise<void>;
}

export interface EmployeeDTO {
  id: string;
  email: string;
  fullName: string;
  jobTitle: string;
  status: EmployeeStatus;
  salary: string;
  hireDate: string;
  phone: string | null;
  address: string | null;
  neighborhood: string | null;
  postalCode: string | null;
  createdAt: string;
  updatedAt: string;
}
