import { Router } from "express";

import type { EmployeeController } from "../controllers/EmployeeController";
import { validatedHandler } from "../http/validatedHandler";
import { upload } from "../utils/upload";
import {
  createEmployeeSchema,
  employeeIdParamsSchema,
  employeeListQuerySchema,
  emptyExportQuerySchema,
  updateEmployeeRouteSchema,
} from "../validation/employeeSchemas";

export function createEmployeeRouter(controller: EmployeeController): Router {
  const router = Router();
  router.post("/import", upload.single("file"), controller.import);
  router.get(
    "/export",
    validatedHandler(emptyExportQuerySchema, (request) => request.query, controller.export),
  );
  router.post(
    "/",
    validatedHandler(createEmployeeSchema, (request) => request.body, controller.create),
  );
  router.get(
    "/",
    validatedHandler(employeeListQuerySchema, (request) => request.query, controller.findAll),
  );
  router.get(
    "/:id",
    validatedHandler(employeeIdParamsSchema, (request) => request.params, controller.findById),
  );
  router.patch(
    "/:id",
    validatedHandler(
      updateEmployeeRouteSchema,
      (request) => ({ params: request.params, body: request.body }),
      controller.update,
    ),
  );
  router.delete(
    "/:id",
    validatedHandler(employeeIdParamsSchema, (request) => request.params, controller.delete),
  );
  return router;
}

export default createEmployeeRouter;
