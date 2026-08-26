## Context

`mef-config-validation` (from `validate-mef-config`) compiles the schema
from `schema-loading`'s cache with Ajv (`ajv-draft-04`), after running it
through `collapseFirstBranch` — a transform that replaces every
`oneOf`/`anyOf` node with that node merged with its first branch only.
Both the transform and the "first branch" validation rule were designed
and tested against synthetic fixtures before the real MEF config schema
was available. See proposal.md - Why for what breaks against the real
schema, verified by running the current code against it.

## Goals / Non-Goals

**Goals:**
- Get standards-correct `oneOf`/`anyOf` validation with no code that
  actively works against it.
- Keep union validation errors short and specific, not a dump of every
  branch's failures.
- Stop the validator from failing to compile schemas that use keywords
  or constructs it doesn't specifically recognize.

**Non-Goals:**
- `mef-schema-info`'s own gaps against the real schema (arrays,
  `patternProperties`, `description`) — separate follow-up change per
  proposal.md.
- Recognizing `minProperties`/`maxProperties`-style implicit unions (used
  7 times in the real schema, e.g. "exactly one of `ha`/`recovery`") as
  unions for error-attribution purposes — they validate correctly as
  ordinary constraints already; only their *error message* would benefit
  from the same treatment, and that's a smaller win than the `oneOf`/
  `anyOf` fix.
- Circular `$ref` handling — the real schema has none (verified); a
  latent gap in `$RefParser`'s dereferenced output, not something this
  change's validation logic touches either way.

## Decisions

- **Ajv option**: `new Ajv({ allErrors: true, strict: false })`. `strict`
  defaults to `true` in Ajv 8, and the real schema fails to compile under
  it — a malformed node (`socketTimeout` sitting outside `properties` in
  `definitions.mlsConfig.properties.s3Client`) trips
  `strict mode: unknown keyword`. `strict: false` downgrades this class of
  issue to a warning instead of a compile error. Alternative considered:
  fix the schema instead of loosening `strict`. Rejected as out of our
  control — the schema is an external, versioned artifact from another
  team (see `docs/SCHEMA_ISSUES.md`, added by this change, for the three
  defects found); the validator must tolerate what it's given.

- **Drop `collapseFirstBranch` entirely**, rather than adjusting it.
  Ajv already implements `oneOf`/`anyOf` correctly; the transform's only
  purpose was to implement the (now-removed) first-branch rule. Compile
  the schema from `schema-loading`'s cache directly.

- **Error attribution algorithm** (`backend/src/validation/branchErrors.ts`,
  `attributeUnionErrors(errors: ErrorObject[]): ErrorObject[]`): process
  `oneOf`/`anyOf` failures deepest-`schemaPath`-first (the real schema
  nests unions, e.g. `secretConfig` → `valueFrom`). For each, group
  sibling errors by branch index (parsed from `schemaPath`), score each
  branch as `(hasEnumDiscriminatorMismatch ? 1 : 0, errorCount)`, keep the
  lowest-scoring branch's errors, and drop the rest plus the generic
  `must match exactly one schema in oneOf`/`anyOf` error. Verified against
  the real schema: a config with 2 genuine mistakes went from 13 raw Ajv
  errors to the 2 real ones. The enum-discriminator check resolves all 9
  of the schema's enum-discriminated unions deterministically; branches
  distinguished only by which property is `required` (6 of the schema's
  unions, e.g. `vaultSecretRef` vs `vaultADSecretRef`) fall through to the
  error-count tiebreaker, which resolves them correctly because the wrong
  branch always has strictly more violations (the config is missing that
  branch's required property in addition to whatever else is wrong).
  Alternative considered: a discriminator-registry the caller configures
  per-union. Rejected — needs no schema-specific configuration, works
  generically off the union's own shape, and the generic version already
  resolves every union in the real schema correctly.

- **This heuristic only affects error *messages*, never the valid/invalid
  verdict.** `validateConfig` still calls Ajv's `validate(config)` with
  standard semantics for the boolean result; `attributeUnionErrors` only
  post-processes the `errors` array when the result is already `false`.
  A wrong branch pick could only make an error message point at the wrong
  branch's problem — it cannot turn an invalid config valid or vice versa.

- **Shared `isPlainObject` moves to `backend/src/schema/schemaUtils.ts`.**
  It was only defined in `collapseFirstBranch.ts` (now deleted) and is
  also used by `getSchemaInfo.ts`; giving it a home in `schema/` (next to
  `loadSchema.ts`) rather than `validation/` reflects that it's a generic
  schema-node helper, not validation-specific.

## Risks / Trade-offs

- [`strict: false` also silences other strict-mode warnings besides the
  one malformed node this schema has] → Acceptable: strict-mode warnings
  are advisory (e.g. "missing type for keyword X"), not correctness
  issues: Ajv still validates whatever the schema actually declares.
  `docs/SCHEMA_ISSUES.md` documents the specific defects found so they
  can be fixed at the source; the validator doesn't need to enforce
  schema hygiene.
- [Error attribution is a heuristic, not exact] → Scoped to error
  *messages* only (see above); verified correct on every union in the
  real schema, including all 6 non-enum-discriminated ones.
- [Removing the first-branch rule is a breaking behavior change] → Marked
  **BREAKING** in the proposal; no external callers exist yet (the agent
  tool wiring that will call this capability isn't built), so there's
  nothing to migrate today.

## Migration Plan

No deployed callers exist. `backend/src/validation/collapseFirstBranch.ts`
and its test are deleted outright rather than deprecated.
