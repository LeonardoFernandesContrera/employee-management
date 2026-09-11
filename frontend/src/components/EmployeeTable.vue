<script setup lang="ts">
import type { Employee } from "../types/employee";
import { displayHireDate, formatSalaryUsd } from "../utils/employeeFormat";

const props = defineProps<{
  employees: Employee[];
}>();

defineEmits<{
  (event: "edit", employee: Employee): void;
  (event: "delete", id: string): void;
}>();
</script>

<template>
  <table class="w-full border rounded overflow-hidden">
    <thead class="bg-gray-100">
      <tr>
        <th class="p-3 text-left">Email</th>
        <th class="p-3 text-left">Full Name</th>
        <th class="p-3 text-left">Job Title</th>
        <th class="p-3 text-left">Status</th>
        <th class="p-3 text-left">Salary</th>
        <th class="p-3 text-left">Hire Date</th>
        <th class="p-3 text-left">Phone</th>
        <th class="p-3 text-left">Address</th>
        <th class="p-3 text-left">Neighborhood</th>
        <th class="p-3 text-left">Postal Code</th>
        <th class="p-3 text-left">Actions</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="employee in props.employees" :key="employee.id" class="border-t">
        <td class="p-3">{{ employee.email }}</td>
        <td class="p-3">{{ employee.fullName }}</td>
        <td class="p-3">{{ employee.jobTitle }}</td>
        <td class="p-3">{{ employee.status }}</td>
        <td class="p-3">{{ formatSalaryUsd(employee.salary) }}</td>
        <td class="p-3">{{ displayHireDate(employee.hireDate) }}</td>
        <td class="p-3">{{ employee.phone ?? "" }}</td>
        <td class="p-3">{{ employee.address ?? "" }}</td>
        <td class="p-3">{{ employee.neighborhood ?? "" }}</td>
        <td class="p-3">{{ employee.postalCode ?? "" }}</td>
        <td class="p-3 flex gap-2">
          <button
            class="bg-yellow-500 text-white px-2 py-1 rounded"
            @click="$emit('edit', employee)"
          >
            Edit
          </button>
          <button
            class="bg-red-600 text-white px-2 py-1 rounded"
            @click="$emit('delete', employee.id)"
          >
            Delete
          </button>
        </td>
      </tr>
    </tbody>
  </table>
</template>
