import { Request, Response, NextFunction } from "express";
import { EmployeeService } from "../services/EmployeeService";
import { CreateEmployeeDTO, UpdateEmployeeDTO } from "../dtos/EmployeeDTO";

const service = new EmployeeService();

export default {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const employee = await service.create(req.body as CreateEmployeeDTO);

      return res.status(201).json(employee);
    } catch (err) {
      next(err);
    }
  },

  async findAll(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await service.findAll(req.query);

      return res.json(result);
    } catch (err) {
      next(err);
    }
  },

  async findById(req: Request, res: Response, next: NextFunction) {
    try {
      const employee = await service.findById(req.params.uuid as string);

      return res.json(employee);
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const employee = await service.update(
        req.params.uuid as string,
        req.body as UpdateEmployeeDTO,
      );

      return res.json(employee);
    } catch (err) {
      next(err);
    }
  },

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await service.delete(req.params.uuid as string);

      return res.status(204).send();
    } catch (err) {
      next(err);
    }
  },

  async import(req: Request, res: Response, next: NextFunction) {
    try {
      const file = req.file as Express.Multer.File;

      if (!file) {
        throw new Error("File is required");
      }

      const result = await service.importEmployees(file);

      return res.json(result);
    } catch (err) {
      next(err);
    }
  },

  async export(req: Request, res: Response, next: NextFunction) {
    try {
      const buffer = await service.exportEmployees(req.query);

      res.setHeader("Content-Disposition", "attachment; filename=employees.xlsx");

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );

      return res.send(buffer);
    } catch (err) {
      next(err);
    }
  },
};
