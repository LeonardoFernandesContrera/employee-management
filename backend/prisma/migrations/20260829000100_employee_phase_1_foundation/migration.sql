BEGIN;

LOCK TABLE "Employee" IN ACCESS EXCLUSIVE MODE;

DO $employee_preflight$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Employee"
    WHERE "uuid" = ''
       OR "uuid" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ) THEN
    RAISE EXCEPTION 'Employee migration preflight failed: invalid uuid';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "Employee" WHERE length(btrim("name")) NOT BETWEEN 1 AND 120
  ) THEN
    RAISE EXCEPTION 'Employee migration preflight failed: invalid name';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "Employee" WHERE length(btrim("role")) NOT BETWEEN 1 AND 120
  ) THEN
    RAISE EXCEPTION 'Employee migration preflight failed: invalid role';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "Employee"
    WHERE upper(btrim("status")) NOT IN ('ACTIVE', 'ON_LEAVE', 'INACTIVE')
  ) THEN
    RAISE EXCEPTION 'Employee migration preflight failed: invalid status';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "Employee"
    WHERE "salary" <= 0
       OR "salary" > 9999999999.99
       OR "salary" <> round("salary", 2)
  ) THEN
    RAISE EXCEPTION 'Employee migration preflight failed: invalid salary';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "Employee"
    WHERE NOT isfinite("contract_date")
       OR "contract_date"::date NOT BETWEEN DATE '0001-01-01' AND DATE '9999-12-31'
  ) THEN
    RAISE EXCEPTION 'Employee migration preflight failed: invalid contract_date';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "Employee"
    WHERE "phone" IS NOT NULL
      AND btrim("phone") <> ''
      AND length(btrim("phone")) > 30
  ) THEN
    RAISE EXCEPTION 'Employee migration preflight failed: invalid phone';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "Employee"
    WHERE "address" IS NOT NULL
      AND btrim("address") <> ''
      AND length(btrim("address")) > 200
  ) THEN
    RAISE EXCEPTION 'Employee migration preflight failed: invalid address';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "Employee"
    WHERE "neighborhood" IS NOT NULL
      AND btrim("neighborhood") <> ''
      AND length(btrim("neighborhood")) > 100
  ) THEN
    RAISE EXCEPTION 'Employee migration preflight failed: invalid neighborhood';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "Employee"
    WHERE "zipcode" IS NOT NULL
      AND btrim("zipcode") <> ''
      AND length(btrim("zipcode")) > 20
  ) THEN
    RAISE EXCEPTION 'Employee migration preflight failed: invalid zipcode';
  END IF;
END
$employee_preflight$;

CREATE TYPE "EmployeeStatus" AS ENUM ('ACTIVE', 'ON_LEAVE', 'INACTIVE');

ALTER TABLE "Employee" ADD COLUMN "email" TEXT;

WITH legacy_fingerprints (
  seed_key,
  "name",
  "address",
  "neighborhood",
  "zipcode",
  "phone",
  "salary",
  "contract_date",
  "role",
  "status",
  canonical_email
) AS (
  VALUES
    ('joao-silva', 'João Silva', 'Rua A', 'Centro', '14000-000', '119999999', 3500::decimal, timestamp '2023-01-10 00:00:00.000', 'Developer', 'active', 'joao.silva@example.com'),
    ('maria-souza', 'Maria Souza', 'Rua B', 'Jardim Paulista', '14000-001', '119999998', 4200::decimal, timestamp '2022-03-15 00:00:00.000', 'Designer', 'active', 'maria.souza@example.com'),
    ('carlos-lima', 'Carlos Lima', 'Rua C', 'Centro', '14000-002', '119999997', 5000::decimal, timestamp '2021-07-20 00:00:00.000', 'Manager', 'active', 'carlos.lima@example.com'),
    ('ana-costa', 'Ana Costa', 'Rua D', 'Vila Tibério', '14000-003', '119999996', 3200::decimal, timestamp '2023-05-01 00:00:00.000', 'Developer', 'inactive', 'ana.costa@example.com'),
    ('pedro-santos', 'Pedro Santos', 'Rua E', 'Campos Eliseos', '14000-004', '119999995', 4500::decimal, timestamp '2022-09-10 00:00:00.000', 'QA', 'active', 'pedro.santos@example.com'),
    ('lucas-pereira', 'Lucas Pereira', 'Rua F', 'Centro', '14000-005', '119999994', 3900::decimal, timestamp '2022-11-02 00:00:00.000', 'Developer', 'active', 'lucas.pereira@example.com'),
    ('fernanda-alves', 'Fernanda Alves', 'Rua G', 'Ipiranga', '14000-006', '119999993', 4100::decimal, timestamp '2021-04-12 00:00:00.000', 'Product Owner', 'active', 'fernanda.alves@example.com'),
    ('ricardo-gomes', 'Ricardo Gomes', 'Rua H', 'Centro', '14000-007', '119999992', 3800::decimal, timestamp '2020-06-30 00:00:00.000', 'Support', 'active', 'ricardo.gomes@example.com'),
    ('juliana-rocha', 'Juliana Rocha', 'Rua I', 'Jardim Paulista', '14000-008', '119999991', 4600::decimal, timestamp '2021-08-21 00:00:00.000', 'Developer', 'active', 'juliana.rocha@example.com'),
    ('bruno-martins', 'Bruno Martins', 'Rua J', 'Centro', '14000-009', '119999990', 3700::decimal, timestamp '2022-12-01 00:00:00.000', 'QA', 'inactive', 'bruno.martins@example.com')
),
ranked_fingerprints AS (
  SELECT
    employee."uuid",
    fingerprint.canonical_email,
    row_number() OVER (
      PARTITION BY fingerprint.seed_key
      ORDER BY employee."uuid" COLLATE "C" ASC
    ) AS fingerprint_rank
  FROM "Employee" AS employee
  JOIN legacy_fingerprints AS fingerprint
    ON employee."name" IS NOT DISTINCT FROM fingerprint."name"
   AND employee."address" IS NOT DISTINCT FROM fingerprint."address"
   AND employee."neighborhood" IS NOT DISTINCT FROM fingerprint."neighborhood"
   AND employee."zipcode" IS NOT DISTINCT FROM fingerprint."zipcode"
   AND employee."phone" IS NOT DISTINCT FROM fingerprint."phone"
   AND employee."salary" IS NOT DISTINCT FROM fingerprint."salary"
   AND employee."contract_date" IS NOT DISTINCT FROM fingerprint."contract_date"
   AND employee."role" IS NOT DISTINCT FROM fingerprint."role"
   AND employee."status" IS NOT DISTINCT FROM fingerprint."status"
)
UPDATE "Employee" AS employee
SET "email" = CASE
  WHEN ranked.fingerprint_rank = 1 THEN ranked.canonical_email
  ELSE 'legacy+' || lower(employee."uuid") || '@example.com'
END
FROM ranked_fingerprints AS ranked
WHERE employee."uuid" = ranked."uuid";

UPDATE "Employee"
SET "email" = 'legacy+' || lower("uuid") || '@example.com'
WHERE "email" IS NULL;

ALTER TABLE "Employee" ALTER COLUMN "address" DROP NOT NULL;

UPDATE "Employee"
SET
  "name" = btrim("name"),
  "role" = btrim("role"),
  "phone" = NULLIF(btrim("phone"), ''),
  "address" = NULLIF(btrim("address"), ''),
  "neighborhood" = NULLIF(btrim("neighborhood"), ''),
  "zipcode" = NULLIF(btrim("zipcode"), '');

ALTER TABLE "Employee"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "salary" DROP DEFAULT,
  ALTER COLUMN "contract_date" DROP DEFAULT;

ALTER TABLE "Employee"
  ALTER COLUMN "status" TYPE "EmployeeStatus"
    USING upper(btrim("status"))::"EmployeeStatus",
  ALTER COLUMN "salary" TYPE DECIMAL(12, 2)
    USING "salary"::DECIMAL(12, 2),
  ALTER COLUMN "contract_date" TYPE DATE
    USING "contract_date"::date,
  ALTER COLUMN "email" SET NOT NULL;

ALTER TABLE "Employee"
  ADD CONSTRAINT "Employee_email_normalized_check"
    CHECK ("email" = lower(btrim("email"))),
  ADD CONSTRAINT "Employee_salary_positive_check"
    CHECK ("salary" > 0);

CREATE UNIQUE INDEX "Employee_email_key" ON "Employee"("email");
CREATE INDEX "Employee_status_idx" ON "Employee"("status");

COMMIT;
