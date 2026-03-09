<script setup lang="ts">
import type { Employee } from "../types/employee"
import { ref, watch } from "vue"

const props = defineProps<{
  employee: Employee
  show: boolean
}>()
defineEmits<{
  (e: "save", emp: Employee): void
  (e: "cancel"): void
}>()

const localEmployee = ref<Employee>({ ...props.employee })
watch(() => props.employee, (val) => localEmployee.value = { ...val })
</script>

<template>
  <div v-if="props.show" class="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
    <div class="bg-white rounded-lg w-full max-w-2xl p-6 shadow-lg">
      <h2 class="text-2xl font-bold mb-4">Edit Employee</h2>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label>Name</label>
          <input v-model="localEmployee.name" class="border p-2 rounded w-full" />
        </div>
        <div>
          <label>Role</label>
          <input v-model="localEmployee.role" class="border p-2 rounded w-full" />
        </div>
        <div>
          <label>Status</label>
          <select v-model="localEmployee.status" class="border p-2 rounded w-full">
            <option>active</option>
            <option>inactive</option>
          </select>
        </div>
        <div>
          <label>Salary</label>
          <input type="number" v-model.number="localEmployee.salary" class="border p-2 rounded w-full" />
        </div>
        <div>
          <label>Address</label>
          <input v-model="localEmployee.address" class="border p-2 rounded w-full" />
        </div>
        <div>
          <label>Neighborhood</label>
          <input v-model="localEmployee.neighborhood" class="border p-2 rounded w-full" />
        </div>
        <div>
          <label>Zip Code</label>
          <input v-model="localEmployee.zipcode" class="border p-2 rounded w-full" />
        </div>
        <div>
          <label>Phone</label>
          <input v-model="localEmployee.phone" class="border p-2 rounded w-full" />
        </div>
        <div class="col-span-2">
          <label>Contract Date</label>
          <input type="date" v-model="localEmployee.contract_date" class="border p-2 rounded w-full" />
        </div>
      </div>
      <div class="flex justify-end gap-2 mt-6">
        <button @click="$emit('cancel')" class="px-4 py-2 rounded bg-gray-300 hover:bg-gray-400">Cancelar</button>
        <button @click="$emit('save', localEmployee)" class="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700">Salvar</button>
      </div>
    </div>
  </div>
</template>