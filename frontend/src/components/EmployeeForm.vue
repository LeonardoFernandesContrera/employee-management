<script setup lang="ts">
import { ref } from "vue";

import { createEmployee } from "../api/employee";
import type { CreateEmployeeInput, EmployeeStatus } from "../types/employee";

interface EmployeeFormState {
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

const form = ref<EmployeeFormState>({
  email: "",
  fullName: "",
  jobTitle: "",
  status: "ACTIVE",
  salary: "",
  hireDate: "",
  phone: "",
  address: "",
  neighborhood: "",
  postalCode: "",
});

const emit = defineEmits<{
  (event: "saved"): void;
}>();

const optionalValue = (value: string): string | undefined => value.trim() || undefined;

const save = async (): Promise<void> => {
  const input: CreateEmployeeInput = {
    email: form.value.email,
    fullName: form.value.fullName,
    jobTitle: form.value.jobTitle,
    status: form.value.status,
    salary: form.value.salary,
    hireDate: form.value.hireDate,
    phone: optionalValue(form.value.phone),
    address: optionalValue(form.value.address),
    neighborhood: optionalValue(form.value.neighborhood),
    postalCode: optionalValue(form.value.postalCode),
  };

  await createEmployee(input);
  emit("saved");
};
</script>

<template>
  <div>
    <label>
      Email
      <input v-model="form.email" type="email" required />
    </label>

    <label>
      Full Name
      <input v-model="form.fullName" type="text" required />
    </label>

    <label>
      Job Title
      <input v-model="form.jobTitle" type="text" required />
    </label>

    <label>
      Status
      <select v-model="form.status" required>
        <option value="ACTIVE">Active</option>
        <option value="ON_LEAVE">On Leave</option>
        <option value="INACTIVE">Inactive</option>
      </select>
    </label>

    <label>
      Salary
      <input v-model="form.salary" inputmode="decimal" type="text" required />
    </label>

    <label>
      Hire Date
      <input v-model="form.hireDate" type="date" required />
    </label>

    <label>
      Phone
      <input v-model="form.phone" type="tel" />
    </label>

    <label>
      Address
      <input v-model="form.address" type="text" />
    </label>

    <label>
      Neighborhood
      <input v-model="form.neighborhood" type="text" />
    </label>

    <label>
      Postal Code
      <input v-model="form.postalCode" type="text" />
    </label>

    <button @click="save">Save</button>
  </div>
</template>
