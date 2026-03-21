/* eslint-disable @typescript-eslint/no-unused-vars */
import express from "express";

declare global {
  namespace Express {
    interface Request {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      user?: any;
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
