import * as XLSX from "xlsx";

import type { Employee } from "../domain/employee";
import { ApplicationError } from "../errors/ApplicationError";
import { EmployeeService } from "../services/EmployeeService";
import { MAX_XLSX_FILE_SIZE, XLSX_MIME_TYPE } from "../utils/upload";
import { createEmployeeSchema, type CreateEmployeeDTO } from "../validation/employeeSchemas";

export interface ImportSummary {
  total: number;
  inserted: number;
  rejected: number;
}

export interface UploadedWorkbook {
  readonly buffer: Buffer;
  readonly mimetype: string;
  readonly originalname: string;
  readonly size: number;
}

const REQUIRED_HEADERS = ["email", "fullName", "jobTitle", "status", "salary", "hireDate"] as const;
const OPTIONAL_HEADERS = ["phone", "address", "neighborhood", "postalCode"] as const;
const ALL_HEADERS = [...REQUIRED_HEADERS, ...OPTIONAL_HEADERS] as const;
type WorkbookHeader = (typeof ALL_HEADERS)[number];

const invalidWorkbook = (): ApplicationError =>
  new ApplicationError("INVALID_XLSX", "The uploaded workbook is invalid.");

const isWorkbookHeader = (value: string): value is WorkbookHeader =>
  (ALL_HEADERS as readonly string[]).includes(value);

const normalizedNumericSalary = (value: number): string | undefined => {
  if (!Number.isFinite(value) || value <= 0 || value > 9999999999.99) return undefined;
  const fixed = value.toFixed(2);
  return Number(fixed) === value ? fixed : undefined;
};

const rowInput = (headers: readonly WorkbookHeader[], row: readonly unknown[]): unknown => {
  const result: Partial<Record<WorkbookHeader, unknown>> = {};
  for (const [index, header] of headers.entries()) {
    const value = row[index];
    result[header] =
      header === "salary" && typeof value === "number" ? normalizedNumericSalary(value) : value;
  }
  return result;
};

const parseHeaders = (row: readonly unknown[]): readonly WorkbookHeader[] => {
  if (row.length === 0 || row.some((value) => typeof value !== "string" || value.length === 0)) {
    throw invalidWorkbook();
  }
  const headers = row as readonly string[];
  if (
    new Set(headers).size !== headers.length ||
    headers.some((header) => !isWorkbookHeader(header))
  ) {
    throw invalidWorkbook();
  }
  if (REQUIRED_HEADERS.some((header) => !headers.includes(header))) throw invalidWorkbook();
  return headers as readonly WorkbookHeader[];
};

const exportRow = (employee: Employee): readonly string[] => [
  employee.email,
  employee.fullName,
  employee.jobTitle,
  employee.status,
  employee.salary,
  employee.hireDate,
  employee.phone ?? "",
  employee.address ?? "",
  employee.neighborhood ?? "",
  employee.postalCode ?? "",
];

export class EmployeeWorkbook {
  public constructor(private readonly employees: EmployeeService) {}

  public async importFile(file: UploadedWorkbook): Promise<ImportSummary> {
    if (file.size > MAX_XLSX_FILE_SIZE) {
      throw new ApplicationError("PAYLOAD_TOO_LARGE", "Uploaded file exceeds the 5 MiB limit.");
    }
    if (file.mimetype !== XLSX_MIME_TYPE || !file.originalname.toLowerCase().endsWith(".xlsx")) {
      throw new ApplicationError("UNSUPPORTED_MEDIA_TYPE", "Only XLSX uploads are supported.");
    }
    if (file.buffer.length < 4 || file.buffer[0] !== 0x50 || file.buffer[1] !== 0x4b) {
      throw invalidWorkbook();
    }

    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(file.buffer, { type: "buffer", raw: true, cellDates: false });
    } catch {
      throw invalidWorkbook();
    }
    const firstSheetName = workbook.SheetNames[0];
    const firstSheet = firstSheetName ? workbook.Sheets[firstSheetName] : undefined;
    if (!firstSheet) throw invalidWorkbook();

    const matrix = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, {
      header: 1,
      raw: true,
      defval: undefined,
      blankrows: false,
    });
    if (matrix.length === 0) throw invalidWorkbook();
    const headers = parseHeaders(matrix[0]);
    const rows = matrix.slice(1);
    let inserted = 0;
    let rejected = 0;

    for (const row of rows) {
      const parsed = createEmployeeSchema.safeParse(rowInput(headers, row));
      if (!parsed.success) {
        rejected += 1;
        continue;
      }
      try {
        await this.employees.create(parsed.data as CreateEmployeeDTO);
        inserted += 1;
      } catch (error) {
        if (error instanceof ApplicationError && error.code === "EMAIL_CONFLICT") {
          rejected += 1;
          continue;
        }
        throw error;
      }
    }

    return { total: rows.length, inserted, rejected };
  }

  public async exportAll(): Promise<Buffer> {
    const employees = (await this.employees.findAllForExport()).slice().sort((left, right) => {
      const byName = left.fullName.localeCompare(right.fullName, "en");
      return byName !== 0 ? byName : left.id.localeCompare(right.id, "en");
    });
    const worksheet = XLSX.utils.aoa_to_sheet([
      [...ALL_HEADERS],
      ...employees.map((employee) => [...exportRow(employee)]),
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Employees");
    return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  }
}
