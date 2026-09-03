import { ref } from "vue";
import type { Employee, Filters, PaginatedResponse, ImportSummary } from "../types/employee";
import {
  getEmployees,
  deleteEmployee,
  updateEmployee,
  importEmployees,
  exportEmployees,
} from "../api/employee";

export function useEmployee() {
  const employees = ref<Employee[]>([]);
  const loading = ref(false);
  const error = ref("");
  const page = ref(1);
  const totalPages = ref(1);
  const importSummary = ref<ImportSummary | null>(null);

  const fetchEmployees = async (filters: Filters) => {
    loading.value = true;
    error.value = "";
    try {
      const params: Partial<Filters> & { page: number } = { page: page.value };
      Object.entries(filters).forEach(([key, value]) => {
        if (value) (params as any)[key] = value;
      });
      const res = await getEmployees(params);
      const data = res.data as PaginatedResponse<Employee>;
      employees.value = data.data;
      totalPages.value = data.meta.totalPages;
    } catch {
      error.value = "Error loading employees";
    } finally {
      loading.value = false;
    }
  };

  const removeEmployee = async (id: string, filters: Filters) => {
    if (!confirm("Are you sure you want to delete this employee?")) return;
    await deleteEmployee(id);
    fetchEmployees(filters);
  };

  const saveEmployee = async (employee: Employee, filters: Filters) => {
    await updateEmployee(employee.uuid, employee);
    fetchEmployees(filters);
  };

  const handleImport = async (file: File, filters: Filters) => {
    const res = await importEmployees(file);
    importSummary.value = res.data as ImportSummary;
    fetchEmployees(filters);
  };

  const handleExport = async () => {
    const res = await exportEmployees();
    const url = window.URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = "employees.xlsx";
    a.click();
  };

  return {
    employees,
    loading,
    error,
    page,
    totalPages,
    importSummary,
    fetchEmployees,
    removeEmployee,
    saveEmployee,
    handleImport,
    handleExport,
  };
}
