export interface ServiceError extends Error {
  statusCode?: number;
  code?: string;
}

declare global {
  namespace Express {
    interface Request {
      adminUser?: { email: string };
    }
  }
}
