import { getSchema } from "../schema/loadSchema.js";
import { isPlainObject } from "../schema/schemaUtils.js";
import { parsePointer } from "../schema-info/getSchemaInfo.js";

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

const FORMAT_PLACEHOLDERS: Record<string, string> = {
  "date-time": "2024-01-01T00:00:00Z",
  date: "2024-01-01",
  email: "user@example.com",
  uri: "https://example.com",
  hostname: "example.com",
};

const PATTERN_CANDIDATES = ["example", "example-value", "value-1"];

/** The branches of a oneOf/anyOf node, if it has one. */
function branchesOf(node: Record<string, unknown>): Record<string, unknown>[] {
  const branches = node.oneOf ?? node.anyOf;
  return Array.isArray(branches) ? branches.filter(isPlainObject) : [];
}

interface Discriminator {
  property: string;
  value: unknown;
}

/** First branch property whose schema declares a single-value enum. */
function discriminatorOf(branch: Record<string, unknown>): Discriminator | undefined {
  const properties = isPlainObject(branch.properties) ? branch.properties : {};
  for (const [property, propSchema] of Object.entries(properties)) {
    if (isPlainObject(propSchema) && Array.isArray(propSchema.enum) && propSchema.enum.length === 1) {
      return { property, value: propSchema.enum[0] };
    }
  }
  return undefined;
}

/**
 * Picks which branch of a union to generate: the branch whose discriminator
 * matches an override targeting `${pointer}/<discriminator property>`, or
 * branch 0 when no override matches (or no branch has a discriminator).
 */
function selectBranch(
  branches: Record<string, unknown>[],
  pointer: string,
  overrides: Record<string, unknown>,
): Record<string, unknown> {
  for (const branch of branches) {
    const discriminator = discriminatorOf(branch);
    if (!discriminator) continue;
    const targetPointer = `${pointer}/${discriminator.property}`;
    if (
      targetPointer in overrides &&
      overrides[targetPointer] === discriminator.value
    ) {
      return branch;
    }
  }
  return branches[0];
}

/** Merges a union node with its selected branch, dropping oneOf/anyOf. */
function resolveUnion(
  node: Record<string, unknown>,
  pointer: string,
  overrides: Record<string, unknown>,
): Record<string, unknown> {
  const branches = branchesOf(node);
  if (branches.length === 0) {
    return node;
  }
  const chosen = selectBranch(branches, pointer, overrides);
  const { oneOf: _oneOf, anyOf: _anyOf, ...rest } = node;
  return { ...rest, ...chosen };
}

function clampNumber(node: Record<string, unknown>): number {
  let value =
    typeof node.minimum === "number"
      ? node.minimum
      : typeof node.exclusiveMinimum === "number"
        ? node.exclusiveMinimum + 1
        : 0;

  const max =
    typeof node.maximum === "number"
      ? node.maximum
      : typeof node.exclusiveMaximum === "number"
        ? node.exclusiveMaximum - 1
        : undefined;

  if (max !== undefined && value > max) {
    value = max;
  }
  return value;
}

function buildString(node: Record<string, unknown>): string {
  if (typeof node.format === "string" && FORMAT_PLACEHOLDERS[node.format]) {
    return FORMAT_PLACEHOLDERS[node.format];
  }

  let value: string;
  if (typeof node.pattern === "string") {
    const regex = new RegExp(node.pattern);
    value = PATTERN_CANDIDATES.find((candidate) => regex.test(candidate)) ?? "example";
  } else {
    value = "example";
  }

  if (typeof node.minLength === "number" && value.length < node.minLength) {
    value = value.padEnd(node.minLength, "x");
  }
  if (typeof node.maxLength === "number" && value.length > node.maxLength) {
    value = value.slice(0, node.maxLength);
  }

  return value;
}

function buildScalar(node: Record<string, unknown>): JsonValue {
  if (Array.isArray(node.enum) && node.enum.length > 0) {
    return node.enum[0] as JsonValue;
  }

  switch (node.type) {
    case "string":
      return buildString(node);
    case "integer":
    case "number":
      return clampNumber(node);
    case "boolean":
      return false;
    default:
      return null;
  }
}

function buildObject(
  node: Record<string, unknown>,
  pointer: string,
  overrides: Record<string, unknown>,
): Record<string, JsonValue> {
  const required = Array.isArray(node.required) ? (node.required as string[]) : [];
  const properties = isPlainObject(node.properties) ? node.properties : {};

  const result: Record<string, JsonValue> = {};
  for (const name of required) {
    const fieldNode = properties[name];
    if (!isPlainObject(fieldNode)) {
      continue;
    }
    result[name] = buildValue(fieldNode, `${pointer}/${escapeSegment(name)}`, overrides);
  }
  return result;
}

function buildArray(
  node: Record<string, unknown>,
  pointer: string,
  overrides: Record<string, unknown>,
): JsonValue[] {
  const itemNode = isPlainObject(node.items) ? node.items : undefined;
  if (!itemNode) {
    return [];
  }
  const count = typeof node.minItems === "number" ? node.minItems : 0;
  const result: JsonValue[] = [];
  for (let i = 0; i < count; i++) {
    result.push(buildValue(itemNode, `${pointer}/${i}`, overrides));
  }
  return result;
}

function escapeSegment(segment: string): string {
  return segment.replace(/~/g, "~0").replace(/\//g, "~1");
}

/**
 * Builds a minimal, schema-valid placeholder value for `node`, recursing
 * into required object properties and array items and committing to one
 * branch of any oneOf/anyOf union it meets along the way.
 */
function buildValue(
  rawNode: Record<string, unknown>,
  pointer: string,
  overrides: Record<string, unknown>,
): JsonValue {
  const node = resolveUnion(rawNode, pointer, overrides);

  if (node.type === "object" || isPlainObject(node.properties)) {
    return buildObject(node, pointer, overrides);
  }
  if (node.type === "array" || isPlainObject(node.items)) {
    return buildArray(node, pointer, overrides);
  }
  return buildScalar(node);
}

/** Applies an override at `pointer` if the pointer resolves inside `target`. */
function applyOverride(target: Record<string, JsonValue>, pointer: string, value: unknown): void {
  const segments = parsePointer(pointer);
  if (!segments || segments.length === 0) {
    return;
  }

  let current: JsonValue = target;
  for (let i = 0; i < segments.length - 1; i++) {
    const segment = segments[i];
    if (Array.isArray(current)) {
      const index = Number(segment);
      if (!Number.isInteger(index) || index < 0 || index >= current.length) {
        return;
      }
      current = current[index];
    } else if (isPlainObject(current) && segment in current) {
      current = current[segment] as JsonValue;
    } else {
      return;
    }
  }

  const last = segments[segments.length - 1];
  if (Array.isArray(current)) {
    const index = Number(last);
    if (!Number.isInteger(index) || index < 0 || index >= current.length) {
      return;
    }
    current[index] = value as JsonValue;
  } else if (isPlainObject(current) && last in current) {
    current[last] = value as JsonValue;
  }
}

/**
 * Generates a minimal, schema-valid MEF config: every field required at
 * the schema's root, and every field required within a required object or
 * array-item field, recursively, each filled with a placeholder value
 * satisfying its declared constraints. A oneOf/anyOf union commits to its
 * first branch, unless `overrides` targets that union's discriminator
 * field with a value matching a different branch.
 *
 * `overrides` maps JSON Pointers (RFC 6901) to values; each is applied at
 * that pointer once generation finishes, but only when the pointer
 * resolves to a field the minimal template already generated — an
 * override targeting an optional field the template omitted is a no-op.
 */
export async function generateConfigTemplate(
  schemaPath: string,
  overrides: Record<string, unknown> = {},
): Promise<Record<string, JsonValue>> {
  const schema = await getSchema(schemaPath);
  const root = isPlainObject(schema) ? schema : {};

  const config = buildObject(root, "", overrides);

  for (const [pointer, value] of Object.entries(overrides)) {
    applyOverride(config, pointer, value);
  }

  return config;
}
