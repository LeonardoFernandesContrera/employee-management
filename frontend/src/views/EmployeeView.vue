<script setup lang="ts">
import { ref, onMounted } from "vue"
import type { Employee, Filters } from "../types/employee"
import { useEmployee } from "../composables/useEmployee"
import EmployeeFilter from "../components/EmployeeFilter.vue"
import EmployeeTable from "../components/EmployeeTable.vue"
import EmployeeEditModal from "../components/EmployeeEditModal.vue"

const filters = ref<Filters>({ name: "", role: "", status: "", sort: "" })
const editing = ref<Employee | null>(null)
const isEditModalOpen = ref(false)

const {
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
  handleExport
} = useEmployee()

onMounted(() => fetchEmployees(filters.value))

const startEdit = (emp: Employee) => {
  editing.value = { ...emp }
  isEditModalOpen.value = true
}

const saveEdit = (emp: Employee) => {
  saveEmployee(emp, filters.value)
  isEditModalOpen.value = false
  editing.value = null
}

const cancelEdit = () => {
  editing.value = null
  isEditModalOpen.value = false
}

const confirmDelete = (id: string) => removeEmployee(id, filters.value)

const fileInput = ref<HTMLInputElement | null>(null)
const importFile = () => fileInput.value?.click()
const onFileChange = (e: Event) => {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) handleImport(file, filters.value)
}
</script>

<template>
  <div class="p-8 max-w-7xl mx-auto">
    <h1 class="text-3xl font-bold mb-6">Employees</h1>

    <EmployeeFilter :filters="filters" @filter="() => fetchEmployees(filters)" />

    <div class="flex gap-4 mb-6">
      <input ref="fileInput" type="file" class="hidden" @change="onFileChange" />
      <button class="bg-gray-800 text-white px-4 py-2 rounded hover:bg-gray-900" @click="importFile">Import File</button>
      <button class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700" @click="handleExport">Export XLSX</button>
    </div>

    <div v-if="importSummary" class="mb-4 p-3 border rounded bg-gray-100 text-gray-800">
      <p><strong>Total:</strong> {{ importSummary.total }}</p>
      <p><strong>Inserted:</strong> {{ importSummary.inseridos }}</p>
      <p><strong>Rejected:</strong> {{ importSummary.rejeitados }}</p>
    </div>

    <div v-if="loading" class="text-gray-500 mb-4">Loading...</div>
    <div v-if="error" class="text-red-500 mb-4">{{ error }}</div>

    <EmployeeTable :employees="employees" @edit="startEdit" @delete="confirmDelete" />

    <div class="flex justify-center gap-4 mt-6">
      <button :disabled="page===1" class="px-3 py-1 border rounded" @click="page--; fetchEmployees(filters)">Previous</button>
      <span class="font-semibold">{{ page }} / {{ totalPages }}</span>
      <button :disabled="page===totalPages" class="px-3 py-1 border rounded" @click="page++; fetchEmployees(filters)">Next</button>
    </div>

    <EmployeeEditModal v-if="isEditModalOpen && editing" :employee="editing" :show="isEditModalOpen" @save="saveEdit" @cancel="cancelEdit" />
  </div>
</template>