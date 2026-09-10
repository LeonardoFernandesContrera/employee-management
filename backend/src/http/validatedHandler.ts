import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { z } from "zod";

export type ValidatedAction<T> = (
  input: T,
  request: Request,
  response: Response,
  next: NextFunction,
) => void | Promise<void>;

export function validatedHandler<T>(
  schema: z.ZodType<T>,
  select: (request: Request) => unknown,
  action: ValidatedAction<T>,
): RequestHandler {
  return async (request, response, next) => {
    try {
      const input = schema.parse(select(request));
      await action(input, request, response, next);
    } catch (error) {
      next(error);
    }
  };
}
