import { Router } from "express";
import { voiceCallback, voiceDtmf } from "./dispatch.controller";
import { parseVoiceBody } from "./voice-body.middleware";

const router: Router = Router();

router.post("/voice/callback", parseVoiceBody, voiceCallback);
router.post("/voice/dtmf/:attemptId", parseVoiceBody, voiceDtmf);

export default router;
