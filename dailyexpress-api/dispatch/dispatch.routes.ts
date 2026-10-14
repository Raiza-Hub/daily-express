import { Router } from "express";
import { voiceCallback } from "./dispatch.controller";
import { parseVoiceBody } from "./voice-body.middleware";

const router: Router = Router();

router.post("/voice/callback", parseVoiceBody, voiceCallback);

export default router;
