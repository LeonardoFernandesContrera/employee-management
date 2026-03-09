import { EmployeeRepository } from "../repositories/EmployeeRepository";
import * as XLSX from "xlsx";
import {
  CreateEmployeeDTO,
  UpdateEmployeeDTO,
  EmployeeQueryDTO,
  ImportEmployeeRowDTO
} from "../dtos/EmployeeDTO";

export class EmployeeService {

  private repository = new EmployeeRepository();

  async create(data: CreateEmployeeDTO) {

    if (!data.name) {
      throw new Error("Name is required");
    }

    if (!data.salary) {
      throw new Error("Salary is required");
    }

    if (!data.contract_date) {
      throw new Error("Contract date is required");
    }

    const contractDate = new Date(data.contract_date);

    if (isNaN(contractDate.getTime())) {
      throw new Error("Invalid contract date");
    }

    return this.repository.create({
      ...data,
      contract_date: new Date(data.contract_date)
    });
  }

  async findById(uuid: string) {

    const employee = await this.repository.findById(uuid);

    if (!employee) {
      throw new Error("Employee not found");
    }

    return employee;
  }

  async findAll(query: EmployeeQueryDTO) {

    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;

    const skip = (page - 1) * limit;

    const where: {
      name?: { contains: string };
      role?: string;
      status?: string;
    } = {};

    if (query.name) {
      where.name = {
        contains: query.name
      };
    }

    if (query.role) {
      where.role = query.role;
    }

    if (query.status) {
      where.status = query.status;
    }

    const orderBy = query.sort
      ? { [query.sort]: "asc" }
      : undefined;

    const result = await this.repository.findAll({
      skip,
      take: limit,
      where,
      orderBy
    });

    return {
      data: result.data,
      meta: {
        total: result.total,
        page,
        totalPages: Math.ceil(result.total / limit)
      }
    };
  }

  async update(uuid: string, data: UpdateEmployeeDTO) {

    await this.findById(uuid);

    return this.repository.update(uuid, data);
  }

  async delete(uuid: string) {

    await this.findById(uuid);

    return this.repository.delete(uuid);
  }

  async importEmployees(file: Express.Multer.File) {

    if (!file) {
        throw new Error("File is required");
    }

    const isXlsx =
      file.mimetype ===
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" 
        && file.originalname.endsWith(".xlsx");

    const validMimeTypes = ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"];

    const extension = file.originalname.split(".").pop()?.toLowerCase();

    if (!validMimeTypes.includes(file.mimetype) || extension !== "xlsx") {
      throw new Error("Invalid file format. Only XLSX is allowed.");
    }

    const workbook = XLSX.read(file.buffer, {
      type: "buffer"
    });

    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    const rows = XLSX.utils.sheet_to_json<ImportEmployeeRowDTO>(sheet);

    let total = rows.length;
    let inserted = 0;
    let rejected = 0;

    for (const row of rows) {

        if (
        !row.name ||
        !row.address ||
        !row.salary ||
        !row.contract_date ||
        !row.role ||
        !row.status
        ) {
        rejected++;
        continue;
        }

        try {

        await this.repository.create({
            name: row.name,
            address: row.address,
            neighborhood: row.neighborhood,
            zipcode: row.zipcode,
            phone: row.phone,
            salary: Number(row.salary),
            contract_date: new Date(row.contract_date),
            role: row.role,
            status: row.status
        });

        inserted++;

        } catch {
        rejected++;
        }
    }

    return {
        total,
        inseridos: inserted,
        rejeitados: rejected
    };
  }

  async exportEmployees(query: EmployeeQueryDTO) {

    const where: {
      name?: { contains: string };
      role?: string;
      status?: string;
    } = {};

    if (query.name) {
      where.name = { contains: query.name };
    }

    if (query.role) {
      where.role = query.role;
    }

    if (query.status) {
      where.status = query.status;
    }

    const employees = await this.repository.findAll({
      where
    });

    const data = employees.data.map((emp) => ({
      uuid: emp.uuid,
      name: emp.name,
      address: emp.address,
      neighborhood: emp.neighborhood,
      zipcode: emp.zipcode,
      phone: emp.phone,

      salary: emp.salary ? Number(emp.salary) : null,

      contract_date: emp.contract_date
        ? new Date(emp.contract_date).toISOString().split("T")[0]
        : null,

      role: emp.role,
      status: emp.status,

      created_at: emp.created_at
        ? new Date(emp.created_at).toISOString()
        : null,

      updated_at: emp.updated_at
        ? new Date(emp.updated_at).toISOString()
        : null
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);

    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "Employees");

    return XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx"
    });
  }
}