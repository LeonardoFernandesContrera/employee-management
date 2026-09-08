import { z } from "zod";

import { EMPLOYEE_STATUSES, type EmployeeSortField, type SortOrder } from "../domain/employee";

const EMPLOYEE_SORT_FIELDS = [
  "fullName",
  "email",
  "jobTitle",
  "status",
  "salary",
  "hireDate",
] as const satisfies readonly EmployeeSortField[];

const SORT_ORDERS = ["asc", "desc"] as const satisfies readonly SortOrder[];
const CANONICAL_SALARY = /^(?:0|[1-9][0-9]{0,9})\.[0-9]{2}$/;

const optionalText = (maximum: number) =>
  z.preprocess((value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  }, z.string().min(1).max(maximum).nullable().optional());

const httpInteger = (defaultValue: number, maximum = Number.MAX_SAFE_INTEGER) =>
  z.preprocess(
    (value) => (value === undefined ? String(defaultValue) : value),
    z
      .string()
      .regex(/^[1-9][0-9]*$/)
      .transform(Number)
      .refine(Number.isSafeInteger)
      .refine((value) => value <= maximum),
  );

export function isDateOnly(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  if (year < 1 || year > 9999) return false;
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

export function dateOnlyToUtcDate(value: string): Date {
  if (!isDateOnly(value)) throw new Error("Invalid canonical hire date");
  const [year, month, day] = value.split("-").map(Number);
  const result = new Date(0);
  result.setUTCHours(0, 0, 0, 0);
  result.setUTCFullYear(year, month - 1, day);
  return result;
}

const emailSchema = z
  .string()
  .trim()
  .min(1)
  .max(254)
  .email()
  .transform((value) => value.toLowerCase());

const requiredText = (maximum: number) => z.string().trim().min(1).max(maximum);

const salarySchema = z
  .string()
  .regex(CANONICAL_SALARY)
  .refine((value) => value !== "0.00");

const hireDateSchema = z.string().refine(isDateOnly);

export const createEmployeeSchema = z
  .object({
    email: emailSchema,
    fullName: requiredText(120),
    jobTitle: requiredText(120),
    status: z.enum(EMPLOYEE_STATUSES),
    salary: salarySchema,
    hireDate: hireDateSchema,
    phone: optionalText(30),
    address: optionalText(200),
    neighborhood: optionalText(100),
    postalCode: optionalText(20),
  })
  .strict();

export const updateEmployeeSchema = createEmployeeSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one employee field is required",
  });

export const employeeIdParamsSchema = z
  .object({
    id: z.string().uuid(),
  })
  .strict();

export const updateEmployeeRouteSchema = z
  .object({
    params: employeeIdParamsSchema,
    body: updateEmployeeSchema,
  })
  .strict();

export const employeeListQuerySchema = z
  .object({
    page: httpInteger(1),
    pageSize: httpInteger(10, 100),
    search: z.string().trim().min(1).max(100).optional(),
    status: z.enum(EMPLOYEE_STATUSES).optional(),
    sortBy: z.enum(EMPLOYEE_SORT_FIELDS).default("fullName"),
    sortOrder: z.enum(SORT_ORDERS).default("asc"),
  })
  .strict();

export const emptyExportQuerySchema = z.object({}).strict();

export type CreateEmployeeDTO = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeDTO = z.infer<typeof updateEmployeeSchema>;
export type EmployeeIdParams = z.infer<typeof employeeIdParamsSchema>;
export type UpdateEmployeeRouteDTO = z.infer<typeof updateEmployeeRouteSchema>;
export type EmployeeListQueryInput = z.input<typeof employeeListQuerySchema>;
export type EmployeeListQueryDTO = z.output<typeof employeeListQuerySchema>;
export type CanonicalSeedEmployee = Readonly<CreateEmployeeDTO>;
