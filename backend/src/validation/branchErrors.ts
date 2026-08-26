import type { ErrorObject } from "ajv-draft-04";

function schemaPathDepth(schemaPath: string): number {
  return schemaPath.split("/").length;
}

function branchIndex(schemaPath: string, unionPrefix: string): string | undefined {
  return schemaPath.slice(unionPrefix.length).match(/^(\d+)/)?.[1];
}

/**
 * When a config fails a oneOf/anyOf union, Ajv (with allErrors: true)
 * reports every failing branch's errors plus a generic "must match
 * exactly one/any schema" error. This collapses that down to just the
 * errors of the branch the config's own values indicate were intended:
 * a branch with an enum-discriminator mismatch is disqualified first;
 * among the rest, the branch with the fewest errors wins. Processes
 * nested unions (a oneOf inside another oneOf's branch) innermost first,
 * so a losing outer branch's already-resolved nested-union errors are
 * still correctly dropped as a whole.
 */
export function attributeUnionErrors(errors: ErrorObject[]): ErrorObject[] {
  const unionErrors = errors
    .filter((e) => e.keyword === "oneOf" || e.keyword === "anyOf")
    .sort((a, b) => schemaPathDepth(b.schemaPath) - schemaPathDepth(a.schemaPath));

  let current = errors;
  for (const unionError of unionErrors) {
    current = resolveOneUnion(current, unionError);
  }
  return current;
}

function resolveOneUnion(
  errors: ErrorObject[],
  unionError: ErrorObject,
): ErrorObject[] {
  const prefix = `${unionError.schemaPath}/`;
  const siblings = errors.filter(
    (e) =>
      e !== unionError &&
      e.schemaPath.startsWith(prefix) &&
      e.instancePath.startsWith(unionError.instancePath),
  );
  const others = errors.filter(
    (e) => e !== unionError && !siblings.includes(e),
  );

  if (siblings.length === 0) {
    return others;
  }

  const byBranch = new Map<string, ErrorObject[]>();
  for (const err of siblings) {
    const idx = branchIndex(err.schemaPath, prefix);
    if (idx === undefined) continue;
    const bucket = byBranch.get(idx) ?? [];
    bucket.push(err);
    byBranch.set(idx, bucket);
  }

  let winningErrors: ErrorObject[] = [];
  let bestScore: [number, number] | undefined;
  for (const branchErrors of byBranch.values()) {
    const hasEnumMismatch = branchErrors.some((e) => e.keyword === "enum");
    const score: [number, number] = [hasEnumMismatch ? 1 : 0, branchErrors.length];
    if (
      !bestScore ||
      score[0] < bestScore[0] ||
      (score[0] === bestScore[0] && score[1] < bestScore[1])
    ) {
      bestScore = score;
      winningErrors = branchErrors;
    }
  }

  return [...others, ...winningErrors];
}
