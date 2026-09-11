<script setup lang="ts">
import { onMounted, ref } from "vue";

import EmployeeEditModal from "../components/EmployeeEditModal.vue";
import EmployeeFilter from "../components/EmployeeFilter.vue";
import EmployeeTable from "../components/EmployeeTable.vue";
import { useEmployee } from "../composables/useEmployee";
import type { Employee, EmployeeFilters, UpdateEmployeeInput } from "../types/employee";

const filters = ref<EmployeeFilters>({
  search: "",
  status: "",
  sortBy: "fullName",
  sortOrder: "asc",
});
const editing = ref<Employee | null>(null);
const isEditModalOpen = ref(false);

const {
  employees,
  loading,
  error,
  page,
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
} = useEmployee();

onMounted(() => fetchEmployees(filters.value));

const startEdit = (employee: Employee) => {
  editing.value = { ...employee };
  isEditModalOpen.value = true;
};

const saveEdit = async (input: UpdateEmployeeInput): Promise<void> => {
  if (!editing.value) {
    return;
  }

  await saveEmployee(editing.value.id, input, filters.value);
  isEditModalOpen.value = false;
  editing.value = null;
};

const cancelEdit = () => {
  editing.value = null;
  isEditModalOpen.value = false;
};

const confirmDelete = (id: string) => removeEmployee(id, filters.value);

const fileInput = ref<HTMLInputElement | null>(null);
const importFile = () => fileInput.value?.click();
const onFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (file) {
    void handleImport(file, filters.value);
  }
};
</script>

<template>
  <div class="p-8 max-w-7xl mx-auto">
    <h1 class="text-3xl font-bold mb-6">Employees</h1>

    <EmployeeFilter :filters="filters" @filter="applyFilters(filters)" />

    <div class="flex gap-4 mb-6">
      <input ref="fileInput" class="hidden" type="file" @change="onFileChange" />
      <button
        class="bg-gray-800 text-white px-4 py-2 rounded hover:bg-gray-900"
        @click="importFile"
      >
        Import File
      </button>
      <button
        class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        @click="handleExport"
      >
        Export XLSX
      </button>
    </div>

    <div v-if="importSummary" class="mb-4 p-3 border rounded bg-gray-100 text-gray-800">
      <p><strong>Total:</strong> {{ importSummary.total }}</p>
      <p><strong>Inserted:</strong> {{ importSummary.inserted }}</p>
      <p><strong>Rejected:</strong> {{ importSummary.rejected }}</p>
    </div>

    <div v-if="loading" class="text-gray-500 mb-4">Loading...</div>
    <div v-if="error" class="text-red-500 mb-4">{{ error }}</div>

    <EmployeeTable :employees="employees" @edit="startEdit" @delete="confirmDelete" />

    <div class="flex justify-center gap-4 mt-6">
      <button
        :disabled="page <= 1 || meta.totalPages === 0"
        class="px-3 py-1 border rounded"
        @click="previousPage(filters)"
      >
        Previous
      </button>
      <span class="font-semibold">{{ page }} / {{ meta.totalPages || 1 }}</span>
      <button
        :disabled="meta.totalPages === 0 || page >= meta.totalPages"
        class="px-3 py-1 border rounded"
        @click="nextPage(filters)"
      >
        Next
      </button>
    </div>

    <EmployeeEditModal
      v-if="isEditModalOpen && editing"
      :employee="editing"
      :show="isEditModalOpen"
      @save="saveEdit"
      @cancel="cancelEdit"
    />
  </div>
</template>
