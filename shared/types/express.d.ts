/* eslint-disable @typescript-eslint/no-unused-vars */
import express from "express";
import type { JWTPayload } from "./index";

declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
      rawBody?: Buffer;
    }
    // }
    // namespace Express {
    //   interface Request {
    //     organization?: any;
    //   }
    // }
    // namespace Express {
    //   interface Request {
    //     member?: any;
    //   }
    // }
    // namespace Express {
    //   interface Request {
    //     role?: any;
    //   }
  }
}
