import { Router } from "express";
import { config } from "../config.js";
import { getFieldInfo, listFields, parsePointer } from "../schema-info/getSchemaInfo.js";

export const schemaInfoRouter = Router();

function readPointer(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

schemaInfoRouter.get("/tools/get-schema-info/field", async (req, res) => {
  const pointer = readPointer(req.query.pointer);
  if (pointer === undefined || parsePointer(pointer) === undefined) {
    res.status(400).json({ error: "Query parameter 'pointer' must be a valid JSON Pointer" });
    return;
  }

  const field = await getFieldInfo(config.mefSchemaPath, pointer);
  if (field === undefined) {
    res.status(404).json({ error: `No field found at pointer "${pointer}"` });
    return;
  }

  res.status(200).json({ field });
});

schemaInfoRouter.get("/tools/get-schema-info/list", async (req, res) => {
  const pointer = readPointer(req.query.pointer);
  if (pointer !== undefined && parsePointer(pointer) === undefined) {
    res.status(400).json({ error: "Query parameter 'pointer' must be a valid JSON Pointer" });
    return;
  }

  const fields = await listFields(config.mefSchemaPath, pointer);
  res.status(200).json({ fields });
});
