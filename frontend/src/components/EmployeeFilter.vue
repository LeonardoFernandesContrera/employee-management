<script setup lang="ts">
import type { EmployeeFilters, EmployeeSortField } from "../types/employee";

const props = defineProps<{
  filters: EmployeeFilters;
}>();

const emit = defineEmits<{
  (event: "filter"): void;
}>();

const sortOptions: ReadonlyArray<{ label: string; value: EmployeeSortField }> = [
  { label: "Full Name", value: "fullName" },
  { label: "Email", value: "email" },
  { label: "Job Title", value: "jobTitle" },
  { label: "Status", value: "status" },
  { label: "Salary", value: "salary" },
  { label: "Hire Date", value: "hireDate" },
];

const applyFilter = () => emit("filter");
</script>

<template>
  <div class="grid grid-cols-6 gap-4 mb-6">
    <input
      v-model="props.filters.search"
      class="border p-2 rounded"
      placeholder="Search employees"
    />
    <select v-model="props.filters.status" class="border p-2 rounded">
      <option value="">All Statuses</option>
      <option value="ACTIVE">Active</option>
      <option value="ON_LEAVE">On Leave</option>
      <option value="INACTIVE">Inactive</option>
    </select>
    <select v-model="props.filters.sortBy" class="border p-2 rounded">
      <option v-for="option in sortOptions" :key="option.value" :value="option.value">
        {{ option.label }}
      </option>
    </select>
    <select v-model="props.filters.sortOrder" class="border p-2 rounded">
      <option value="asc">Ascending</option>
      <option value="desc">Descending</option>
    </select>
    <button class="bg-gray-800 text-white rounded px-4 py-2" @click="applyFilter">
      Apply Filters
    </button>
  </div>
</template>
