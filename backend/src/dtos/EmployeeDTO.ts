export interface CreateEmployeeDTO {
  name: string;
  address: string;
  neighborhood?: string;
  zipcode?: string;
  phone?: string;
  salary: number;
  contract_date: string;
  role: string;
  status: string;
}

export interface UpdateEmployeeDTO {
  name?: string;
  address?: string;
  neighborhood?: string;
  zipcode?: string;
  phone?: string;
  salary?: number;
  contract_date?: string;
  role?: string;
  status?: string;
}

export interface EmployeeQueryDTO {
  page?: string;
  limit?: string;
  name?: string;
  role?: string;
  status?: string;
  sort?: string;
}

export interface ImportEmployeeRowDTO {
  name: string;
  address: string;
  neighborhood?: string;
  zipcode?: string;
  phone?: string;
  salary: number;
  contract_date: string;
  role: string;
  status: string;
}