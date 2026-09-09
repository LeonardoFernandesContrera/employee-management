import { parseEnvironment, type AppConfig } from "../../config/appConfig";

const validEnvironment = (): NodeJS.ProcessEnv => ({
  DATABASE_URL: "postgresql://employee:secret@localhost:5432/employees?schema=public",
  PORT: "3000",
  CORS_ORIGIN: "https://employees.example.com",
  NODE_ENV: "test",
});

describe("parseEnvironment", () => {
  test("parses only the supplied source into a frozen normalized configuration", () => {
    const source = Object.freeze({
      DATABASE_URL: "  postgresql://employee:secret@localhost:5432/source_database  ",
      PORT: " 4321 ",
      CORS_ORIGIN: " https://source.example.com/ ",
      NODE_ENV: " development ",
      UNRELATED_VARIABLE: "preserved only in the input",
    });
    const inputSnapshot = { ...source };

    const config: AppConfig = parseEnvironment(source);

    expect(config).toEqual({
      databaseUrl: "postgresql://employee:secret@localhost:5432/source_database",
      port: 4321,
      corsOrigin: "https://source.example.com",
      nodeEnv: "development",
    });
    expect(Object.isFrozen(config)).toBe(true);
    expect(Reflect.set(config, "port", 9999)).toBe(false);
    expect(config.port).toBe(4321);
    expect(source).toEqual(inputSnapshot);
  });

  test("uses each explicit source independently instead of retaining environment state", () => {
    const first = parseEnvironment(validEnvironment());
    const second = parseEnvironment({
      DATABASE_URL: "postgres://other:secret@127.0.0.1:5433/other_database",
      PORT: "65535",
      CORS_ORIGIN: "http://127.0.0.1:5173",
      NODE_ENV: "production",
    });

    expect(first).toEqual({
      databaseUrl: "postgresql://employee:secret@localhost:5432/employees?schema=public",
      port: 3000,
      corsOrigin: "https://employees.example.com",
      nodeEnv: "test",
    });
    expect(second).toEqual({
      databaseUrl: "postgres://other:secret@127.0.0.1:5433/other_database",
      port: 65535,
      corsOrigin: "http://127.0.0.1:5173",
      nodeEnv: "production",
    });
  });

  test.each(["DATABASE_URL", "PORT", "CORS_ORIGIN", "NODE_ENV"])(
    "rejects missing required variable %s",
    (variable) => {
      const source = validEnvironment();
      delete source[variable];
      expect(() => parseEnvironment(source)).toThrow();
    },
  );

  test.each(["DATABASE_URL", "PORT", "CORS_ORIGIN", "NODE_ENV"])(
    "rejects blank required variable %s",
    (variable) => {
      expect(() => parseEnvironment({ ...validEnvironment(), [variable]: "   " })).toThrow();
    },
  );

  test.each([
    "postgresql://employee:secret@localhost:5432/employees",
    "postgres://employee:secret@localhost:5432/employees",
  ])("accepts PostgreSQL database URL %s", (databaseUrl) => {
    expect(parseEnvironment({ ...validEnvironment(), DATABASE_URL: databaseUrl }).databaseUrl).toBe(
      databaseUrl,
    );
  });

  test.each([
    "http://localhost:5432/employees",
    "mysql://localhost:3306/employees",
    "file:./employees.db",
    "postgresql://",
    "not-a-url",
  ])("rejects non-PostgreSQL or malformed database URL %s", (databaseUrl) => {
    expect(() => parseEnvironment({ ...validEnvironment(), DATABASE_URL: databaseUrl })).toThrow();
  });

  test.each([
    ["1", 1],
    ["3000", 3000],
    ["65535", 65535],
  ])("accepts port %s", (port, expected) => {
    expect(parseEnvironment({ ...validEnvironment(), PORT: port }).port).toBe(expected);
  });

  test.each(["0", "65536", "-1", "+1", "3000.0", "1e3", "port"])(
    "rejects invalid port %s",
    (port) => {
      expect(() => parseEnvironment({ ...validEnvironment(), PORT: port })).toThrow();
    },
  );

  test.each([
    ["http://localhost:5173", "http://localhost:5173"],
    ["https://employees.example.com/", "https://employees.example.com"],
    ["https://employees.example.com:443/", "https://employees.example.com"],
  ])("accepts and normalizes HTTP(S) origin %s", (corsOrigin, expected) => {
    expect(parseEnvironment({ ...validEnvironment(), CORS_ORIGIN: corsOrigin }).corsOrigin).toBe(
      expected,
    );
  });

  test.each([
    "*",
    "https://*.example.com",
    "ftp://employees.example.com",
    "https://employees.example.com/app",
    "https://employees.example.com/.",
    "https://employees.example.com/%2e",
    "https://employees.example.com/app/..",
    "https://employees.example.com?tenant=one",
    "https://employees.example.com?",
    "https://employees.example.com#fragment",
    "https://employees.example.com#",
    "https://first.example.com,https://second.example.com",
    "https://first.example.com https://second.example.com",
    "not-an-origin",
  ])("rejects invalid or non-single CORS origin %s", (corsOrigin) => {
    expect(() => parseEnvironment({ ...validEnvironment(), CORS_ORIGIN: corsOrigin })).toThrow();
  });

  test.each(["development", "test", "production"])("accepts environment %s", (nodeEnvironment) => {
    expect(parseEnvironment({ ...validEnvironment(), NODE_ENV: nodeEnvironment }).nodeEnv).toBe(
      nodeEnvironment,
    );
  });

  test.each(["Development", "staging", "prod", "TEST"])(
    "rejects unsupported environment %s",
    (nodeEnvironment) => {
      expect(() =>
        parseEnvironment({ ...validEnvironment(), NODE_ENV: nodeEnvironment }),
      ).toThrow();
    },
  );
});
