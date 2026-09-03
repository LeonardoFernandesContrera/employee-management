<script setup lang="ts">
import type { Employee } from "../types/employee";

const props = defineProps<{
  employees: Employee[];
}>();

defineEmits<{
  (e: "edit", emp: Employee): void;
  (e: "delete", id: string): void;
}>();
</script>

<template>
  <table class="w-full border rounded overflow-hidden">
    <thead class="bg-gray-100">
      <tr>
        <th class="p-3 text-left">Name</th>
        <th class="p-3 text-left">Address</th>
        <th class="p-3 text-left">Neighborhood</th>
        <th class="p-3 text-left">Zip Code</th>
        <th class="p-3 text-left">Phone</th>
        <th class="p-3 text-left">Salary</th>
        <th class="p-3 text-left">Contract Date</th>
        <th class="p-3 text-left">Role</th>
        <th class="p-3 text-left">Status</th>
        <th class="p-3 text-left">Actions</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="emp in props.employees" :key="emp.uuid" class="border-t">
        <td class="p-3">{{ emp.name }}</td>
        <td class="p-3">{{ emp.address }}</td>
        <td class="p-3">{{ emp.neighborhood }}</td>
        <td class="p-3">{{ emp.zipcode }}</td>
        <td class="p-3">{{ emp.phone }}</td>
        <td class="p-3">{{ emp.salary }}</td>
        <td class="p-3">{{ new Date(emp.contract_date).toLocaleDateString() }}</td>
        <td class="p-3">{{ emp.role }}</td>
        <td class="p-3">{{ emp.status }}</td>
        <td class="p-3 flex gap-2">
          <button @click="$emit('edit', emp)" class="bg-yellow-500 text-white px-2 py-1 rounded">
            Edit
          </button>
          <button
            @click="$emit('delete', emp.uuid)"
            class="bg-red-600 text-white px-2 py-1 rounded"
          >
            Delete
          </button>
        </td>
      </tr>
    </tbody>
  </table>
</template>
