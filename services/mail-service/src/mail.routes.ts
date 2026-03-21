import { Router } from "express";
import * as mailController from "./mail.controller";
import { validateRequest } from "@shared/middleware";
import { sendMailSchema } from "./validation";

const router: Router = Router();

router.post(
  "/send",
  validateRequest(sendMailSchema),
  mailController.sendEmail
);

export default router;
