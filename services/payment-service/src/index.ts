import express, { type Express } from "express";
import type { Request } from "express";
import dotenv from "dotenv";
import helmet from "helmet";
import paymentRoutes from "./payment.routes";
import { errorHandler } from "@shared/middleware";
import { loadConfig } from "./config";

dotenv.config();

const app: Express = express();
const config = loadConfig();

app.use(helmet());
app.use(
  express.json({
    limit: "2mb",
    verify: (req: Request, _res, buf) => {
      req.rawBody = Buffer.from(buf);
    },
  }),
);
app.use(express.urlencoded({ extended: true }));

app.use("/v1/payments", paymentRoutes);

app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`Payment service is running on port ${config.port}`);
  console.log(`Environment: ${config.nodeEnv}`);
  console.log(`Health check: http://localhost:${config.port}/v1/payments/health`);
});

export default app;
