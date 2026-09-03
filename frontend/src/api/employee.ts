import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:3000/employees",
});

export const getEmployees = (params: any) => {
  console.log(params);
  let teste = api.get("/", { params });
  console.log(teste);
  return teste;
};

export const createEmployee = (data: any) => api.post("/", data);

export const updateEmployee = (id: string, data: any) => api.put(`/${id}`, data);

export const deleteEmployee = (id: string) => api.delete(`/${id}`);

export const exportEmployees = () => api.get("/export", { responseType: "blob" });

export const importEmployees = (file: File) => {
  const form = new FormData();
  form.append("file", file);

  return api.post("/import", form);
};
