import express, { Router } from "express";
import multer from "multer";
import request from "supertest";
import { z } from "zod";

import type { AppDependencies } from "../../appDependencies";
import type { AppConfig } from "../../config/appConfig";
import type { Employee } from "../../domain/employee";
import { ApplicationError } from "../../errors/ApplicationError";
import { validatedHandler } from "../../http/validatedHandler";
import { serializeEmployee } from "../../serialization/employeeSerializer";

const testConfig: AppConfig = Object.freeze({
  databaseUrl: "postgresql://employee:secret@127.0.0.1:5432/employees",
  port: 4321,
  corsOrigin: "https://employees.example.com",
  nodeEnv: "test",
});

const domainEmployee: Employee = {
  id: "85c3a05e-bb06-4b2f-b6de-0d81da73120c",
  email: "joao.silva@example.com",
  fullName: "João Silva",
  jobTitle: "Developer",
  status: "ACTIVE",
  salary: "3500.00",
  hireDate: "2023-01-10",
  phone: "119999999",
  address: "Rua A",
  neighborhood: "Centro",
  postalCode: "14000-000",
  createdAt: new Date("2026-08-28T12:00:00.000Z"),
  updatedAt: new Date("2026-08-28T13:30:45.123Z"),
};

const expectedEmployee = {
  id: "85c3a05e-bb06-4b2f-b6de-0d81da73120c",
  email: "joao.silva@example.com",
  fullName: "João Silva",
  jobTitle: "Developer",
  status: "ACTIVE",
  salary: "3500.00",
  hireDate: "2023-01-10",
  phone: "119999999",
  address: "Rua A",
  neighborhood: "Centro",
  postalCode: "14000-000",
  createdAt: "2026-08-28T12:00:00.000Z",
  updatedAt: "2026-08-28T13:30:45.123Z",
};

const createTestDependencies = (
  readinessCheck: AppDependencies["readinessCheck"] = async () => undefined,
): AppDependencies => {
  const employeeRouter = Router();

  employeeRouter.get("/probe", (_request, response) => {
    response.status(200).json({ data: { router: "employee" } });
  });

  employeeRouter.get("/application-error", (_request, _response, next) => {
    next(
      new ApplicationError("EMAIL_CONFLICT", "Email is already in use.", [
        { path: "email", code: "duplicate", message: "Email is already in use." },
      ]),
    );
  });

  employeeRouter.get("/application-error-without-details", (_request, _response, next) => {
    next(new ApplicationError("EMPLOYEE_NOT_FOUND", "Employee not found."));
  });

  const validatedSchema = z
    .object({
      email: z
        .string()
        .trim()
        .email("Enter a valid email address.")
        .transform((value) => value.toLowerCase()),
    })
    .strict();

  employeeRouter.post(
    "/validated",
    validatedHandler(
      validatedSchema,
      (request) => request.body,
      async (input, _request, response) => {
        response.status(200).json({ data: input });
      },
    ),
  );

  const limitedUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 4 },
  });

  employeeRouter.post("/oversized", limitedUpload.single("file"), (_request, response) => {
    response.status(204).send();
  });

  return { employeeRouter, readinessCheck };
};

afterEach(() => {
  jest.restoreAllMocks();
  jest.dontMock("@prisma/client");
  jest.dontMock("../../app");
  jest.dontMock("../../appDependencies");
  jest.dontMock("../../config/appConfig");
  jest.dontMock("../../routes/EmployeeRoute");
  jest.dontMock("dotenv/config");
});

describe("application construction", () => {
  test("imports configuration and app modules without environment parsing or a listener", async () => {
    const listen = jest.spyOn(express.application, "listen");
    const parseEnvironment = jest.fn(() => {
      throw new Error("app import must not parse the environment");
    });
    jest.doMock("../../config/appConfig", () => ({ parseEnvironment }));

    await jest.isolateModulesAsync(async () => {
      await import("../../config/appConfig");
      const appModule = await import("../../app");
      expect(typeof appModule.createApp).toBe("function");
    });

    expect(parseEnvironment).not.toHaveBeenCalled();
    expect(listen).not.toHaveBeenCalled();
  });

  test("constructs with injected dependencies without production dependency creation or listening", async () => {
    const dependencyModule = await import("../../appDependencies");
    const productionDependencies = jest
      .spyOn(dependencyModule, "createProductionDependencies")
      .mockImplementation(() => {
        throw new Error("production dependencies must not be created");
      });
    const listen = jest.spyOn(express.application, "listen");
    const { createApp } = await import("../../app");

    const app = createApp(testConfig, createTestDependencies());
    await request(app)
      .get("/health/live")
      .expect(200, { data: { status: "ok" } });

    expect(productionDependencies).not.toHaveBeenCalled();
    expect(listen).not.toHaveBeenCalled();
  });

  test("uses only the configured CORS origin and keeps the employee router wired", async () => {
    const { createApp } = await import("../../app");
    const app = createApp(testConfig, createTestDependencies());

    await request(app)
      .get("/employees/probe")
      .set("Origin", testConfig.corsOrigin)
      .expect("access-control-allow-origin", testConfig.corsOrigin)
      .expect(200, { data: { router: "employee" } });
  });
});

describe("health routes", () => {
  test("reports liveness without invoking database readiness", async () => {
    const { createApp } = await import("../../app");
    const readinessCheck = jest.fn().mockRejectedValue(new Error("database unavailable"));
    const app = createApp(testConfig, createTestDependencies(readinessCheck));

    await request(app)
      .get("/health/live")
      .expect(200, { data: { status: "ok" } });
    expect(readinessCheck).not.toHaveBeenCalled();
  });

  test("reports readiness after the injected check succeeds", async () => {
    const { createApp } = await import("../../app");
    const readinessCheck = jest.fn().mockResolvedValue(undefined);
    const app = createApp(testConfig, createTestDependencies(readinessCheck));

    await request(app)
      .get("/health/ready")
      .expect(200, { data: { status: "ok" } });
    expect(readinessCheck).toHaveBeenCalledTimes(1);
  });

  test("reports a sanitized error when the injected readiness check fails", async () => {
    const { createApp } = await import("../../app");
    const readinessCheck = jest
      .fn()
      .mockRejectedValue(new Error("postgresql://admin:secret@database/private"));
    const app = createApp(testConfig, createTestDependencies(readinessCheck));

    const response = await request(app).get("/health/ready").expect(500);
    expect(response.body).toEqual({
      error: { code: "INTERNAL_ERROR", message: "Service is not ready." },
    });
    expect(response.text).not.toContain("postgresql");
    expect(response.text).not.toContain("secret");
  });
});

describe("global error responses", () => {
  test("translates malformed JSON into the stable 400 envelope", async () => {
    const { createApp } = await import("../../app");
    const app = createApp(testConfig, createTestDependencies());

    await request(app)
      .post("/employees/validated")
      .set("Content-Type", "application/json")
      .send('{"email":')
      .expect(400, {
        error: {
          code: "MALFORMED_JSON",
          message: "Request body is not valid JSON.",
        },
      });
  });

  test("translates unknown routes into the stable 404 envelope", async () => {
    const { createApp } = await import("../../app");
    const app = createApp(testConfig, createTestDependencies());

    await request(app)
      .get("/missing")
      .expect(404, {
        error: { code: "ROUTE_NOT_FOUND", message: "Route not found." },
      });
  });

  test("preserves structured ApplicationError details", async () => {
    const { createApp } = await import("../../app");
    const app = createApp(testConfig, createTestDependencies());

    await request(app)
      .get("/employees/application-error")
      .expect(409, {
        error: {
          code: "EMAIL_CONFLICT",
          message: "Email is already in use.",
          details: [{ path: "email", code: "duplicate", message: "Email is already in use." }],
        },
      });
  });

  test("omits details when an ApplicationError has none", async () => {
    const { createApp } = await import("../../app");
    const app = createApp(testConfig, createTestDependencies());

    await request(app)
      .get("/employees/application-error-without-details")
      .expect(404, {
        error: { code: "EMPLOYEE_NOT_FOUND", message: "Employee not found." },
      });
  });

  test("passes the parsed typed value directly to a validated action", async () => {
    const { createApp } = await import("../../app");
    const app = createApp(testConfig, createTestDependencies());

    await request(app)
      .post("/employees/validated")
      .send({ email: "  PERSON@EXAMPLE.COM  " })
      .expect(200, { data: { email: "person@example.com" } });
  });

  test("translates Zod issues into canonical structured details", async () => {
    const { createApp } = await import("../../app");
    const app = createApp(testConfig, createTestDependencies());

    await request(app)
      .post("/employees/validated")
      .send({ email: "not-an-email" })
      .expect(422, {
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed.",
          details: [
            {
              path: "email",
              code: "invalid_format",
              message: "Enter a valid email address.",
            },
          ],
        },
      });
  });

  test("translates Multer upload size failures into the stable 413 envelope", async () => {
    const { createApp } = await import("../../app");
    const app = createApp(testConfig, createTestDependencies());

    await request(app)
      .post("/employees/oversized")
      .attach("file", Buffer.from("12345"), "employees.xlsx")
      .expect(413, {
        error: {
          code: "PAYLOAD_TOO_LARGE",
          message: "Uploaded file exceeds the 5 MiB limit.",
        },
      });
  });

  test("logs unexpected failures server-side and exposes only a sanitized 500 envelope", async () => {
    const unexpectedError = new Error(
      "SELECT secret FROM Employee; PrismaClientKnownRequestError; D:\\private\\schema.prisma; DATABASE_URL=postgresql://admin:secret@database/private",
    );
    const employeeRouter = Router();
    employeeRouter.get("/unexpected", (_request, _response, next) => next(unexpectedError));
    const errorLog = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const { createApp } = await import("../../app");
    const app = createApp(testConfig, {
      employeeRouter,
      readinessCheck: async () => undefined,
    });

    const response = await request(app).get("/employees/unexpected").expect(500);

    expect(response.body).toEqual({
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected server error occurred.",
      },
    });
    expect(response.text).not.toMatch(/SELECT|Prisma|private|DATABASE_URL|secret|stack/i);
    expect(errorLog).toHaveBeenCalledWith("Unexpected application error.", unexpectedError);
  });
});

describe("canonical employee serialization", () => {
  test("serializes fixed salary, date-only hire date, and UTC timestamps", () => {
    expect(serializeEmployee(domainEmployee)).toEqual(expectedEmployee);
  });
});

describe("production dependencies", () => {
  test("uses an explicit database URL, the existing router, and only a lightweight readiness query", async () => {
    const queryRaw = jest.fn().mockResolvedValue([{ ready: 1 }]);
    const prismaClient = jest.fn().mockImplementation(() => ({ $queryRaw: queryRaw }));
    const employeeRouter = Router();

    jest.doMock("@prisma/client", () => ({ PrismaClient: prismaClient }));
    jest.doMock("../../routes/EmployeeRoute", () => ({
      __esModule: true,
      default: employeeRouter,
    }));

    await jest.isolateModulesAsync(async () => {
      const { createProductionDependencies } = await import("../../appDependencies");
      const dependencies = createProductionDependencies(testConfig);

      expect(prismaClient).toHaveBeenCalledTimes(1);
      expect(prismaClient).toHaveBeenCalledWith({ datasourceUrl: testConfig.databaseUrl });
      expect(dependencies.employeeRouter).toBe(employeeRouter);

      await dependencies.readinessCheck();
      expect(queryRaw).toHaveBeenCalledTimes(1);
      expect(queryRaw.mock.calls[0]?.[0]?.[0]).toBe("SELECT 1");
    });
  });
});

describe("server bootstrap", () => {
  test("parses the environment once, constructs the app once, and starts one listener", async () => {
    const on = jest.fn();
    const listen = jest.fn((_port: number, callback?: () => void) => {
      callback?.();
      return { on };
    });
    const parseEnvironment = jest.fn(() => testConfig);
    const createApp = jest.fn(() => ({ listen }));
    const startupLog = jest.spyOn(console, "info").mockImplementation(() => undefined);

    jest.doMock("dotenv/config", () => ({}));
    jest.doMock("../../config/appConfig", () => ({ parseEnvironment }));
    jest.doMock("../../app", () => ({ createApp }));

    await jest.isolateModulesAsync(async () => {
      await import("../../server");
    });

    expect(parseEnvironment).toHaveBeenCalledTimes(1);
    expect(parseEnvironment).toHaveBeenCalledWith(process.env);
    expect(createApp).toHaveBeenCalledTimes(1);
    expect(createApp).toHaveBeenCalledWith(testConfig);
    expect(listen).toHaveBeenCalledTimes(1);
    expect(listen).toHaveBeenCalledWith(testConfig.port, expect.any(Function));
    expect(on).toHaveBeenCalledWith("error", expect.any(Function));
    expect(startupLog).toHaveBeenCalledWith(`Server listening on port ${testConfig.port}.`);
  });

  test.each(["configuration", "dependency"])(
    "sets a non-zero exit status for a fatal %s failure without logging secrets",
    async (failurePoint) => {
      const secret = "DATABASE_URL=postgresql://admin:secret@database/private";
      const parseEnvironment = jest.fn(() => {
        if (failurePoint === "configuration") throw new Error(secret);
        return testConfig;
      });
      const createApp = jest.fn(() => {
        throw new Error(secret);
      });
      const errorLog = jest.spyOn(console, "error").mockImplementation(() => undefined);
      const previousExitCode = process.exitCode;
      process.exitCode = undefined;

      jest.doMock("dotenv/config", () => ({}));
      jest.doMock("../../config/appConfig", () => ({ parseEnvironment }));
      jest.doMock("../../app", () => ({ createApp }));

      try {
        await jest.isolateModulesAsync(async () => {
          await import("../../server");
        });

        expect(process.exitCode).toBe(1);
        expect(errorLog).toHaveBeenCalledWith("Server startup failed.");
        expect(JSON.stringify(errorLog.mock.calls)).not.toContain(secret);
      } finally {
        process.exitCode = previousExitCode;
      }
    },
  );

  test("sets a non-zero exit status for a listener failure without logging secrets", async () => {
    const secret = "DATABASE_URL=postgresql://admin:secret@database/private";
    let listenerError: ((error: Error) => void) | undefined;
    const on = jest.fn((event: string, callback: (error: Error) => void) => {
      if (event === "error") listenerError = callback;
    });
    const server = {
      on,
    };
    const listen = jest.fn(() => server);
    const parseEnvironment = jest.fn(() => testConfig);
    const createApp = jest.fn(() => ({ listen }));
    const errorLog = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const previousExitCode = process.exitCode;
    process.exitCode = undefined;

    jest.doMock("dotenv/config", () => ({}));
    jest.doMock("../../config/appConfig", () => ({ parseEnvironment }));
    jest.doMock("../../app", () => ({ createApp }));

    try {
      await jest.isolateModulesAsync(async () => {
        await import("../../server");
      });
      expect(listenerError).toBeDefined();

      listenerError?.(new Error(secret));

      expect(process.exitCode).toBe(1);
      expect(errorLog).toHaveBeenCalledWith("Server startup failed.");
      expect(JSON.stringify(errorLog.mock.calls)).not.toContain(secret);
    } finally {
      process.exitCode = previousExitCode;
    }
  });
});
