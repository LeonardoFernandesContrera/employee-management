import { Router } from "express";

import { ApplicationError } from "../errors/ApplicationError";

export function createHealthRouter(readinessCheck: () => Promise<void>): Router {
  const router = Router();

  router.get("/live", (_request, response) => {
    response.status(200).json({ data: { status: "ok" } });
  });

  router.get("/ready", async (_request, response, next) => {
    try {
      await readinessCheck();
      response.status(200).json({ data: { status: "ok" } });
    } catch {
      next(new ApplicationError("INTERNAL_ERROR", "Service is not ready."));
    }
  });

  return router;
}
