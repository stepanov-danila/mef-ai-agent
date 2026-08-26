## Context

`schema-loading` (from `backend-skeleton`) caches the fully-dereferenced
MEF JSON Schema in memory. `mef-config-validation` (from
`validate-mef-config`) already added `collapseFirstBranch` - a
non-mutating transform that resolves a schema's `oneOf`/`anyOf` nodes to
their first branch, matching this project's documented Phase 1
`oneOf`/`anyOf` handling. This change needs the same first-branch reading
whenever a looked-up field is itself declared via `oneOf`/`anyOf`, so it
reuses that transform rather than re-deciding the behavior.

## Goals / Non-Goals

**Goals:**
- Resolve a dotted field path (e.g. `runtime.kind`) against `properties`
  nesting and report type/required/constraints for it.
- Reuse `collapseFirstBranch` for consistency with how
  `mef-config-validation` already reads `oneOf`/`anyOf`, rather than
  introducing a second, possibly diverging interpretation.

**Non-Goals:**
- Array-item paths (e.g. indexing into `items` for array-typed fields) -
  the proposal only asks for object-property nesting; add this later if
  a real MEF config field needs it.
- The `get_schema_info` agent-tool request/response wiring - out of scope
  per proposal.md, same boundary as `validate-mef-config`.

## Decisions

- **Placement**: `backend/src/schema-info/getSchemaInfo.ts`, alongside
  `backend/src/schema/` (schema loading) and `backend/src/validation/`
  (config validation) as siblings under `backend/src/`.

- **Path resolution**: split the field path on `.` and walk each segment
  through the current node's `properties[segment]`, starting from the
  (collapsed) root schema. At each step, before descending, apply
  `collapseFirstBranch` to the segment's node so a field declared via
  `oneOf`/`anyOf` is read consistently with validation. A segment with no
  matching `properties` entry at any point means the path doesn't exist -
  return the "not found" result immediately rather than partially
  resolving.

- **Required resolution**: at each level, a segment is "required" if its
  name appears in its *parent* node's `required` array (missing
  `required` array on the parent means false, not an error).

- **Constraint extraction**: an explicit allowlist of Draft-04 keywords -
  `pattern`, `enum`, `minimum`, `maximum`, `exclusiveMinimum`,
  `exclusiveMaximum`, `minLength`, `maxLength`, `minItems`, `maxItems`,
  `format` - copied from the resolved field node, if present, into the
  result's constraints object. An allowlist (not "everything except
  `type`/`properties`/`required`") keeps schema-internal plumbing
  (`properties`, `additionalProperties`, `definitions`, `$ref`
  remnants, etc.) from leaking into what's meant to be a small,
  human-readable constraints summary.

- **Top-level listing**: iterate the (collapsed) root schema's
  `properties` keys directly and build one result per key, reusing the
  same required/constraint-extraction logic as single-field lookup (no
  separate code path).

- **Result shape**: `{ path: string; type: unknown; required: boolean;
  constraints: Record<string, unknown> }` for a found field, or a
  distinct not-found marker (e.g. `undefined` return from the lookup
  function, or `{ found: false }` in the listing case) - never a "found"
  result with empty/default values standing in for "not found", per the
  spec's explicit distinction.

## Risks / Trade-offs

- [Reusing `collapseFirstBranch` couples this capability to
  `mef-config-validation`'s module] → Intentional: both capabilities
  must read `oneOf`/`anyOf` the same way, or a field could validate
  against one branch but report metadata for another; importing a small,
  already-tested pure function is preferable to duplicating the logic.
- [Constraint allowlist needs updating if the MEF schema starts using a
  Draft-04 keyword not on the list] → Low risk in Phase 1 (schema draft
  version is assumed stable per docs/PROJECT_SPEC.md); revisit if a real
  schema field's constraint goes missing from output.

## Migration Plan

Greenfield addition - no existing behavior changes. New module only.
