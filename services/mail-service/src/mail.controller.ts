import { Request, Response, RequestHandler } from "express";
import { asyncHandler } from "@shared/middleware";
import { createSuccessResponse } from "@shared/utils";
import { MailService } from "./mailService";

const mailService = new MailService();

export const sendEmail: RequestHandler = asyncHandler(async (req: Request, res: Response) => {
  const { to, subject, html } = req.body;

  const result = await mailService.sendMail(to, subject, html);

  res
    .status(200)
    .json(createSuccessResponse(result, "Email sent successfully"));
});
