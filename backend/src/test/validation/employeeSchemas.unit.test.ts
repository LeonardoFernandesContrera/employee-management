import type { EmployeeListOptions } from "../../domain/employee";
import {
  createEmployeeSchema,
  dateOnlyToUtcDate,
  employeeIdParamsSchema,
  employeeListQuerySchema,
  emptyExportQuerySchema,
  isDateOnly,
  updateEmployeeRouteSchema,
  updateEmployeeSchema,
  type CanonicalSeedEmployee,
  type CreateEmployeeDTO,
  type EmployeeIdParams,
  type EmployeeListQueryDTO,
  type EmployeeListQueryInput,
  type UpdateEmployeeDTO,
  type UpdateEmployeeRouteDTO,
} from "../../validation/employeeSchemas";

const validEmployeeInput: Record<string, unknown> = {
  email: "employee@example.com",
  fullName: "Employee Name",
  jobTitle: "Developer",
  status: "ACTIVE",
  salary: "3500.00",
  hireDate: "2024-02-29",
};

const validId = "85c3a05e-bb06-4b2f-b6de-0d81da73120c";

const parseCreate = (override: Record<string, unknown> = {}): CreateEmployeeDTO => {
  const result = createEmployeeSchema.safeParse({ ...validEmployeeInput, ...override });
  expect(result.success).toBe(true);
  if (!result.success) {
    throw result.error;
  }
  return result.data;
};

describe("createEmployeeSchema", () => {
  const emailAt254 = `${"a".repeat(64)}@${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(61)}`;
  const emailAt255 = `${"a".repeat(64)}@${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(62)}`;

  test.each([
    ["email at 254", { email: emailAt254 }, true],
    ["email at 255", { email: emailAt255 }, false],
    ["fullName below minimum", { fullName: "" }, false],
    ["fullName at minimum", { fullName: "x" }, true],
    ["fullName at maximum", { fullName: "x".repeat(120) }, true],
    ["fullName above maximum", { fullName: "x".repeat(121) }, false],
    ["jobTitle below minimum", { jobTitle: "" }, false],
    ["jobTitle at minimum", { jobTitle: "x" }, true],
    ["jobTitle at maximum", { jobTitle: "x".repeat(120) }, true],
    ["jobTitle above maximum", { jobTitle: "x".repeat(121) }, false],
  ])("enforces the %s boundary", (_case, override, valid) => {
    expect(createEmployeeSchema.safeParse({ ...validEmployeeInput, ...override }).success).toBe(
      valid,
    );
  });

  test("trims and lowercases email and trims required text", () => {
    expect(
      parseCreate({
        email: "  Employee.Name@EXAMPLE.COM  ",
        fullName: "  Employee Name  ",
        jobTitle: "  Developer  ",
      }),
    ).toMatchObject({
      email: "employee.name@example.com",
      fullName: "Employee Name",
      jobTitle: "Developer",
    });
  });

  test.each(["email", "fullName", "jobTitle", "status", "salary", "hireDate"])(
    "rejects null for required field %s",
    (field) => {
      expect(createEmployeeSchema.safeParse({ ...validEmployeeInput, [field]: null }).success).toBe(
        false,
      );
    },
  );

  test.each([
    ["phone", 30],
    ["address", 200],
    ["neighborhood", 100],
    ["postalCode", 20],
  ] as const)("normalizes and enforces optional %s boundaries", (field, maximum) => {
    const omitted = parseCreate();
    expect(Object.prototype.hasOwnProperty.call(omitted, field)).toBe(false);
    expect(parseCreate({ [field]: null })[field]).toBeNull();
    expect(parseCreate({ [field]: "   " })[field]).toBeNull();
    expect(parseCreate({ [field]: "  x  " })[field]).toBe("x");
    expect(createEmployeeSchema.safeParse({ ...validEmployeeInput, [field]: "x" }).success).toBe(
      true,
    );
    expect(
      createEmployeeSchema.safeParse({ ...validEmployeeInput, [field]: "x".repeat(maximum) })
        .success,
    ).toBe(true);
    expect(
      createEmployeeSchema.safeParse({ ...validEmployeeInput, [field]: "x".repeat(maximum + 1) })
        .success,
    ).toBe(false);
  });

  test.each(["ACTIVE", "ON_LEAVE", "INACTIVE"])("accepts canonical status %s", (status) => {
    expect(createEmployeeSchema.safeParse({ ...validEmployeeInput, status }).success).toBe(true);
  });

  test.each(["active", "ON LEAVE", "UNKNOWN", ""])("rejects noncanonical status %s", (status) => {
    expect(createEmployeeSchema.safeParse({ ...validEmployeeInput, status }).success).toBe(false);
  });

  test.each(["0.01", "1.00", "3500.00", "9999999999.99"])(
    "accepts canonical salary %s",
    (salary) => {
      expect(createEmployeeSchema.safeParse({ ...validEmployeeInput, salary }).success).toBe(true);
    },
  );

  test.each([
    "0.00",
    "003500.00",
    "3500",
    "3500.0",
    "3500.000",
    "1e3",
    "-1.00",
    "+1.00",
    ".50",
    "10000000000.00",
  ])("rejects noncanonical salary %s", (salary) => {
    expect(createEmployeeSchema.safeParse({ ...validEmployeeInput, salary }).success).toBe(false);
  });

  test("rejects numeric salary input", () => {
    expect(createEmployeeSchema.safeParse({ ...validEmployeeInput, salary: 3500 }).success).toBe(
      false,
    );
  });

  test.each(["id", "uuid", "createdAt", "updatedAt", "unknown"])(
    "rejects server-owned or unknown create field %s",
    (field) => {
      expect(
        createEmployeeSchema.safeParse({ ...validEmployeeInput, [field]: "unexpected" }).success,
      ).toBe(false);
    },
  );
});

describe("canonical date-only handling", () => {
  test.each(["0001-01-01", "2024-02-29", "9999-12-31"])(
    "accepts real canonical date %s",
    (hireDate) => {
      expect(isDateOnly(hireDate)).toBe(true);
      expect(createEmployeeSchema.safeParse({ ...validEmployeeInput, hireDate }).success).toBe(
        true,
      );
    },
  );

  test.each([
    "0000-01-01",
    "10000-01-01",
    "2023-02-29",
    "2024-02-30",
    "2024-00-01",
    "2024-13-01",
    "2024-01-00",
    "2024-01-32",
    "2024-1-01",
    "24-01-01",
    "2024-01-01T00:00:00Z",
  ])("rejects invalid or noncanonical date %s", (hireDate) => {
    expect(isDateOnly(hireDate)).toBe(false);
    expect(createEmployeeSchema.safeParse({ ...validEmployeeInput, hireDate }).success).toBe(false);
    expect(() => dateOnlyToUtcDate(hireDate)).toThrow("Invalid canonical hire date");
  });

  test.each([
    ["0001-01-01", "0001-01-01T00:00:00.000Z"],
    ["2024-02-29", "2024-02-29T00:00:00.000Z"],
    ["9999-12-31", "9999-12-31T00:00:00.000Z"],
  ])("converts %s to the same UTC calendar day", (input, expected) => {
    expect(dateOnlyToUtcDate(input).toISOString()).toBe(expected);
  });
});

describe("updateEmployeeSchema", () => {
  test("rejects an empty update", () => {
    expect(updateEmployeeSchema.safeParse({}).success).toBe(false);
  });

  test("accepts and normalizes a strict partial update", () => {
    const parsed: UpdateEmployeeDTO = updateEmployeeSchema.parse({
      email: "  UPDATED@EXAMPLE.COM ",
      jobTitle: "  Lead Developer ",
      phone: "   ",
      address: null,
    });

    expect(parsed).toEqual({
      email: "updated@example.com",
      jobTitle: "Lead Developer",
      phone: null,
      address: null,
    });
  });

  test.each(["email", "fullName", "jobTitle", "status", "salary", "hireDate"])(
    "rejects null for required create field %s in an update",
    (field) => {
      expect(updateEmployeeSchema.safeParse({ [field]: null }).success).toBe(false);
    },
  );

  test.each(["id", "uuid", "createdAt", "updatedAt", "unknown"])(
    "rejects server-owned or unknown update field %s",
    (field) => {
      expect(updateEmployeeSchema.safeParse({ [field]: "unexpected" }).success).toBe(false);
    },
  );
});

describe("employee path and update route schemas", () => {
  test("accepts a strict UUID parameter", () => {
    const parsed: EmployeeIdParams = employeeIdParamsSchema.parse({ id: validId });
    expect(parsed).toEqual({ id: validId });
  });

  test.each([{}, { id: "not-a-uuid" }, { id: validId, extra: "unexpected" }, { id: [validId] }])(
    "rejects invalid employee ID parameters %#",
    (input) => {
      expect(employeeIdParamsSchema.safeParse(input).success).toBe(false);
    },
  );

  test.each([
    ["invalid UUID", { params: { id: "not-a-uuid" }, body: { jobTitle: "Lead" } }],
    ["empty body", { params: { id: validId }, body: {} }],
    ["unknown route key", { params: { id: validId }, body: { jobTitle: "Lead" }, query: {} }],
    ["unknown body key", { params: { id: validId }, body: { jobTitle: "Lead", uuid: validId } }],
  ])("rejects update route input with %s", (_case, input) => {
    expect(updateEmployeeRouteSchema.safeParse(input).success).toBe(false);
  });

  test("accepts a valid partial update route input", () => {
    const parsed: UpdateEmployeeRouteDTO = updateEmployeeRouteSchema.parse({
      params: { id: validId },
      body: { jobTitle: "Lead Developer" },
    });
    expect(parsed).toEqual({
      params: { id: validId },
      body: { jobTitle: "Lead Developer" },
    });
  });
});

describe("employeeListQuerySchema", () => {
  test("normalizes list defaults", () => {
    expect(employeeListQuerySchema.parse({})).toEqual({
      page: 1,
      pageSize: 10,
      sortBy: "fullName",
      sortOrder: "asc",
    });
  });

  test("accepts only string HTTP inputs and produces EmployeeListOptions", () => {
    const input: EmployeeListQueryInput = {
      page: "2",
      pageSize: "100",
      search: "  Developer  ",
      status: "ON_LEAVE",
      sortBy: "hireDate",
      sortOrder: "desc",
    };
    const parsed: EmployeeListQueryDTO = employeeListQuerySchema.parse(input);
    const options: EmployeeListOptions = parsed;

    expect(options).toEqual({
      page: 2,
      pageSize: 100,
      search: "Developer",
      status: "ON_LEAVE",
      sortBy: "hireDate",
      sortOrder: "desc",
    });
  });

  test.each([
    ["page below minimum", { page: "0" }],
    ["negative page", { page: "-1" }],
    ["decimal page", { page: "1.5" }],
    ["exponent page", { page: "1e3" }],
    ["unsafe page", { page: "9007199254740992" }],
    ["pageSize below minimum", { pageSize: "0" }],
    ["pageSize above maximum", { pageSize: "101" }],
  ])("rejects %s", (_case, input) => {
    expect(employeeListQuerySchema.safeParse(input).success).toBe(false);
  });

  test.each([
    ["page", 1],
    ["pageSize", 10],
    ["search", ["Developer"]],
    ["status", ["ACTIVE"]],
    ["sortBy", ["fullName"]],
    ["sortOrder", ["asc"]],
  ])("rejects non-string or array query value for %s", (field, value) => {
    expect(employeeListQuerySchema.safeParse({ [field]: value }).success).toBe(false);
  });

  test.each([
    ["search below minimum", { search: "   " }, false],
    ["search at minimum", { search: "x" }, true],
    ["search at maximum", { search: "x".repeat(100) }, true],
    ["search above maximum", { search: "x".repeat(101) }, false],
  ])("enforces %s", (_case, input, valid) => {
    expect(employeeListQuerySchema.safeParse(input).success).toBe(valid);
  });

  test.each(["ACTIVE", "ON_LEAVE", "INACTIVE"])("accepts status filter %s", (status) => {
    expect(employeeListQuerySchema.safeParse({ status }).success).toBe(true);
  });

  test.each(["active", "UNKNOWN", ""])("rejects status filter %s", (status) => {
    expect(employeeListQuerySchema.safeParse({ status }).success).toBe(false);
  });

  test.each(["fullName", "email", "jobTitle", "status", "salary", "hireDate"])(
    "accepts sort field %s",
    (sortBy) => {
      expect(employeeListQuerySchema.safeParse({ sortBy }).success).toBe(true);
    },
  );

  test.each(["name", "uuid", "createdAt", ""])("rejects sort field %s", (sortBy) => {
    expect(employeeListQuerySchema.safeParse({ sortBy }).success).toBe(false);
  });

  test.each(["asc", "desc"])("accepts sort order %s", (sortOrder) => {
    expect(employeeListQuerySchema.safeParse({ sortOrder }).success).toBe(true);
  });

  test.each(["ASC", "descending", ""])("rejects sort order %s", (sortOrder) => {
    expect(employeeListQuerySchema.safeParse({ sortOrder }).success).toBe(false);
  });

  test("rejects unknown list query keys", () => {
    expect(employeeListQuerySchema.safeParse({ limit: "10" }).success).toBe(false);
  });
});

describe("emptyExportQuerySchema", () => {
  test("accepts a queryless export", () => {
    expect(emptyExportQuerySchema.parse({})).toEqual({});
  });

  test.each([{ page: "1" }, { search: "Developer" }, { unknown: "value" }])(
    "rejects every supplied export query key %#",
    (input) => {
      expect(emptyExportQuerySchema.safeParse(input).success).toBe(false);
    },
  );
});

test("exports canonical inferred DTO types", () => {
  const created: CreateEmployeeDTO = parseCreate();
  const updated: UpdateEmployeeDTO = updateEmployeeSchema.parse({ fullName: "Updated Name" });
  const seed: CanonicalSeedEmployee = created;

  expect(created.email).toBe("employee@example.com");
  expect(updated).toEqual({ fullName: "Updated Name" });
  expect(seed.hireDate).toBe("2024-02-29");
});
