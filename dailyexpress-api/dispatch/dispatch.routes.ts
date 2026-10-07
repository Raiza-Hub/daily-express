import { Router } from "express";
import { voiceCallback, voiceDtmf } from "./dispatch.controller";

const router: Router = Router();

router.post("/voice/callback", voiceCallback);
router.post("/voice/dtmf/:attemptId", voiceDtmf);

export default router;
