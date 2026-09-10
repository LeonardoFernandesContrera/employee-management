import { PrismaClient } from "@prisma/client";
import type { Router } from "express";

import type { AppConfig } from "./config/appConfig";
import employeeRouter from "./routes/EmployeeRoute";

export interface AppDependencies {
  readonly employeeRouter: Router;
  readonly readinessCheck: () => Promise<void>;
}

export function createProductionDependencies(config: AppConfig): AppDependencies {
  const readinessClient = new PrismaClient({ datasourceUrl: config.databaseUrl });

  return {
    employeeRouter,
    readinessCheck: async () => {
      await readinessClient.$queryRaw`SELECT 1`;
    },
  };
}
