-- CreateTable
CREATE TABLE "Employee" (
    "uuid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "neighborhood" TEXT,
    "zipcode" TEXT,
    "phone" TEXT,
    "salary" DECIMAL(65,30) NOT NULL,
    "contract_date" TIMESTAMP(3) NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("uuid")
);
