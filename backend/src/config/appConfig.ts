import { z } from "zod";

export type NodeEnvironment = "development" | "test" | "production";

export interface AppConfig {
  readonly databaseUrl: string;
  readonly port: number;
  readonly corsOrigin: string;
  readonly nodeEnv: NodeEnvironment;
}

const requiredText = z.string().trim().min(1);

const isPostgreSqlUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return (
      (url.protocol === "postgresql:" || url.protocol === "postgres:") && url.hostname.length > 0
    );
  } catch {
    return false;
  }
};

const databaseUrlSchema = requiredText.refine(isPostgreSqlUrl);

const portSchema = requiredText
  .regex(/^[1-9][0-9]{0,4}$/)
  .transform(Number)
  .refine((value) => value <= 65535);

const isCorsOrigin = (value: string): boolean => {
  if (value.includes("*") || value.includes("?") || value.includes("#")) return false;

  try {
    const url = new URL(value);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      url.hostname.length > 0 &&
      url.username === "" &&
      url.password === "" &&
      url.pathname === "/" &&
      url.search === "" &&
      url.hash === "" &&
      url.origin !== "null"
    );
  } catch {
    return false;
  }
};

const corsOriginSchema = requiredText
  .refine(isCorsOrigin)
  .transform((value) => new URL(value).origin);

const nodeEnvironmentSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim() : value),
  z.enum(["development", "test", "production"]),
);

const environmentSchema = z
  .object({
    DATABASE_URL: databaseUrlSchema,
    PORT: portSchema,
    CORS_ORIGIN: corsOriginSchema,
    NODE_ENV: nodeEnvironmentSchema,
  })
  .strict();

export function parseEnvironment(source: NodeJS.ProcessEnv): AppConfig {
  const parsed = environmentSchema.parse({
    DATABASE_URL: source.DATABASE_URL,
    PORT: source.PORT,
    CORS_ORIGIN: source.CORS_ORIGIN,
    NODE_ENV: source.NODE_ENV,
  });
  return Object.freeze({
    databaseUrl: parsed.DATABASE_URL,
    port: parsed.PORT,
    corsOrigin: parsed.CORS_ORIGIN,
    nodeEnv: parsed.NODE_ENV,
  });
}
