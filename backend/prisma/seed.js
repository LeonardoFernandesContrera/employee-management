"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    await prisma.employee.createMany({
        data: [
            {
                name: "João Silva",
                address: "Rua A",
                neighborhood: "Centro",
                zipcode: "14000-000",
                phone: "119999999",
                salary: 3500,
                contract_date: new Date("2023-01-10"),
                role: "Developer",
                status: "active"
            },
            {
                name: "Maria Souza",
                address: "Rua B",
                neighborhood: "Jardim Paulista",
                zipcode: "14000-001",
                phone: "119999998",
                salary: 4200,
                contract_date: new Date("2022-03-15"),
                role: "Designer",
                status: "active"
            },
            {
                name: "Carlos Lima",
                address: "Rua C",
                neighborhood: "Centro",
                zipcode: "14000-002",
                phone: "119999997",
                salary: 5000,
                contract_date: new Date("2021-07-20"),
                role: "Manager",
                status: "active"
            },
            {
                name: "Ana Costa",
                address: "Rua D",
                neighborhood: "Vila Tibério",
                zipcode: "14000-003",
                phone: "119999996",
                salary: 3200,
                contract_date: new Date("2023-05-01"),
                role: "Developer",
                status: "inactive"
            },
            {
                name: "Pedro Santos",
                address: "Rua E",
                neighborhood: "Campos Eliseos",
                zipcode: "14000-004",
                phone: "119999995",
                salary: 4500,
                contract_date: new Date("2022-09-10"),
                role: "QA",
                status: "active"
            },
            {
                name: "Lucas Pereira",
                address: "Rua F",
                neighborhood: "Centro",
                zipcode: "14000-005",
                phone: "119999994",
                salary: 3900,
                contract_date: new Date("2022-11-02"),
                role: "Developer",
                status: "active"
            },
            {
                name: "Fernanda Alves",
                address: "Rua G",
                neighborhood: "Ipiranga",
                zipcode: "14000-006",
                phone: "119999993",
                salary: 4100,
                contract_date: new Date("2021-04-12"),
                role: "Product Owner",
                status: "active"
            },
            {
                name: "Ricardo Gomes",
                address: "Rua H",
                neighborhood: "Centro",
                zipcode: "14000-007",
                phone: "119999992",
                salary: 3800,
                contract_date: new Date("2020-06-30"),
                role: "Support",
                status: "active"
            },
            {
                name: "Juliana Rocha",
                address: "Rua I",
                neighborhood: "Jardim Paulista",
                zipcode: "14000-008",
                phone: "119999991",
                salary: 4600,
                contract_date: new Date("2021-08-21"),
                role: "Developer",
                status: "active"
            },
            {
                name: "Bruno Martins",
                address: "Rua J",
                neighborhood: "Centro",
                zipcode: "14000-009",
                phone: "119999990",
                salary: 3700,
                contract_date: new Date("2022-12-01"),
                role: "QA",
                status: "inactive"
            }
        ]
    });
    console.log("Seed executed successfully.");
}
main()
    .catch((e) => {
    console.error(e);
})
    .finally(async () => {
    await prisma.$disconnect();
});
