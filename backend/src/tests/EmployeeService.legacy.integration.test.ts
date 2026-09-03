import { CreateEmployeeDTO } from "../dtos/EmployeeDTO";
import { EmployeeService } from "../services/EmployeeService";

const service = new EmployeeService();

describe("EmployeeService", () => {

  test("should create employee successfully", async () => {

    const data = {
      name: "John Doe",
      address: "Street 1",
      neighborhood: "Centro",
      zipcode: "12345-000",
      phone: "11999999999",
      salary: 5000,
      contract_date: "2023-01-10",
      role: "Developer",
      status: "active"
    };

    const result = await service.create(data);

    expect(result).toHaveProperty("uuid");
    expect(result.name).toBe("John Doe");

  });

  test("should throw error if name is missing", async () => {

    const data = {
      salary: 5000,
      contract_date: "2023-01-10"
    };

    await expect(service.create(data as CreateEmployeeDTO)).rejects.toThrow("Name is required");

  });

});
