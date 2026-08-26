import { Router } from "express";
import { config } from "../config.js";
import { generateConfigTemplate } from "../config-template/generateConfigTemplate.js";
import { isPlainObject } from "../schema/schemaUtils.js";

export const generateTemplateRouter = Router();

generateTemplateRouter.post("/tools/generate-config-template", async (req, res) => {
  const overrides = isPlainObject(req.body) ? req.body.overrides : undefined;

  if (overrides !== undefined && !isPlainObject(overrides)) {
    res.status(400).json({ error: "'overrides' must be a JSON object" });
    return;
  }

  const template = await generateConfigTemplate(
    config.mefSchemaPath,
    overrides as Record<string, unknown> | undefined,
  );
  res.status(200).json(template);
});
