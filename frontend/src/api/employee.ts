import axios from "axios";

import type {
  CreateEmployeeInput,
  Employee,
  EmployeeListQuery,
  EmployeeListResponse,
  ImportSummary,
  UpdateEmployeeInput,
} from "../types/employee";

interface DataEnvelope<T> {
  data: T;
}

const publicApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/+$/, "");

if (!publicApiBaseUrl) {
  throw new Error("VITE_API_BASE_URL is required at build time");
}

const api = axios.create({ baseURL: `${publicApiBaseUrl}/employees` });

export async function getEmployees(query: EmployeeListQuery): Promise<EmployeeListResponse> {
  const response = await api.get<EmployeeListResponse>("/", { params: query });
  return response.data;
}

export async function createEmployee(input: CreateEmployeeInput): Promise<Employee> {
  const response = await api.post<DataEnvelope<Employee>>("/", input);
  return response.data.data;
}

export async function updateEmployee(id: string, input: UpdateEmployeeInput): Promise<Employee> {
  const response = await api.patch<DataEnvelope<Employee>>(`/${id}`, input);
  return response.data.data;
}

export async function deleteEmployee(id: string): Promise<void> {
  await api.delete(`/${id}`);
}

export async function importEmployees(file: File): Promise<ImportSummary> {
  const form = new FormData();
  form.append("file", file);

  const response = await api.post<DataEnvelope<ImportSummary>>("/import", form);
  return response.data.data;
}

export async function exportEmployees(): Promise<Blob> {
  const response = await api.get<Blob>("/export", { responseType: "blob" });
  return response.data;
}
