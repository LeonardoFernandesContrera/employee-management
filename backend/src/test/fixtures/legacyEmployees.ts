import type { CanonicalEmployeeState } from "../support/legacyDatabase";

export type LegacySeedKey =
  | "joao-silva"
  | "maria-souza"
  | "carlos-lima"
  | "ana-costa"
  | "pedro-santos"
  | "lucas-pereira"
  | "fernanda-alves"
  | "ricardo-gomes"
  | "juliana-rocha"
  | "bruno-martins";

export interface LegacyEmployeeFixture {
  readonly uuid: string;
  readonly name: string;
  readonly address: string;
  readonly neighborhood: string | null;
  readonly zipcode: string | null;
  readonly phone: string | null;
  readonly salary: string;
  readonly contractDate: string;
  readonly role: string;
  readonly status: string;
}

export interface RetryFixtureCorrection {
  readonly status?: "active" | "inactive" | "on_leave";
  readonly salary?: string;
  readonly contractDate?: string;
}

const fixture = (
  sequence: number,
  values: Omit<LegacyEmployeeFixture, "uuid">,
): LegacyEmployeeFixture => ({
  uuid: `20000000-0000-4000-8000-${sequence.toString().padStart(12, "0")}`,
  ...values,
});

export const LEGACY_TEN: readonly LegacyEmployeeFixture[] = [
  fixture(1, {
    name: "Jo\u00e3o Silva",
    address: "Rua A",
    neighborhood: "Centro",
    zipcode: "14000-000",
    phone: "119999999",
    salary: "3500.00",
    contractDate: "2023-01-10 00:00:00.000",
    role: "Developer",
    status: "active",
  }),
  fixture(2, {
    name: "Maria Souza",
    address: "Rua B",
    neighborhood: "Jardim Paulista",
    zipcode: "14000-001",
    phone: "119999998",
    salary: "4200.00",
    contractDate: "2022-03-15 00:00:00.000",
    role: "Designer",
    status: "active",
  }),
  fixture(3, {
    name: "Carlos Lima",
    address: "Rua C",
    neighborhood: "Centro",
    zipcode: "14000-002",
    phone: "119999997",
    salary: "5000.00",
    contractDate: "2021-07-20 00:00:00.000",
    role: "Manager",
    status: "active",
  }),
  fixture(4, {
    name: "Ana Costa",
    address: "Rua D",
    neighborhood: "Vila Tib\u00e9rio",
    zipcode: "14000-003",
    phone: "119999996",
    salary: "3200.00",
    contractDate: "2023-05-01 00:00:00.000",
    role: "Developer",
    status: "inactive",
  }),
  fixture(5, {
    name: "Pedro Santos",
    address: "Rua E",
    neighborhood: "Campos Eliseos",
    zipcode: "14000-004",
    phone: "119999995",
    salary: "4500.00",
    contractDate: "2022-09-10 00:00:00.000",
    role: "QA",
    status: "active",
  }),
  fixture(6, {
    name: "Lucas Pereira",
    address: "Rua F",
    neighborhood: "Centro",
    zipcode: "14000-005",
    phone: "119999994",
    salary: "3900.00",
    contractDate: "2022-11-02 00:00:00.000",
    role: "Developer",
    status: "active",
  }),
  fixture(7, {
    name: "Fernanda Alves",
    address: "Rua G",
    neighborhood: "Ipiranga",
    zipcode: "14000-006",
    phone: "119999993",
    salary: "4100.00",
    contractDate: "2021-04-12 00:00:00.000",
    role: "Product Owner",
    status: "active",
  }),
  fixture(8, {
    name: "Ricardo Gomes",
    address: "Rua H",
    neighborhood: "Centro",
    zipcode: "14000-007",
    phone: "119999992",
    salary: "3800.00",
    contractDate: "2020-06-30 00:00:00.000",
    role: "Support",
    status: "active",
  }),
  fixture(9, {
    name: "Juliana Rocha",
    address: "Rua I",
    neighborhood: "Jardim Paulista",
    zipcode: "14000-008",
    phone: "119999991",
    salary: "4600.00",
    contractDate: "2021-08-21 00:00:00.000",
    role: "Developer",
    status: "active",
  }),
  fixture(10, {
    name: "Bruno Martins",
    address: "Rua J",
    neighborhood: "Centro",
    zipcode: "14000-009",
    phone: "119999990",
    salary: "3700.00",
    contractDate: "2022-12-01 00:00:00.000",
    role: "QA",
    status: "inactive",
  }),
];

const duplicates = LEGACY_TEN.map((employee, index) => ({
  ...employee,
  uuid: `10000000-0000-4000-8000-${(index + 1).toString().padStart(12, "0")}`,
}));

export const LEGACY_TEN_WITH_REORDERED_DUPLICATES: readonly LegacyEmployeeFixture[] = [
  ...LEGACY_TEN.slice().reverse(),
  ...duplicates,
];

const incompatible = (
  name: string,
  change: Partial<LegacyEmployeeFixture>,
): { readonly name: string; readonly rows: readonly LegacyEmployeeFixture[] } => ({
  name,
  rows: [{ ...LEGACY_TEN[0], ...change }],
});

export const INCOMPATIBLE_LEGACY_FIXTURES = [
  incompatible("unsupported status", { status: "suspended" }),
  incompatible("zero salary", { salary: "0.00" }),
  incompatible("negative salary", { salary: "-1.00" }),
  incompatible("oversized salary", { salary: "10000000000.00" }),
  incompatible("over-scale salary", { salary: "3500.001" }),
  incompatible("non-finite contract timestamp", { contractDate: "infinity" }),
  incompatible("out-of-range contract timestamp", {
    contractDate: "10000-01-01 00:00:00.000",
  }),
] as const;

export const CANONICAL_EMAIL_BY_SEED_KEY: Readonly<Record<LegacySeedKey, string>> = {
  "joao-silva": "joao.silva@example.com",
  "maria-souza": "maria.souza@example.com",
  "carlos-lima": "carlos.lima@example.com",
  "ana-costa": "ana.costa@example.com",
  "pedro-santos": "pedro.santos@example.com",
  "lucas-pereira": "lucas.pereira@example.com",
  "fernanda-alves": "fernanda.alves@example.com",
  "ricardo-gomes": "ricardo.gomes@example.com",
  "juliana-rocha": "juliana.rocha@example.com",
  "bruno-martins": "bruno.martins@example.com",
};

export function canonicalEmailBySeedKey(
  state: CanonicalEmployeeState,
): Readonly<Record<LegacySeedKey, string>> {
  return Object.fromEntries(
    (Object.keys(CANONICAL_EMAIL_BY_SEED_KEY) as LegacySeedKey[]).map((seedKey, index) => {
      const legacy = LEGACY_TEN[index];
      const candidates = state.orderedRows
        .filter(
          (row) =>
            row.fullName === legacy.name.trim() &&
            row.jobTitle === legacy.role.trim() &&
            row.status === legacy.status.trim().toUpperCase() &&
            row.salary === Number(legacy.salary).toFixed(2) &&
            row.hireDate === legacy.contractDate.slice(0, 10) &&
            row.phone === legacy.phone?.trim() &&
            row.address === legacy.address.trim() &&
            row.neighborhood === legacy.neighborhood?.trim() &&
            row.postalCode === legacy.zipcode?.trim(),
        )
        .sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
      if (!candidates[0]) {
        throw new Error(`Canonical employee is missing for seed key ${seedKey}.`);
      }
      return [seedKey, candidates[0].email];
    }),
  ) as Record<LegacySeedKey, string>;
}
