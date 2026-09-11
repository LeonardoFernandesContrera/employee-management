import * as XLSX from "xlsx";

import type { Employee, EmployeeRepository } from "../../domain/employee";
import { EmployeeService } from "../../services/EmployeeService";
import type { CreateEmployeeDTO } from "../../validation/employeeSchemas";
import { EmployeeWorkbook, type UploadedWorkbook } from "../../xlsx/employeeWorkbook";

const requiredHeaders = ["email", "fullName", "jobTitle", "status", "salary", "hireDate"];
const allHeaders = [...requiredHeaders, "phone", "address", "neighborhood", "postalCode"];
const xlsxMime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const workbookBuffer = (headers: readonly string[], rows: readonly unknown[][] = []): Buffer => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([[...headers], ...rows.map((row) => [...row])]),
    "Employees",
  );
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
};

const upload = (buffer: Buffer, overrides: Partial<UploadedWorkbook> = {}): UploadedWorkbook => ({
  buffer,
  mimetype: xlsxMime,
  originalname: "employees.xlsx",
  size: buffer.length,
  ...overrides,
});

const employeeFromInput = (input: CreateEmployeeDTO, sequence: number): Employee => ({
  id: `30000000-0000-4000-8000-${sequence.toString().padStart(12, "0")}`,
  email: input.email,
  fullName: input.fullName,
  jobTitle: input.jobTitle,
  status: input.status,
  salary: input.salary,
  hireDate: input.hireDate,
  phone: input.phone ?? null,
  address: input.address ?? null,
  neighborhood: input.neighborhood ?? null,
  postalCode: input.postalCode ?? null,
  createdAt: new Date("2026-08-28T12:00:00.000Z"),
  updatedAt: new Date("2026-08-28T12:00:00.000Z"),
});

const createHarness = (
  exportRows: readonly Employee[] = [],
  existingEmails: readonly string[] = [],
) => {
  const accepted: CreateEmployeeDTO[] = [];
  const emails = new Set(existingEmails);
  const repository: jest.Mocked<EmployeeRepository> = {
    create: jest.fn(async (input) => {
      if (emails.has(input.email)) throw { code: "P2002", meta: { target: ["email"] } };
      emails.add(input.email);
      accepted.push(input);
      return employeeFromInput(input, accepted.length);
    }),
    findById: jest.fn(),
    findPage: jest.fn(),
    findAllForExport: jest.fn().mockResolvedValue(exportRows),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const service = new EmployeeService(repository);
  return { accepted, repository, workbook: new EmployeeWorkbook(service) };
};

describe("EmployeeWorkbook import", () => {
  test("normalizes valid rows and preserves temporary partial-success semantics", async () => {
    const { accepted, workbook } = createHarness([], ["existing@example.com"]);
    const rows = [
      [
        "  PERSON@EXAMPLE.COM ",
        " Person One ",
        " Developer ",
        "ACTIVE",
        3500,
        "2024-02-29",
        " ",
        " Street ",
        " Center ",
        " 12345 ",
      ],
      ["invalid", "Bad Email", "Developer", "ACTIVE", "3500.00", "2024-01-01"],
      ["existing@example.com", "Existing", "Developer", "ACTIVE", "3500.00", "2024-01-01"],
      ["person@example.com", "Duplicate", "Developer", "ACTIVE", "3500.00", "2024-01-01"],
      ["second@example.com", "Second", "QA", "INACTIVE", 4200.1, "2023-01-10"],
    ];

    await expect(workbook.importFile(upload(workbookBuffer(allHeaders, rows)))).resolves.toEqual({
      total: 5,
      inserted: 2,
      rejected: 3,
    });
    expect(accepted).toEqual([
      {
        email: "person@example.com",
        fullName: "Person One",
        jobTitle: "Developer",
        status: "ACTIVE",
        salary: "3500.00",
        hireDate: "2024-02-29",
        phone: null,
        address: "Street",
        neighborhood: "Center",
        postalCode: "12345",
      },
      {
        email: "second@example.com",
        fullName: "Second",
        jobTitle: "QA",
        status: "INACTIVE",
        salary: "4200.10",
        hireDate: "2023-01-10",
      },
    ]);
  });

  test("accepts an exact header-only worksheet as zero rows", async () => {
    const { workbook } = createHarness();
    await expect(workbook.importFile(upload(workbookBuffer(requiredHeaders)))).resolves.toEqual({
      total: 0,
      inserted: 0,
      rejected: 0,
    });
  });

  test.each([
    ["missing header", requiredHeaders.slice(0, -1)],
    ["unknown header", [...requiredHeaders, "department"]],
    ["duplicate header", [...requiredHeaders, "email"]],
  ])("rejects a structurally invalid workbook with a %s", async (_name, headers) => {
    const { workbook } = createHarness();
    await expect(workbook.importFile(upload(workbookBuffer(headers)))).rejects.toMatchObject({
      code: "INVALID_XLSX",
    });
  });

  test("rejects a worksheet without a header row", async () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([[]]), "Employees");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    await expect(createHarness().workbook.importFile(upload(buffer))).rejects.toMatchObject({
      code: "INVALID_XLSX",
    });
  });

  test.each([
    ["numeric date", ["person@example.com", "Person", "Developer", "ACTIVE", 1, 45292]],
    ["ambiguous date", ["person@example.com", "Person", "Developer", "ACTIVE", 1, "1/1/24"]],
    [
      "over-scale salary",
      ["person@example.com", "Person", "Developer", "ACTIVE", 1.001, "2024-01-01"],
    ],
    ["invalid status", ["person@example.com", "Person", "Developer", "active", 1, "2024-01-01"]],
    [
      "over-length name",
      ["person@example.com", "x".repeat(121), "Developer", "ACTIVE", 1, "2024-01-01"],
    ],
  ])("counts an invalid %s row as rejected", async (_name, row) => {
    const { workbook } = createHarness();
    await expect(
      workbook.importFile(upload(workbookBuffer(requiredHeaders, [row]))),
    ).resolves.toEqual({ total: 1, inserted: 0, rejected: 1 });
  });

  test("rejects corrupt, wrong-type, wrong-extension and oversized files", async () => {
    const { workbook } = createHarness();
    const valid = workbookBuffer(requiredHeaders);
    const cases: UploadedWorkbook[] = [
      upload(Buffer.from("not an xlsx")),
      upload(valid, { mimetype: "text/csv" }),
      upload(valid, { originalname: "employees.csv" }),
      upload(valid, { size: 5 * 1024 * 1024 + 1 }),
    ];

    const expectedCodes = [
      "INVALID_XLSX",
      "UNSUPPORTED_MEDIA_TYPE",
      "UNSUPPORTED_MEDIA_TYPE",
      "PAYLOAD_TOO_LARGE",
    ];
    for (const [index, file] of cases.entries()) {
      await expect(workbook.importFile(file)).rejects.toMatchObject({ code: expectedCodes[index] });
    }
  });

  test("rethrows infrastructure failures instead of counting them as rejected rows", async () => {
    const { repository, workbook } = createHarness();
    repository.create.mockRejectedValueOnce(new Error("database unavailable"));
    const row = ["person@example.com", "Person", "Developer", "ACTIVE", 1, "2024-01-01"];

    await expect(
      workbook.importFile(upload(workbookBuffer(requiredHeaders, [row]))),
    ).rejects.toThrow("database unavailable");
  });
});

describe("EmployeeWorkbook export", () => {
  const rows = [
    employeeFromInput(
      {
        email: "zulu@example.com",
        fullName: "Zulu",
        jobTitle: "QA",
        status: "INACTIVE",
        salary: "4100.00",
        hireDate: "2024-01-02",
        phone: null,
        address: null,
        neighborhood: null,
        postalCode: null,
      },
      2,
    ),
    employeeFromInput(
      {
        email: "alpha@example.com",
        fullName: "Alpha",
        jobTitle: "Developer",
        status: "ACTIVE",
        salary: "3500.10",
        hireDate: "2024-01-01",
        phone: "123",
        address: "Street",
        neighborhood: "Center",
        postalCode: "12345",
      },
      1,
    ),
  ];

  test("exports all ten import-compatible columns and round-trips into an empty service", async () => {
    const source = createHarness(rows);
    const buffer = await source.workbook.exportAll();
    expect(source.repository.findAllForExport).toHaveBeenCalledWith();

    const parsed = XLSX.read(buffer, { type: "buffer", raw: true });
    expect(parsed.SheetNames).toEqual(["Employees"]);
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(parsed.Sheets.Employees, {
      header: 1,
      raw: true,
      defval: "",
    });
    expect(matrix[0]).toEqual(allHeaders);
    expect(matrix.slice(1).map((row) => row[1])).toEqual(["Alpha", "Zulu"]);
    expect(matrix[1]?.slice(4, 6)).toEqual(["3500.10", "2024-01-01"]);
    expect(matrix[2]?.slice(6)).toEqual(["", "", "", ""]);

    const target = createHarness();
    await expect(target.workbook.importFile(upload(buffer))).resolves.toEqual({
      total: 2,
      inserted: 2,
      rejected: 0,
    });
  });
});
