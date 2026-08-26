import { getSchema } from "../schema/loadSchema.js";
import { isPlainObject } from "../schema/schemaUtils.js";

export interface FieldVariant {
  discriminator?: { property: string; value: unknown };
  required: string[];
  type?: unknown;
  constraints: Record<string, unknown>;
}

export interface FieldInfo {
  path: string;
  type: unknown;
  required: boolean;
  constraints: Record<string, unknown>;
  description?: string;
  items?: { type: unknown; constraints: Record<string, unknown> };
  variants?: FieldVariant[];
}

const STRUCTURAL_KEYWORDS = new Set([
  "properties",
  "patternProperties",
  "items",
  "additionalProperties",
  "definitions",
  "$ref",
  "$schema",
  "id",
  "title",
  "description",
  "type",
  "required",
  "oneOf",
  "anyOf",
]);

function extractConstraints(node: Record<string, unknown>): Record<string, unknown> {
  const constraints: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (!STRUCTURAL_KEYWORDS.has(key)) {
      constraints[key] = value;
    }
  }
  return constraints;
}

/** Parses a JSON Pointer (RFC 6901). Returns undefined for a malformed pointer. */
export function parsePointer(pointer: string): string[] | undefined {
  if (pointer === "") {
    return [];
  }
  if (!pointer.startsWith("/")) {
    return undefined;
  }
  return pointer
    .split("/")
    .slice(1)
    .map((segment) => segment.replace(/~1/g, "/").replace(/~0/g, "~"));
}

function escapePointerSegment(segment: string): string {
  return segment.replace(/~/g, "~0").replace(/\//g, "~1");
}

function joinPointer(base: string, segment: string): string {
  return `${base}/${escapePointerSegment(segment)}`;
}

/** The branches of a oneOf/anyOf node, if it has one. */
function branchesOf(node: Record<string, unknown>): Record<string, unknown>[] {
  const branches = node.oneOf ?? node.anyOf;
  return Array.isArray(branches) ? branches.filter(isPlainObject) : [];
}

/**
 * The set of nodes to search when looking for a field inside `node`:
 * `node` itself, plus every branch if `node` is a oneOf/anyOf. Searching
 * every branch (not just the first) is what lets a lookup path descend
 * through a union without silently reading only one variant.
 */
function candidateNodesOf(node: Record<string, unknown>): Record<string, unknown>[] {
  const branches = branchesOf(node);
  return branches.length > 0 ? [node, ...branches] : [node];
}

interface SegmentHit {
  node: Record<string, unknown>;
  required: boolean;
}

function findSegmentInNode(
  node: Record<string, unknown>,
  segment: string,
): SegmentHit | undefined {
  const requiredList = node.required;
  const isRequired = Array.isArray(requiredList) && requiredList.includes(segment);

  if (isPlainObject(node.properties) && isPlainObject(node.properties[segment])) {
    return { node: node.properties[segment], required: isRequired };
  }

  if (/^\d+$/.test(segment) && isPlainObject(node.items)) {
    return { node: node.items, required: false };
  }

  if (isPlainObject(node.patternProperties)) {
    for (const [pattern, sub] of Object.entries(node.patternProperties)) {
      if (isPlainObject(sub) && new RegExp(pattern).test(segment)) {
        return { node: sub, required: isRequired };
      }
    }
  }

  return undefined;
}

/**
 * Merges the nodes found for the same field path segment across every
 * branch of a union: `enum` arrays are unioned; every other keyword
 * keeps the first branch's value. A single hit passes through unchanged.
 */
function mergeNodes(nodes: Record<string, unknown>[]): Record<string, unknown> {
  if (nodes.length === 1) {
    return nodes[0];
  }

  const merged: Record<string, unknown> = {};
  const enumValues: unknown[] = [];
  let hasEnum = false;

  for (const node of nodes) {
    for (const [key, value] of Object.entries(node)) {
      if (key === "enum" && Array.isArray(value)) {
        hasEnum = true;
        for (const v of value) {
          if (!enumValues.includes(v)) {
            enumValues.push(v);
          }
        }
        continue;
      }
      if (!(key in merged)) {
        merged[key] = value;
      }
    }
  }

  if (hasEnum) {
    merged.enum = enumValues;
  }
  return merged;
}

/** Searches every candidate node of a (possibly-union) container for a field segment. */
function resolveSegment(
  candidates: Record<string, unknown>[],
  segment: string,
): SegmentHit | undefined {
  const hits = candidates
    .map((candidate) => findSegmentInNode(candidate, segment))
    .filter((hit): hit is SegmentHit => hit !== undefined);

  if (hits.length === 0) {
    return undefined;
  }

  return {
    node: mergeNodes(hits.map((hit) => hit.node)),
    required: hits.some((hit) => hit.required),
  };
}

function resolveNode(
  root: Record<string, unknown>,
  segments: string[],
): { node: Record<string, unknown>; required: boolean } | undefined {
  let currentNode = root;
  let required = false;

  for (const segment of segments) {
    const candidates = candidateNodesOf(currentNode);
    const hit = resolveSegment(candidates, segment);
    if (!hit) {
      return undefined;
    }
    currentNode = hit.node;
    required = hit.required;
  }

  return { node: currentNode, required };
}

function buildVariants(node: Record<string, unknown>): FieldVariant[] | undefined {
  const branches = branchesOf(node);
  if (branches.length === 0) {
    return undefined;
  }

  return branches.map((branch) => {
    let discriminator: { property: string; value: unknown } | undefined;
    const branchProperties = isPlainObject(branch.properties) ? branch.properties : {};
    for (const [property, propSchema] of Object.entries(branchProperties)) {
      if (
        isPlainObject(propSchema) &&
        Array.isArray(propSchema.enum) &&
        propSchema.enum.length === 1
      ) {
        discriminator = { property, value: propSchema.enum[0] };
        break;
      }
    }

    const required = Array.isArray(branch.required)
      ? (branch.required as string[])
      : Array.isArray(node.required)
        ? (node.required as string[])
        : [];

    return {
      discriminator,
      required,
      type: branch.type,
      constraints: extractConstraints(branch),
    };
  });
}

function toFieldInfo(
  path: string,
  node: Record<string, unknown>,
  required: boolean,
): FieldInfo {
  const info: FieldInfo = {
    path,
    type: node.type,
    required,
    constraints: extractConstraints(node),
  };

  if (typeof node.description === "string") {
    info.description = node.description;
  }

  if (node.type === "array" && isPlainObject(node.items)) {
    info.items = {
      type: node.items.type,
      constraints: extractConstraints(node.items),
    };
  }

  const variants = buildVariants(node);
  if (variants) {
    info.variants = variants;
  }

  return info;
}

async function getRootSchema(
  schemaPath: string,
): Promise<Record<string, unknown> | undefined> {
  const schema = await getSchema(schemaPath);
  return isPlainObject(schema) ? schema : undefined;
}

/**
 * Looks up a MEF config field's type, required status, description, and
 * constraints by JSON Pointer (RFC 6901, e.g. "/runtime/kind" or
 * "/applications/0/name"). A field declared via oneOf/anyOf reports
 * every branch as a `variants` entry; a lookup path that descends
 * through a union field merges that segment across every branch, rather
 * than reading only the first. Returns undefined when the pointer is
 * malformed or does not resolve against the schema.
 */
export async function getFieldInfo(
  schemaPath: string,
  pointer: string,
): Promise<FieldInfo | undefined> {
  const segments = parsePointer(pointer);
  if (!segments || segments.length === 0) {
    return undefined;
  }

  const root = await getRootSchema(schemaPath);
  if (!root) {
    return undefined;
  }

  const resolved = resolveNode(root, segments);
  return resolved ? toFieldInfo(pointer, resolved.node, resolved.required) : undefined;
}

/**
 * Lists metadata for every field declared directly under the node a
 * JSON Pointer identifies (or under the schema's root, when no pointer
 * is given). Each result's `path` is the full pointer to that field.
 */
export async function listFields(
  schemaPath: string,
  pointer?: string,
): Promise<FieldInfo[]> {
  const root = await getRootSchema(schemaPath);
  if (!root) {
    return [];
  }

  let targetNode = root;
  const basePointer = pointer ?? "";

  if (pointer !== undefined && pointer !== "") {
    const segments = parsePointer(pointer);
    if (!segments) {
      return [];
    }
    const resolved = resolveNode(root, segments);
    if (!resolved) {
      return [];
    }
    targetNode = resolved.node;
  }

  const candidates = candidateNodesOf(targetNode);
  const names = new Set<string>();
  for (const candidate of candidates) {
    if (isPlainObject(candidate.properties)) {
      for (const name of Object.keys(candidate.properties)) {
        names.add(name);
      }
    }
  }

  const results: FieldInfo[] = [];
  for (const name of names) {
    const hit = resolveSegment(candidates, name);
    if (hit) {
      results.push(toFieldInfo(joinPointer(basePointer, name), hit.node, hit.required));
    }
  }
  return results;
}
