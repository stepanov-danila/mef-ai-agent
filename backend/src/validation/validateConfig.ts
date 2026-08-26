import Ajv, { type ErrorObject, type ValidateFunction } from "ajv-draft-04";
import { getSchema } from "../schema/loadSchema.js";
import { attributeUnionErrors } from "./branchErrors.js";

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

  // strict: false — the real MEF config schema contains nodes with
  // keywords Ajv doesn't specifically recognize (e.g. a keyword sitting
  // outside `properties`, an authoring defect in the schema itself); the
  // validator must still compile and validate against whatever the
  // schema actually declares rather than refusing to load. See
  // docs/SCHEMA_ISSUES.md for the specific defects found.
  const ajv = new Ajv({ allErrors: true, strict: false });
  cachedValidate = ajv.compile(schema as object);
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
 * oneOf/anyOf validated using standard JSON Schema semantics. When a
 * union fails, only the errors of the branch the config's own values
 * indicate were intended are reported (see branchErrors.ts) — the
 * valid/invalid verdict itself always comes from Ajv's standard
 * semantics and is never affected by that attribution. Returns an empty
 * array when the config is valid.
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
  return toValidationErrors(attributeUnionErrors(validate.errors ?? []));
}

/** Test-only escape hatch to reset the module-level cache between tests. */
export function __resetValidatorCacheForTests(): void {
  cachedValidate = undefined;
}
