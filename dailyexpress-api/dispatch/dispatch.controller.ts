import type { RequestHandler } from "express";
import { asyncHandler } from "@shared/middleware";
import { tripDispatchService } from "./trip-dispatch.service";

export const voiceCallback: RequestHandler = asyncHandler(async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const xml = await tripDispatchService.handleVoiceCallback({
    clientRequestId:
      typeof body.clientRequestId === "string" ? body.clientRequestId : undefined,
    isActive: typeof body.isActive === "string" ? body.isActive : undefined,
    status: typeof body.status === "string" ? body.status : undefined,
    hangupCause:
      typeof body.hangupCause === "string" ? body.hangupCause : undefined,
    direction: typeof body.direction === "string" ? body.direction : undefined,
    dtmfDigits:
      typeof body.dtmfDigits === "string" ? body.dtmfDigits : undefined,
  });
  res.type("text/xml").status(200).send(xml);
});
