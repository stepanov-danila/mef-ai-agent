import express, {
  type ErrorRequestHandler,
  type Express,
} from "express";
import { healthRouter } from "./routes/health.js";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  // eslint-disable-next-line no-console
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
};

export function createApp(): Express {
  const app = express();

  app.use(express.json());
  app.use(healthRouter);

  app.use(errorHandler);

  return app;
}
