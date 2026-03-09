import { prisma } from "../utils/prisma";
import { Prisma } from "@prisma/client";

export class EmployeeRepository {

  async create(data: Prisma.EmployeeCreateInput) {
    return prisma.employee.create({
      data
    });
  }

  async findById(uuid: string) {
    return prisma.employee.findUnique({
      where: { uuid }
    });
  }

  async findAll(params: {
    skip?: number;
    take?: number;
    where?: Prisma.EmployeeWhereInput;
    orderBy?: Prisma.EmployeeOrderByWithRelationInput;
  }) {

    const [data, total] = await Promise.all([
      prisma.employee.findMany({
        skip: params.skip,
        take: params.take,
        where: params.where,
        orderBy: params.orderBy
      }),
      prisma.employee.count({
        where: params.where
      })
    ]);

    return { data, total };
  }

  async update(uuid: string, data: Prisma.EmployeeUpdateInput) {
    return prisma.employee.update({
      where: { uuid },
      data
    });
  }

  async delete(uuid: string) {
    return prisma.employee.delete({
      where: { uuid }
    });
  }
}