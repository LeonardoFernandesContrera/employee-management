import { ref } from "vue";

import {
  deleteEmployee,
  exportEmployees,
  getEmployees,
  importEmployees,
  updateEmployee,
} from "../api/employee";
import type {
  Employee,
  EmployeeFilters,
  EmployeeListMeta,
  EmployeeListQuery,
  ImportSummary,
  UpdateEmployeeInput,
} from "../types/employee";

const initialMeta = (): EmployeeListMeta => ({
  page: 1,
  pageSize: 10,
  totalItems: 0,
  totalPages: 0,
  sortBy: "fullName",
  sortOrder: "asc",
});

export function useEmployee() {
  const employees = ref<Employee[]>([]);
  const loading = ref(false);
  const error = ref("");
  const page = ref(1);
  const pageSize = ref(10);
  const meta = ref<EmployeeListMeta>(initialMeta());
  const importSummary = ref<ImportSummary | null>(null);

  const toQuery = (filters: EmployeeFilters): EmployeeListQuery => {
    const search = filters.search.trim();

    return {
      page: page.value,
      pageSize: pageSize.value,
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder,
      ...(search ? { search } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    };
  };

  const fetchEmployees = async (filters: EmployeeFilters): Promise<void> => {
    loading.value = true;
    error.value = "";

    try {
      const response = await getEmployees(toQuery(filters));
      employees.value = response.data;
      meta.value = response.meta;
      page.value = response.meta.page;
      pageSize.value = response.meta.pageSize;
    } catch {
      error.value = "Error loading employees";
    } finally {
      loading.value = false;
    }
  };

  const applyFilters = async (filters: EmployeeFilters): Promise<void> => {
    page.value = 1;
    await fetchEmployees(filters);
  };

  const removeEmployee = async (id: string, filters: EmployeeFilters): Promise<void> => {
    if (!window.confirm("Are you sure you want to delete this employee?")) {
      return;
    }

    await deleteEmployee(id);
    await fetchEmployees(filters);
  };

  const saveEmployee = async (
    id: string,
    input: UpdateEmployeeInput,
    filters: EmployeeFilters,
  ): Promise<void> => {
    await updateEmployee(id, input);
    await fetchEmployees(filters);
  };

  const handleImport = async (file: File, filters: EmployeeFilters): Promise<void> => {
    importSummary.value = await importEmployees(file);
    await fetchEmployees(filters);
  };

  const handleExport = async (): Promise<void> => {
    const blob = await exportEmployees();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "employees.xlsx";
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const previousPage = async (filters: EmployeeFilters): Promise<void> => {
    if (page.value <= 1 || meta.value.totalPages === 0) {
      return;
    }

    page.value -= 1;
    await fetchEmployees(filters);
  };

  const nextPage = async (filters: EmployeeFilters): Promise<void> => {
    if (meta.value.totalPages === 0 || page.value >= meta.value.totalPages) {
      return;
    }

    page.value += 1;
    await fetchEmployees(filters);
  };

  return {
    employees,
    loading,
    error,
    page,
    pageSize,
    meta,
    importSummary,
    fetchEmployees,
    applyFilters,
    removeEmployee,
    saveEmployee,
    handleImport,
    handleExport,
    previousPage,
    nextPage,
  };
}
