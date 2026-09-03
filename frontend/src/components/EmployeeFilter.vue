<script setup lang="ts">
import { ref } from "vue";
import type { Filters } from "../types/employee";

const props = defineProps<{
  filters: Filters;
}>();

const emits = defineEmits<{
  (e: "filter"): void;
}>();

const sortOptions = [
  { label: "Name", value: "name" },
  { label: "Salary", value: "salary" },
  { label: "Contract Date", value: "contract_date" },
];

const applyFilter = () => emits("filter");
</script>

<template>
  <div class="grid grid-cols-6 gap-4 mb-6">
    <input v-model="props.filters.name" placeholder="Name" class="border p-2 rounded" />
    <input v-model="props.filters.role" placeholder="Role" class="border p-2 rounded" />
    <input v-model="props.filters.status" placeholder="Status" class="border p-2 rounded" />
    <select v-model="props.filters.sort" class="border p-2 rounded">
      <option value="">Sort</option>
      <option v-for="opt in sortOptions" :key="opt.value" :value="opt.value">
        {{ opt.label }}
      </option>
    </select>
    <button @click="applyFilter" class="bg-gray-800 text-white rounded px-4 py-2">Filter</button>
  </div>
</template>
