import { readFile } from "node:fs/promises";
import $RefParser from "@apidevtools/json-schema-ref-parser";

let cachedSchema: object | undefined;

/**
 * Loads the MEF JSON Schema from disk, resolves internal $ref references,
 * and caches the result. Safe to call repeatedly: after the first
 * successful call, the cached schema is returned without touching disk.
 */
export async function getSchema(schemaPath: string): Promise<object> {
  if (cachedSchema) {
    return cachedSchema;
  }

  let raw: string;
  try {
    raw = await readFile(schemaPath, "utf-8");
  } catch (err) {
    throw new Error(
      `Failed to read MEF schema file at "${schemaPath}": ${(err as Error).message}`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `MEF schema file at "${schemaPath}" is not valid JSON: ${(err as Error).message}`,
    );
  }

  let dereferenced: object;
  try {
    dereferenced = (await $RefParser.dereference(parsed as never)) as object;
  } catch (err) {
    throw new Error(
      `Failed to resolve $ref in MEF schema file at "${schemaPath}": ${(err as Error).message}`,
    );
  }

  cachedSchema = dereferenced;
  return cachedSchema;
}

/** Test-only escape hatch to reset the module-level cache between tests. */
export function __resetSchemaCacheForTests(): void {
  cachedSchema = undefined;
}
