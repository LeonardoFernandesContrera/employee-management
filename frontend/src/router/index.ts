import { createRouter, createWebHashHistory } from "vue-router";
import Employees from "../views/EmployeeView.vue";

const routes = [{ path: "/", component: Employees }];

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

export default router;
