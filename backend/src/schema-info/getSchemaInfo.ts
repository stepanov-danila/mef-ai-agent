import { getSchema } from "../schema/loadSchema.js";
import {
  collapseFirstBranch,
  isPlainObject,
} from "../validation/collapseFirstBranch.js";

export interface FieldInfo {
  path: string;
  type: unknown;
  required: boolean;
  constraints: Record<string, unknown>;
}

const CONSTRAINT_KEYWORDS = [
  "pattern",
  "enum",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "minLength",
  "maxLength",
  "minItems",
  "maxItems",
  "format",
] as const;

function extractConstraints(node: Record<string, unknown>): Record<string, unknown> {
  const constraints: Record<string, unknown> = {};
  for (const keyword of CONSTRAINT_KEYWORDS) {
    if (keyword in node) {
      constraints[keyword] = node[keyword];
    }
  }
  return constraints;
}

function toFieldInfo(
  path: string,
  node: Record<string, unknown>,
  required: boolean,
): FieldInfo {
  return {
    path,
    type: node.type,
    required,
    constraints: extractConstraints(node),
  };
}

async function getRootSchema(
  schemaPath: string,
): Promise<Record<string, unknown> | undefined> {
  const schema = await getSchema(schemaPath);
  const collapsed = collapseFirstBranch(schema);
  return isPlainObject(collapsed) ? collapsed : undefined;
}

function resolveNode(
  root: Record<string, unknown>,
  segments: string[],
): { node: Record<string, unknown>; required: boolean } | undefined {
  let currentNode = root;
  let required = false;

  for (const segment of segments) {
    const properties = currentNode.properties;
    if (!isPlainObject(properties) || !isPlainObject(properties[segment])) {
      return undefined;
    }

    const requiredList = currentNode.required;
    required = Array.isArray(requiredList) && requiredList.includes(segment);

    const collapsedChild = collapseFirstBranch(properties[segment]);
    if (!isPlainObject(collapsedChild)) {
      return undefined;
    }
    currentNode = collapsedChild;
  }

  return { node: currentNode, required };
}

/**
 * Looks up a MEF config field's type, required status, and format
 * constraints by dotted path (e.g. "runtime.kind"). Returns undefined
 * when the path does not resolve against the schema.
 */
export async function getFieldInfo(
  schemaPath: string,
  fieldPath: string,
): Promise<FieldInfo | undefined> {
  const segments = fieldPath.split(".").filter((segment) => segment.length > 0);
  if (segments.length === 0) {
    return undefined;
  }

  const root = await getRootSchema(schemaPath);
  if (!root) {
    return undefined;
  }

  const resolved = resolveNode(root, segments);
  return resolved
    ? toFieldInfo(fieldPath, resolved.node, resolved.required)
    : undefined;
}

/** Lists metadata for every top-level field declared in the schema. */
export async function listTopLevelFields(
  schemaPath: string,
): Promise<FieldInfo[]> {
  const root = await getRootSchema(schemaPath);
  if (!root) {
    return [];
  }

  const topLevelNames = isPlainObject(root.properties)
    ? Object.keys(root.properties)
    : [];

  return topLevelNames.flatMap((name) => {
    const resolved = resolveNode(root, [name]);
    return resolved ? [toFieldInfo(name, resolved.node, resolved.required)] : [];
  });
}
