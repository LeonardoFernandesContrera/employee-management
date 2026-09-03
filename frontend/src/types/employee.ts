export interface Employee {
  uuid: string;
  name: string;
  address: string;
  neighborhood?: string;
  zipcode?: string;
  phone?: string;
  salary: number;
  contract_date: string;
  role: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Filters {
  name: string;
  role: string;
  status: string;
  sort: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    totalPages: number;
    totalItems: number;
  };
}

export interface ImportSummary {
  total: number;
  inseridos: number;
  rejeitados: number;
}
