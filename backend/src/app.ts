import express, {
  type ErrorRequestHandler,
  type Express,
} from "express";
import { generateTemplateRouter } from "./routes/generateTemplate.js";
import { healthRouter } from "./routes/health.js";
import { schemaInfoRouter } from "./routes/schemaInfo.js";
import { validateConfigRouter } from "./routes/validateConfig.js";

function statusOf(err: unknown): number {
  const candidate = (err as { status?: unknown; statusCode?: unknown } | null)?.status ??
    (err as { statusCode?: unknown } | null)?.statusCode;
  return typeof candidate === "number" ? candidate : 500;
}

function messageOf(err: unknown): string {
  return err instanceof Error && err.message ? err.message : "Internal server error";
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  // eslint-disable-next-line no-console
  console.error(err);
  res.status(statusOf(err)).json({ error: messageOf(err) });
};

export function createApp(): Express {
  const app = express();

  app.use(express.json());
  app.use(healthRouter);
  app.use(validateConfigRouter);
  app.use(schemaInfoRouter);
  app.use(generateTemplateRouter);

  app.use(errorHandler);

  return app;
}
