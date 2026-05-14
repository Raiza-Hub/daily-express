import type { Request, RequestHandler, Response, NextFunction } from "express";
import type { FieldErrors } from "./apiResponses";
import { sendErrorResponse } from "./apiResponses";

interface ValidationDetail {
  path?: Array<string | number>;
  message?: string;
}

interface ValidationResult<T = unknown> {
  error?: {
    details?: ValidationDetail[];
    message?: string;
  };
  value: T;
}

interface JoiLikeSchema {
  validate: (
    value: unknown,
    options: { abortEarly: boolean; stripUnknown: boolean },
  ) => ValidationResult;
}

function cleanValidationMessage(message: string | undefined): string {
  if (!message?.trim()) {
    return "This field is invalid.";
  }

  return message.replace(/"/g, "").trim();
}

function getFieldName(detail: ValidationDetail): string {
  const path = detail.path?.filter((part) => part !== undefined && part !== "");
  return path?.length ? path.join(".") : "request";
}

export function validateRequest(schema: JoiLikeSchema): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): Response | void => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errors: FieldErrors = {};

      for (const detail of error.details || []) {
        const field = getFieldName(detail);
        errors[field] ||= [];
        errors[field]?.push(cleanValidationMessage(detail.message));
      }

      if (!Object.keys(errors).length) {
        errors.request = [cleanValidationMessage(error.message)];
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

    req.body = value;
    next();
  };
}
