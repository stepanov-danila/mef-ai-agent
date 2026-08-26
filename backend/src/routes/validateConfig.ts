import { Router } from "express";
import { config } from "../config.js";
import { validateConfig } from "../validation/validateConfig.js";

export const validateConfigRouter = Router();

validateConfigRouter.post("/tools/validate-mef-config", async (req, res) => {
  const errors = await validateConfig(config.mefSchemaPath, req.body);
  res.status(200).json({ errors });
});
