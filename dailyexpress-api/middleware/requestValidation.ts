import z from "zod/v4";
import type { Request, RequestHandler, Response, NextFunction } from "express";
import type { FieldErrors } from "./apiResponses";
import { sendErrorResponse } from "./apiResponses";

function cleanValidationMessage(message: string | undefined): string {
  if (!message?.trim()) {
    return "This field is invalid.";
  }

  return message.replace(/"/g, "").trim();
}

function getFieldName(path: readonly (string | number | symbol)[]): string {
  const parts = path.filter(
    (part): part is string => typeof part === "string" && part !== "",
  );
  return parts.length ? parts.join(".") : "request";
}

export function validateRequest<TOutput = unknown>(
  schema: z.ZodType<TOutput>,
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): Response | void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const errors: FieldErrors = {};

      for (const issue of result.error.issues) {
        const field = getFieldName(issue.path);
        errors[field] ||= [];
        errors[field]?.push(cleanValidationMessage(issue.message));
      }

      if (!Object.keys(errors).length) {
        errors.request = [cleanValidationMessage(result.error.message)];
      }

      sendErrorResponse(
        res,
        400,
        "Please fix the highlighted fields and try again.",
        {
          code: "VALIDATION_ERROR",
          errors,
        },
      );
      return;
    }

    req.body = result.data;
    next();
  };
}