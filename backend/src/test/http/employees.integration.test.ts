import request from "supertest";
import * as XLSX from "xlsx";

import { createApp } from "../../app";
import type { AppConfig } from "../../config/appConfig";
import { createEmployeeController } from "../../controllers/EmployeeController";
import { createPrismaClient } from "../../database/prisma";
import { PrismaEmployeeRepository } from "../../repositories/EmployeeRepository";
import { createEmployeeRouter } from "../../routes/EmployeeRoute";
import { EmployeeService } from "../../services/EmployeeService";
import { EmployeeWorkbook } from "../../xlsx/employeeWorkbook";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for employee HTTP integration tests.");

const config: AppConfig = Object.freeze({
  databaseUrl,
  port: 4321,
  corsOrigin: "https://employees.example.com",
  nodeEnv: "test",
});
const client = createPrismaClient(databaseUrl);
const repository = new PrismaEmployeeRepository(client);
const service = new EmployeeService(repository);
const workbook = new EmployeeWorkbook(service);
const controller = createEmployeeController(service, workbook);
const app = createApp(config, {
  employeeRouter: createEmployeeRouter(controller),
  readinessCheck: async () => undefined,
});
const suffix = "@task7.http.test";

const payload = (sequence: number) => ({
  email: `person-${sequence}${suffix}`,
  fullName: `Person ${sequence}`,
  jobTitle: sequence % 2 === 0 ? "Developer" : "Designer",
  status: sequence % 2 === 0 ? "ACTIVE" : "INACTIVE",
  salary: `${3000 + sequence}.00`,
  hireDate: `2024-01-${sequence.toString().padStart(2, "0")}`,
  phone: null,
  address: null,
  neighborhood: null,
  postalCode: null,
});

const cleanup = () => client.employee.deleteMany({ where: { email: { endsWith: suffix } } });

beforeEach(cleanup);

afterAll(async () => {
  await cleanup();
  await client.$disconnect();
});

describe("employee CRUD HTTP contract", () => {
  test("creates a normalized employee in the canonical envelope", async () => {
    const response = await request(app)
      .post("/employees")
      .send({ ...payload(1), email: `  PERSON-1${suffix.toUpperCase()}  ` })
      .expect(201);

    expect(response.body.data).toMatchObject({
      email: `person-1${suffix}`,
      fullName: "Person 1",
      salary: "3001.00",
      hireDate: "2024-01-01",
    });
    expect(response.body.data.createdAt).toMatch(/Z$/u);
  });

  test("returns canonical validation and email-conflict failures", async () => {
    await request(app).post("/employees").send(payload(1)).expect(201);
    await request(app)
      .post("/employees")
      .send({ ...payload(2), email: payload(1).email })
      .expect(409, {
        error: { code: "EMAIL_CONFLICT", message: "Email is already in use." },
      });

    const invalid = await request(app)
      .post("/employees")
      .send({ ...payload(3), unknown: true })
      .expect(422);
    expect(invalid.body.error).toMatchObject({ code: "VALIDATION_ERROR" });

    const second = await request(app).post("/employees").send(payload(2)).expect(201);
    await request(app)
      .patch(`/employees/${second.body.data.id as string}`)
      .send({ email: payload(1).email })
      .expect(409, {
        error: { code: "EMAIL_CONFLICT", message: "Email is already in use." },
      });
  });

  test("lists with normalized pagination, search, filtering and stable sorting metadata", async () => {
    await Promise.all([
      request(app)
        .post("/employees")
        .send({ ...payload(1), fullName: "Zulu" })
        .expect(201),
      request(app)
        .post("/employees")
        .send({ ...payload(2), fullName: "Alpha" })
        .expect(201),
      request(app)
        .post("/employees")
        .send({ ...payload(3), fullName: "Beta", jobTitle: "Search Needle", status: "ACTIVE" })
        .expect(201),
    ]);

    const page = await request(app)
      .get("/employees")
      .query({ page: "1", pageSize: "1", search: "needle", status: "ACTIVE" })
      .expect(200);
    expect(page.body).toMatchObject({
      data: [{ fullName: "Beta" }],
      meta: {
        page: 1,
        pageSize: 1,
        totalItems: 1,
        totalPages: 1,
        sortBy: "fullName",
        sortOrder: "asc",
      },
    });

    const outside = await request(app)
      .get("/employees")
      .query({ page: 99, pageSize: 10, sortBy: "salary", sortOrder: "desc" })
      .expect(200);
    expect(outside.body.data).toEqual([]);
    expect(outside.body.meta).toMatchObject({ page: 99, totalItems: 3, totalPages: 1 });
  });

  test("retrieves, patches and deletes by UUID without exposing a PUT route", async () => {
    const created = await request(app).post("/employees").send(payload(1)).expect(201);
    const id = created.body.data.id as string;

    await request(app).get(`/employees/${id}`).expect(200, created.body);
    const updated = await request(app)
      .patch(`/employees/${id}`)
      .send({ fullName: "Updated", phone: " " })
      .expect(200);
    expect(updated.body.data).toMatchObject({ fullName: "Updated", phone: null });

    await request(app).patch(`/employees/${id}`).send({}).expect(422);
    await request(app).get("/employees/not-a-uuid").expect(422);
    await request(app)
      .get("/employees/00000000-0000-4000-8000-000000000000")
      .expect(404, { error: { code: "EMPLOYEE_NOT_FOUND", message: "Employee not found." } });
    await request(app).put(`/employees/${id}`).send({ fullName: "No PUT" }).expect(404);

    await request(app).delete(`/employees/${id}`).expect(204);
    await request(app).delete(`/employees/${id}`).expect(404);
  });
});

describe("static XLSX HTTP routes", () => {
  test("routes export before dynamic IDs and strictly rejects every export query", async () => {
    await request(app).post("/employees").send(payload(1)).expect(201);
    const exported = await request(app)
      .get("/employees/export")
      .expect("content-type", /spreadsheetml/u)
      .expect("content-disposition", "attachment; filename=employees.xlsx")
      .expect(200);
    expect(exported.headers["content-length"]).toBeDefined();

    for (const query of [
      "page=1",
      "pageSize=10",
      "search=person",
      "status=ACTIVE",
      "sortBy=fullName",
      "sortOrder=asc",
    ]) {
      await request(app).get(`/employees/export?${query}`).expect(422);
    }
    const invalidId = await request(app).get("/employees/not-a-uuid").expect(422);
    expect(invalidId.body.error.details[0]?.path).toBe("id");
  });

  test("routes import statically and reports missing or unsupported files canonically", async () => {
    const missing = await request(app).post("/employees/import").expect(422);
    expect(missing.body).toMatchObject({
      error: {
        code: "VALIDATION_ERROR",
        details: [expect.objectContaining({ path: "file" })],
      },
    });
    await request(app)
      .post("/employees/import")
      .attach("file", Buffer.from("email"), "employees.csv")
      .expect(415);

    const sheet = XLSX.utils.json_to_sheet([payload(1)]);
    const xlsx = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(xlsx, sheet, "Employees");
    const imported = await request(app)
      .post("/employees/import")
      .attach("file", XLSX.write(xlsx, { type: "buffer", bookType: "xlsx" }), {
        filename: "employees.xlsx",
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      })
      .expect(200);
    expect(imported.body).toEqual({ data: { total: 1, inserted: 1, rejected: 0 } });
  });
});
