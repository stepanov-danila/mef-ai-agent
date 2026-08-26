import Ajv, { type ErrorObject, type ValidateFunction } from "ajv-draft-04";
import { getSchema } from "../schema/loadSchema.js";
import { collapseFirstBranch } from "./collapseFirstBranch.js";

export interface ValidationError {
  path: string;
  message: string;
}

let cachedValidate: ValidateFunction | undefined;

async function getValidate(schemaPath: string): Promise<ValidateFunction> {
  if (cachedValidate) {
    return cachedValidate;
  }

  const schema = await getSchema(schemaPath);
  const collapsedSchema = collapseFirstBranch(schema);

  const ajv = new Ajv({ allErrors: true });
  cachedValidate = ajv.compile(collapsedSchema as object);
  return cachedValidate;
}

function errorPath(err: ErrorObject): string {
  if (err.keyword === "required") {
    const missingProperty = (err.params as { missingProperty?: string })
      .missingProperty;
    return `${err.instancePath}/${missingProperty}`;
  }
  return err.instancePath || "/";
}

function toValidationErrors(errors: ErrorObject[]): ValidationError[] {
  return errors.map((err) => ({
    path: errorPath(err),
    message: err.message ?? "is invalid",
  }));
}

/**
 * Validates a MEF config against the cached MEF JSON Schema, with
 * oneOf/anyOf validated against their first branch only (Phase 1
 * limitation, see collapseFirstBranch). Returns an empty array when the
 * config is valid.
 */
export async function validateConfig(
  schemaPath: string,
  config: unknown,
): Promise<ValidationError[]> {
  const validate = await getValidate(schemaPath);
  const valid = validate(config);
  if (valid) {
    return [];
  }
  return toValidationErrors(validate.errors ?? []);
}

/** Test-only escape hatch to reset the module-level cache between tests. */
export function __resetValidatorCacheForTests(): void {
  cachedValidate = undefined;
}
