import type { JWTPayload } from "../types";

declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
      rawBody?: Buffer;
    }
  }
}

export {};
