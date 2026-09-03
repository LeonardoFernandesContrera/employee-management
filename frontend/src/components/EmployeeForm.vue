<script setup lang="ts">
import { ref } from "vue";
import { createEmployee } from "../api/employee";

const form = ref({
  name: "",
  salary: 0,
  contract_date: "",
  role: "",
  status: "active",
});

const emit = defineEmits(["saved"]);

const save = async () => {
  await createEmployee(form.value);

  emit("saved");
};
</script>

<template>
  <div>
    <input v-model="form.name" placeholder="Name" />

    <input v-model="form.salary" type="number" />

    <input v-model="form.contract_date" type="date" />

    <input v-model="form.role" />

    <select v-model="form.status">
      <option>active</option>
      <option>inactive</option>
    </select>

    <button @click="save">Save</button>
  </div>
</template>
