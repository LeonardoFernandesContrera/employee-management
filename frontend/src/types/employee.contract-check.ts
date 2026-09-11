import type { Employee, EmployeeListResponse, ImportSummary } from "./employee";

const employee: Employee = {
  id: "85c3a05e-bb06-4b2f-b6de-0d81da73120c",
  email: "joao.silva@example.com",
  fullName: "João Silva",
  jobTitle: "Developer",
  status: "ACTIVE",
  salary: "3500.00",
  hireDate: "2023-01-10",
  phone: null,
  address: null,
  neighborhood: null,
  postalCode: null,
  createdAt: "2026-08-28T12:00:00.000Z",
  updatedAt: "2026-08-28T12:00:00.000Z",
};

const list: EmployeeListResponse = {
  data: [employee],
  meta: {
    page: 1,
    pageSize: 10,
    totalItems: 1,
    totalPages: 1,
    sortBy: "fullName",
    sortOrder: "asc",
  },
};

const summary: ImportSummary = { total: 1, inserted: 1, rejected: 0 };

void [employee, list, summary];
