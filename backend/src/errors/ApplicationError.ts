export type ErrorCode =
  | "MALFORMED_JSON"
  | "EMPLOYEE_NOT_FOUND"
  | "ROUTE_NOT_FOUND"
  | "EMAIL_CONFLICT"
  | "PAYLOAD_TOO_LARGE"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "VALIDATION_ERROR"
  | "INVALID_XLSX"
  | "INTERNAL_ERROR";

export interface ErrorDetail {
  readonly path: string;
  readonly code: string;
  readonly message: string;
}

export class ApplicationError extends Error {
  public readonly name = "ApplicationError";

  public constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: readonly ErrorDetail[],
  ) {
    super(message);
  }
}
