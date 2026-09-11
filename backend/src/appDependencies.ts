import type { Router } from "express";

import type { AppConfig } from "./config/appConfig";
import { createEmployeeController } from "./controllers/EmployeeController";
import { createPrismaClient } from "./database/prisma";
import { PrismaEmployeeRepository } from "./repositories/EmployeeRepository";
import employeeRouterFactory from "./routes/EmployeeRoute";
import { EmployeeService } from "./services/EmployeeService";
import { EmployeeWorkbook } from "./xlsx/employeeWorkbook";

export interface AppDependencies {
  readonly employeeRouter: Router;
  readonly readinessCheck: () => Promise<void>;
}

export function createProductionDependencies(config: AppConfig): AppDependencies {
  const prisma = createPrismaClient(config.databaseUrl);
  const repository = new PrismaEmployeeRepository(prisma);
  const service = new EmployeeService(repository);
  const workbook = new EmployeeWorkbook(service);
  const controller = createEmployeeController(service, workbook);
  const routerCandidate = employeeRouterFactory as typeof employeeRouterFactory | Router;
  const employeeRouter = "route" in routerCandidate ? routerCandidate : routerCandidate(controller);

  return {
    employeeRouter,
    readinessCheck: async () => {
      await prisma.$queryRaw`SELECT 1`;
    },
  };
}
