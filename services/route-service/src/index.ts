import express, { type Express } from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import routeRoutes from "./route.routes";
import { corsOptions, errorHandler } from "@shared/middleware";

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3003;

//setup middleware

app.use(cors(corsOptions()));
app.use(helmet());

//parse JSON bodies
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/v1/route", routeRoutes);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Route service is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

export default app;
