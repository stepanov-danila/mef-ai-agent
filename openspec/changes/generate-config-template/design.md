## Context

`schema-loading` (`backend-skeleton`) caches the fully-dereferenced MEF
JSON Schema (no `$ref` left to resolve at generation time).
`mef-schema-info` (`get-schema-info`, `schema-info-real-schema`) already
resolves JSON Pointers against that schema, but its resolver
(`resolveNode`/`candidateNodesOf` in `getSchemaInfo.ts`) *merges* a union
field's branches together — correct for "what values are ever valid
here", wrong for generation, where the output must be one coherent object
matching exactly one branch. `mef-config-validation`
(`fix-union-validation`) removed the previous `collapseFirstBranch`
helper for the same reason in reverse: standard `oneOf`/`anyOf` validation
semantics don't want any branch collapsed away. This change needs a third,
independent traversal that walks the raw schema and, on every union node
it meets, commits to exactly one branch.

## Goals / Non-Goals

**Goals:**
- Walk the raw cached schema (not through `mef-schema-info`'s
  branch-merging resolver) to build one coherent, minimal config object.
- Reuse the union discriminator-detection convention already established
  by `branchErrors.ts` (validation) and `getSchemaInfo.ts`'s
  `buildVariants` (a branch property with a single-value `enum`) so
  override-driven branch selection reads discriminators the same way the
  rest of the backend already does.

**Non-Goals:**
- Materializing a path for an override targeting a field the minimal
  (required-only) template didn't already generate — per proposal.md,
  overrides only set values already present in the generated tree.
- Tuple-style `items` (an array schema) — array generation assumes a
  single item schema, matching the existing assumption in
  `getSchemaInfo.ts`.
- `patternProperties`-only objects — never reached by required-field
  generation since a `required` name is always a literal property name,
  never a pattern.
- Regex-conformant string generation for arbitrary `pattern` values —
  infeasible in general; see the pattern-handling decision below for the
  fallback.
- The `generate_config_template` agent-tool request/response wiring —
  out of scope per proposal.md, same boundary as the other two tools.

## Decisions

- **Placement**: `backend/src/config-template/generateConfigTemplate.ts`,
  a sibling of `schema/`, `schema-info/`, and `validation/` under
  `backend/src/`, consuming `getSchema()` from `schema/loadSchema.ts`
  directly (same dependency the other two capabilities use) and
  `isPlainObject` from `schema/schemaUtils.ts`.

- **Independent branch-committing traversal**: implement a local
  recursive `buildValue(node, pointer, overrides)` rather than reusing
  `mef-schema-info`'s resolver. Rationale: that resolver's cross-branch
  merge is *the* thing generation must not do; adapting it in place would
  either break `mef-schema-info`'s own contract or require a mode flag
  threaded through every helper. A second, small, purpose-built walker is
  simpler than making one walker serve two incompatible contracts.

- **Union branch selection**: for a node with `oneOf`/`anyOf`, detect each
  branch's discriminator the same way `getSchemaInfo.ts`'s `buildVariants`
  does (first branch property whose schema has a single-value `enum`).
  Choose the branch whose discriminator property/value pair matches an
  override targeting `${pointer}/${discriminatorProperty}` with that
  exact value; otherwise choose branch 0. Then proceed as if the node
  were `{ ...node (minus oneOf/anyOf), ...chosenBranch }` — the same
  merge shape the deleted `collapseFirstBranch` used, just with a
  selectable branch instead of always branch 0.

- **Required-field walk**: for an object node, iterate `node.required`
  (empty/absent → no fields generated) and recurse into
  `node.properties[name]` for each. A required name with no matching
  `properties` entry is skipped (schema authoring defect, same tolerant
  stance `validateConfig.ts` already takes toward the real schema's known
  issues in `docs/SCHEMA_ISSUES.md`) rather than throwing.

- **Array generation**: element count is `node.minItems ?? 0`; each
  element is `buildValue(node.items, pointer + "/" + i, overrides)`. A
  `minItems` of 0 (or absent) with the array itself required still
  produces a valid empty array — an empty array is a minimal valid value
  unless the schema says otherwise.

- **Scalar placeholders**:
  - `enum` present (on any node, not just leaves) → first enum value.
  - `type: "string"`: `format` gets a small fixed table
    (`date-time`→ISO instant, `date`→ISO date, `email`→
    `user@example.com`, `uri`→`https://example.com`, else generic);
    `pattern` present and no `format` → try a short list of plausible
    candidates (`"example"`, `"example-value"`, `"value-1"`) against the
    pattern via `RegExp.test`, using the first match; none match → fall
    back to `"example"` regardless (documented limitation — see Risks).
    `minLength`/`maxLength` pad/truncate the chosen string.
  - `type: "integer"`/`"number"`: `minimum` (or `exclusiveMinimum + 1`,
    or `0`) clamped below `maximum` (or `exclusiveMaximum - 1`) when
    present.
  - `type: "boolean"` → `false`.
  - `type: "object"` with no `properties`/`required` → `{}`.
  - `type: "array"` with no `items` → `[]`.
  - No `type` and no `enum` (fully untyped node) → `null`.

- **Override application, two passes**:
  1. During generation (as above), a union's discriminator-matching
     override steers branch choice.
  2. After generation, walk each override's parsed JSON Pointer segments
     against the *generated plain object* (not the schema) using plain
     property/array-index indexing; if every segment up to the last
     resolves to an existing container, set the final segment's value,
     overwriting whatever placeholder was generated there. A pointer that
     doesn't fully resolve is a no-op, per the spec's "no corresponding
     generated field" scenario. Reusing `mef-schema-info`'s
     `parsePointer` (already exported) for pointer parsing avoids a
     second implementation of RFC 6901 escaping.

- **Public API**:
  `generateConfigTemplate(schemaPath: string, overrides?: Record<string, unknown>): Promise<Record<string, unknown>>`.
  Overrides keyed by JSON Pointer (same dialect `mef-schema-info` uses),
  matching the proposal's framing of model-type/model-name substitution as
  instances of one generic mechanism, not two special-cased options.

## Risks / Trade-offs

- [Pattern-matching placeholder strings can still violate an unusual
  `pattern`, producing a template that fails `validate_mef_config`] →
  Accepted for Phase 1: the goal is a good starting draft, not a
  guaranteed-valid one for every possible regex; the existing
  `validate_mef_config` tool is exactly what a caller runs next to catch
  this. Documented as a known limitation rather than silently ignored.
- [A required field named in `required` but missing from `properties`
  (schema authoring defect) is silently skipped] → Consistent with this
  project's existing tolerant stance (`strict: false` in
  `validateConfig.ts`, `docs/SCHEMA_ISSUES.md`); the alternative (throwing)
  would make generation unusable against the real schema's known defects.
- [Two independent schema walkers now exist (`mef-schema-info`'s and this
  one) that both know the discriminator-detection convention] → Low risk:
  the convention is a two-line check copied at each site already (also
  duplicated once between `branchErrors.ts` and `getSchemaInfo.ts`);
  extracting a shared helper is a reasonable follow-up but not required
  for this change to be correct.

## Migration Plan

Greenfield addition — no existing behavior changes. New module only.
