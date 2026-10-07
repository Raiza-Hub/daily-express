import type { RequestHandler } from "express";
import { asyncHandler } from "@shared/middleware";
import { verifyAttemptToken } from "./callback-token";
import { tripDispatchService } from "./trip-dispatch.service";

export const voiceCallback: RequestHandler = asyncHandler(async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const xml = await tripDispatchService.handleVoiceCallback({
    clientRequestId:
      typeof body.clientRequestId === "string" ? body.clientRequestId : undefined,
    isActive: typeof body.isActive === "string" ? body.isActive : undefined,
    status: typeof body.status === "string" ? body.status : undefined,
    hangupCause:
      typeof body.hangupCause === "string" ? body.hangupCause : undefined,
  });
  res.type("text/xml").status(200).send(xml);
});

export const voiceDtmf: RequestHandler = asyncHandler(async (req, res) => {
  const attemptId = Array.isArray(req.params.attemptId)
    ? req.params.attemptId[0]
    : req.params.attemptId;
  if (!attemptId || !verifyAttemptToken(attemptId, req.query.token)) {
    res.sendStatus(404);
    return;
  }

  const body = req.body as Record<string, unknown>;
  const xml = await tripDispatchService.handleDtmf(
    attemptId,
    typeof body.dtmfDigits === "string" ? body.dtmfDigits : undefined,
  );
  res.type("text/xml").status(200).send(xml);
});