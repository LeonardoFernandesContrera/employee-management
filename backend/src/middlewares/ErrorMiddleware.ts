import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { ZodError } from "zod";

import { ApplicationError, type ErrorCode, type ErrorDetail } from "../errors/ApplicationError";

const statusByCode: Readonly<Record<ErrorCode, number>> = {
  MALFORMED_JSON: 400,
  EMPLOYEE_NOT_FOUND: 404,
  ROUTE_NOT_FOUND: 404,
  EMAIL_CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  VALIDATION_ERROR: 422,
  INVALID_XLSX: 422,
  INTERNAL_ERROR: 500,
};

const isMalformedJson = (error: unknown): error is SyntaxError & { type: string } =>
  error instanceof SyntaxError && "type" in error && error.type === "entity.parse.failed";

const prismaErrorCode = (error: unknown): string | undefined =>
  typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
    ? error.code
    : undefined;

const sendError = (
  response: Response,
  status: number,
  code: ErrorCode,
  message: string,
  details?: readonly ErrorDetail[],
) =>
  response.status(status).json({
    error: {
      code,
      message,
      ...(details && details.length > 0 ? { details } : {}),
    },
  });

export function errorMiddleware(
  error: unknown,
  _request: Request,
  response: Response,
  _next: NextFunction,
) {
  if (error instanceof ApplicationError) {
    return sendError(response, statusByCode[error.code], error.code, error.message, error.details);
  }

  if (error instanceof ZodError) {
    return sendError(
      response,
      422,
      "VALIDATION_ERROR",
      "Request validation failed.",
      error.issues.map((issue) => ({
        path: issue.path.map(String).join("."),
        code: issue.code,
        message: issue.message,
      })),
    );
  }

  if (isMalformedJson(error)) {
    return sendError(response, 400, "MALFORMED_JSON", "Request body is not valid JSON.");
  }

  const persistenceCode = prismaErrorCode(error);
  if (persistenceCode === "P2002") {
    return sendError(response, 409, "EMAIL_CONFLICT", "Email is already in use.");
  }
  if (persistenceCode === "P2025") {
    return sendError(response, 404, "EMPLOYEE_NOT_FOUND", "Employee not found.");
  }

  if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
    return sendError(response, 413, "PAYLOAD_TOO_LARGE", "Uploaded file exceeds the 5 MiB limit.");
  }

  console.error("Unexpected application error.", error);
  return sendError(response, 500, "INTERNAL_ERROR", "An unexpected server error occurred.");
}
