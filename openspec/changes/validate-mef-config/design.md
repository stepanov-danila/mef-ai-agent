## Context

`schema-loading` (from `backend-skeleton`) already loads and caches the
fully-dereferenced MEF JSON Schema (Draft-04) in memory as a plain object.
This change adds a validation function that consumes that object; it does
not touch how the schema is loaded.

The project's documented Phase 1 limitation for `oneOf`/`anyOf` (validate
against the first branch only, see proposal.md - What Changes) is *not*
standard JSON Schema semantics (standard `oneOf` requires exactly one
match, `anyOf` at least one). That single decision shapes most of this
design: whichever library does the mechanical Draft-04 validation, this
project needs a first-branch-only reading of `oneOf`/`anyOf` layered on
top of it.

## Goals / Non-Goals

**Goals:**
- Get correct Draft-04 keyword semantics (type coercion rules,
  `exclusiveMinimum`/`exclusiveMaximum` as booleans, etc.) without
  hand-rolling a validator.
- Make the first-branch-only `oneOf`/`anyOf` behavior an explicit,
  testable transform - not an accidental side effect of library defaults.

**Non-Goals:**
- Standard-compliant `oneOf`/`anyOf` (exactly-one / at-least-one)
  semantics - explicitly out per the documented Phase 1 limitation.
- Cross-field/dependency validation - explicitly out per proposal.md.
- The `validate_mef_config` agent-tool request/response wiring - this
  change delivers the validation function itself, called directly (e.g.
  from tests or a future thin tool wrapper), not through an LLM tool
  call.

## Decisions

- **Validator library**: `ajv` + `ajv-draft-04` (the official Ajv
  companion package for Draft-04 meta-schema/keyword semantics; Ajv 8
  itself only ships Draft-07+ out of the box). Chosen over hand-rolling a
  validator or using a Draft-2020-12-only tool: Draft-04 has real keyword
  differences (e.g. boolean `exclusiveMinimum`) that are easy to get
  subtly wrong, and Ajv is the most widely used, actively maintained JS
  validator with precise per-keyword error output.

- **`oneOf`/`anyOf` first-branch handling**: a schema pre-processing
  transform (`collapseFirstBranch`), applied once to a *copy* of the
  dereferenced schema, that recursively replaces any node containing
  `oneOf` or `anyOf` with that node merged with its first branch only
  (the keyword itself is removed after collapsing). The transformed
  schema is then compiled once with Ajv and reused for every validation
  call. Doing this as an explicit pre-processing step (rather than a
  custom Ajv keyword) keeps the "first branch only" behavior visible and
  independently testable, separate from Ajv's own keyword handling.

- **Schema caching**: the collapsed, Ajv-compiled validator is cached as
  its own module-level singleton (`backend/src/validation/`), built from
  the `schema-loading` module's cached schema. It does not mutate or
  replace the schema-loading cache, since other future capabilities
  (`get_schema_info`, `generate_config_template`) will want the
  un-collapsed schema - e.g. to show a user all `oneOf` options, not just
  the first.

- **Error shape**: each error is `{ path: string; message: string }`,
  where `path` is the config field's location (from Ajv's
  `instancePath`, e.g. `/modelName`) and `message` is a human-readable
  reason derived from Ajv's own error output (keyword + params). This
  satisfies the spec's "field path and reason" requirement without
  inventing a new error-code taxonomy.

- **Placement**: `backend/src/validation/validateConfig.ts`, not
  `backend/src/agent-tools/` - `agent-tools/` (per `backend-skeleton`'s
  design) is reserved for the LLM-facing tool wrappers, which this change
  explicitly does not add yet.

## Risks / Trade-offs

- [Collapsing `oneOf`/`anyOf` to the first branch can report an error for
  a config value that would be valid under a later branch] → This is the
  intended, documented Phase 1 behavior (see spec.md), not a bug;
  revisit when Phase 3 adds "extended validation" per
  docs/PROJECT_SPEC.md - План развития.
- [`ajv-draft-04` is an added dependency alongside `ajv`] → Both are
  small, focused, and maintained by the same team as Ajv itself; avoids
  hand-rolling Draft-04 keyword semantics.

## Migration Plan

Greenfield addition - no existing behavior changes. New module only; no
existing routes or callers are modified in this change.
