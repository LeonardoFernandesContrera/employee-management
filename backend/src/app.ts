import express, { type Express } from "express";
import cors from "cors";

import { createProductionDependencies, type AppDependencies } from "./appDependencies";
import type { AppConfig } from "./config/appConfig";
import { ApplicationError } from "./errors/ApplicationError";
import { errorMiddleware } from "./middlewares/ErrorMiddleware";
import { createHealthRouter } from "./routes/HealthRoute";

export function createApp(
  config: AppConfig,
  dependencies: AppDependencies = createProductionDependencies(config),
): Express {
  const app = express();

  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json());

  app.use("/health", createHealthRouter(dependencies.readinessCheck));
  app.use("/employees", dependencies.employeeRouter);

  app.use((_request, _response, next) => {
    next(new ApplicationError("ROUTE_NOT_FOUND", "Route not found."));
  });

  app.use(errorMiddleware);

  return app;
}
