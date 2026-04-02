import { Request, Response, RequestHandler } from "express";
import { asyncHandler } from "@shared/middleware";
import { createSuccessResponse } from "@shared/utils";

// Mail delivery is handled automatically by the Kafka consumer started in index.ts.
// This route is kept as a health/status check for the mail service.
export const sendEmail: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    res
      .status(200)
      .json(createSuccessResponse(null, "Mail service is running. Emails are delivered via Kafka."));
  },
);
