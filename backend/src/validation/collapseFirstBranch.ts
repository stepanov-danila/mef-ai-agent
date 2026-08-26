function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Recursively replaces every `oneOf`/`anyOf` node in a JSON Schema with
 * that node merged with its first branch only, per the project's
 * documented Phase 1 limitation (validate the first branch, not the
 * standard "exactly one"/"at least one" semantics). Does not mutate the
 * input; returns a new schema.
 */
export function collapseFirstBranch(schema: unknown): unknown {
  if (Array.isArray(schema)) {
    return schema.map((item) => collapseFirstBranch(item));
  }
  if (!isPlainObject(schema)) {
    return schema;
  }

  let node: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(schema)) {
    node[key] = collapseFirstBranch(value);
  }

  for (const keyword of ["oneOf", "anyOf"] as const) {
    const branches = node[keyword];
    if (!Array.isArray(branches) || branches.length === 0) {
      continue;
    }

    const firstBranch = branches[0];
    delete node[keyword];
    if (isPlainObject(firstBranch)) {
      node = { ...node, ...firstBranch };
    }
  }

  return node;
}
