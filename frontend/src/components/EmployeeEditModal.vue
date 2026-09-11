<script setup lang="ts">
import { ref, watch } from "vue";

import type { Employee, EmployeeStatus, UpdateEmployeeInput } from "../types/employee";

interface EmployeeEditFields {
  email: string;
  fullName: string;
  jobTitle: string;
  status: EmployeeStatus;
  salary: string;
  hireDate: string;
  phone: string;
  address: string;
  neighborhood: string;
  postalCode: string;
}

const props = defineProps<{
  employee: Employee;
  show: boolean;
}>();

const emit = defineEmits<{
  (event: "save", input: UpdateEmployeeInput): void;
  (event: "cancel"): void;
}>();

const toEditFields = (employee: Employee): EmployeeEditFields => ({
  email: employee.email,
  fullName: employee.fullName,
  jobTitle: employee.jobTitle,
  status: employee.status,
  salary: employee.salary,
  hireDate: employee.hireDate,
  phone: employee.phone ?? "",
  address: employee.address ?? "",
  neighborhood: employee.neighborhood ?? "",
  postalCode: employee.postalCode ?? "",
});

const optionalValue = (value: string): string | null => value.trim() || null;
const fields = ref<EmployeeEditFields>(toEditFields(props.employee));

watch(
  () => props.employee,
  (employee) => {
    fields.value = toEditFields(employee);
  },
);

const save = (): void => {
  const input: UpdateEmployeeInput = {
    email: fields.value.email,
    fullName: fields.value.fullName,
    jobTitle: fields.value.jobTitle,
    status: fields.value.status,
    salary: fields.value.salary,
    hireDate: fields.value.hireDate,
    phone: optionalValue(fields.value.phone),
    address: optionalValue(fields.value.address),
    neighborhood: optionalValue(fields.value.neighborhood),
    postalCode: optionalValue(fields.value.postalCode),
  };

  emit("save", input);
};
</script>

<template>
  <div
    v-if="props.show"
    class="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50"
  >
    <div class="bg-white rounded-lg w-full max-w-2xl p-6 shadow-lg">
      <h2 class="text-2xl font-bold mb-4">Edit Employee</h2>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label>Email</label>
          <input v-model="fields.email" class="border p-2 rounded w-full" type="email" required />
        </div>
        <div>
          <label>Full Name</label>
          <input v-model="fields.fullName" class="border p-2 rounded w-full" required />
        </div>
        <div>
          <label>Job Title</label>
          <input v-model="fields.jobTitle" class="border p-2 rounded w-full" required />
        </div>
        <div>
          <label>Status</label>
          <select v-model="fields.status" class="border p-2 rounded w-full" required>
            <option value="ACTIVE">Active</option>
            <option value="ON_LEAVE">On Leave</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>
        <div>
          <label>Salary</label>
          <input
            v-model="fields.salary"
            class="border p-2 rounded w-full"
            inputmode="decimal"
            type="text"
            required
          />
        </div>
        <div>
          <label>Hire Date</label>
          <input v-model="fields.hireDate" class="border p-2 rounded w-full" type="date" required />
        </div>
        <div>
          <label>Phone</label>
          <input v-model="fields.phone" class="border p-2 rounded w-full" type="tel" />
        </div>
        <div>
          <label>Address</label>
          <input v-model="fields.address" class="border p-2 rounded w-full" />
        </div>
        <div>
          <label>Neighborhood</label>
          <input v-model="fields.neighborhood" class="border p-2 rounded w-full" />
        </div>
        <div>
          <label>Postal Code</label>
          <input v-model="fields.postalCode" class="border p-2 rounded w-full" />
        </div>
      </div>
      <div class="flex justify-end gap-2 mt-6">
        <button class="px-4 py-2 rounded bg-gray-300 hover:bg-gray-400" @click="$emit('cancel')">
          Cancel
        </button>
        <button class="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700" @click="save">
          Save
        </button>
      </div>
    </div>
  </div>
</template>
