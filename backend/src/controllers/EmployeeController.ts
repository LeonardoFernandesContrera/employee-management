import type { RequestHandler } from "express";

import { ApplicationError } from "../errors/ApplicationError";
import type { ValidatedAction } from "../http/validatedHandler";
import { serializeEmployee } from "../serialization/employeeSerializer";
import { EmployeeService } from "../services/EmployeeService";
import { XLSX_MIME_TYPE } from "../utils/upload";
import type {
  CreateEmployeeDTO,
  EmployeeIdParams,
  EmployeeListQueryDTO,
  UpdateEmployeeRouteDTO,
} from "../validation/employeeSchemas";
import { EmployeeWorkbook } from "../xlsx/employeeWorkbook";

export interface EmployeeController {
  create: ValidatedAction<CreateEmployeeDTO>;
  findAll: ValidatedAction<EmployeeListQueryDTO>;
  findById: ValidatedAction<EmployeeIdParams>;
  update: ValidatedAction<UpdateEmployeeRouteDTO>;
  delete: ValidatedAction<EmployeeIdParams>;
  import: RequestHandler;
  export: ValidatedAction<Record<string, never>>;
}

export function createEmployeeController(
  service: EmployeeService,
  workbook: EmployeeWorkbook,
): EmployeeController {
  return {
    create: async (input, _request, response) => {
      const employee = await service.create(input);
      response.status(201).json({ data: serializeEmployee(employee) });
    },
    findAll: async (input, _request, response) => {
      const result = await service.findAll(input);
      response.status(200).json({
        data: result.data.map(serializeEmployee),
        meta: result.meta,
      });
    },
    findById: async ({ id }, _request, response) => {
      response.status(200).json({ data: serializeEmployee(await service.findById(id)) });
    },
    update: async ({ params, body }, _request, response) => {
      response.status(200).json({
        data: serializeEmployee(await service.update(params.id, body)),
      });
    },
    delete: async ({ id }, _request, response) => {
      await service.delete(id);
      response.status(204).send();
    },
    import: async (request, response, next) => {
      try {
        if (!request.file) {
          throw new ApplicationError("VALIDATION_ERROR", "Request validation failed.", [
            { path: "file", code: "required", message: "An XLSX file is required." },
          ]);
        }
        response.status(200).json({ data: await workbook.importFile(request.file) });
      } catch (error) {
        next(error);
      }
    },
    export: async (_input, _request, response) => {
      const buffer = await workbook.exportAll();
      response.setHeader("Content-Disposition", "attachment; filename=employees.xlsx");
      response.setHeader("Content-Type", XLSX_MIME_TYPE);
      response.status(200).send(buffer);
    },
  };
}
