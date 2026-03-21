import express, { type Express } from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import mailRoutes from "./mail.routes";
import { corsOptions, errorHandler } from "@shared/middleware";

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3008;

app.use(cors(corsOptions()));
app.use(helmet());

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/v1/mail", mailRoutes);

app.use(errorHandler as unknown as express.ErrorRequestHandler);

app.listen(PORT, () => {
  console.log(`Mail service is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

export default app;
