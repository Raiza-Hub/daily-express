import type { RequestHandler } from "express";
import { asyncHandler } from "@shared/middleware";
import { logger } from "../utils/logger";
import { verifyAttemptToken } from "./callback-token";
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

export const voiceDtmf: RequestHandler = asyncHandler(async (req, res) => {
  const attemptId = Array.isArray(req.params.attemptId)
    ? req.params.attemptId[0]
    : req.params.attemptId;
  const body = (req.body ?? {}) as Record<string, unknown>;
  if (!attemptId || !verifyAttemptToken(attemptId, req.query.token)) {
    logger.warn("trip_dispatch.voice_dtmf_rejected", {
      attemptId,
      hasToken: typeof req.query.token === "string",
      body: Object.keys(body),
    });
    res.sendStatus(404);
    return;
  }

  logger.info("trip_dispatch.voice_dtmf", {
    attemptId,
    dtmfDigits:
      typeof body.dtmfDigits === "string" ? body.dtmfDigits : undefined,
  });
  const xml = await tripDispatchService.handleDtmf(
    attemptId,
    typeof body.dtmfDigits === "string" ? body.dtmfDigits : undefined,
  );
  res.type("text/xml").status(200).send(xml);
});