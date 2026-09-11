export type EmployeeStatus = "ACTIVE" | "ON_LEAVE" | "INACTIVE";

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
  createdAt: string;
  updatedAt: string;
}

export interface CreateEmployeeInput {
  email: string;
  fullName: string;
  jobTitle: string;
  status: EmployeeStatus;
  salary: string;
  hireDate: string;
  phone?: string | null;
  address?: string | null;
  neighborhood?: string | null;
  postalCode?: string | null;
}

export type UpdateEmployeeInput = Partial<CreateEmployeeInput>;

export interface EmployeeListQuery {
  page: number;
  pageSize: number;
  search?: string;
  status?: EmployeeStatus;
  sortBy: EmployeeSortField;
  sortOrder: SortOrder;
}

export interface EmployeeListMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  sortBy: EmployeeSortField;
  sortOrder: SortOrder;
}

export interface EmployeeListResponse {
  data: Employee[];
  meta: EmployeeListMeta;
}

export interface ImportSummary {
  total: number;
  inserted: number;
  rejected: number;
}

export interface EmployeeFilters {
  search: string;
  status: EmployeeStatus | "";
  sortBy: EmployeeSortField;
  sortOrder: SortOrder;
}
