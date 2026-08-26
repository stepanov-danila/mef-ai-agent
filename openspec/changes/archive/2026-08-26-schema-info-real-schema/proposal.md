## Why

`mef-schema-info` was built and tested against synthetic fixtures before
the real MEF config schema was available. Tested against it directly:

- **Most of the config is unreachable.** `applications`, `secrets`,
  `sources`, `tests`, and `nexus` are all arrays of objects, and
  `resolveNode` only walks `properties` — it has no `items` traversal at
  all. Looking up `applications.name` or `secrets.valueType` returns "not
  found", even though those fields exist.
- **The path dialect is wrong for this schema and for the sibling
  capability.** The real schema has 16 property names containing a
  literal `.` (e.g. `metadata.regInfo`, `release.mls.version`), so a
  dot-joined path is ambiguous on this schema. Separately,
  `mef-config-validation` (via `fix-union-validation`) now reports error
  paths as JSON Pointers (e.g. `/applications/0/name`); `mef-schema-info`
  taking a different, incompatible dialect means an error path can't be
  fed straight into a field lookup.
- **`description` is discarded.** The schema carries ~200 descriptions,
  many as the *only* documentation a field has (its `$ref` target has
  none). `docs/PROJECT_SPEC.md` §4.3 requires explaining any field's
  purpose; the current constraint allowlist deliberately excludes
  `description`.
- **`items.enum` is invisible.** `pipelineParameters.goals` reports only
  `{minItems: 1}` — the 11 allowed values live in `items.enum` and are
  lost, so "what values can this field take?" goes unanswered for every
  array of scalars.
- **`oneOf`/`anyOf` fields still collapse to the first branch**, now
  inconsistent with `mef-config-validation` (which validates all
  branches as of `fix-union-validation`). A field like `deployStrategy`
  or `valueType` should report all the values it can legitimately take,
  not just the first branch's.
- **The constraint allowlist doesn't fit this schema.** 5 of its 11
  keywords never appear in the real schema; 6 keywords the real schema
  actually uses (`uniqueItems`, `minProperties`, `maxProperties`,
  `multipleOf`, `not`, `description`) aren't on it.

## What Changes

- **BREAKING** Replace the dotted field-path dialect with JSON Pointer
  (RFC 6901): `runtime.kind` becomes `/runtime/kind`. This resolves the
  dotted-property-name ambiguity, gives array indices a natural syntax
  (`/applications/0/name`), and makes an error path from
  `mef-config-validation` usable directly as a `mef-schema-info` lookup.
- Extend path resolution to walk into `items` (array element schemas, by
  numeric segment) and `patternProperties` (by regex match against the
  segment), not just `properties`.
- Stop collapsing `oneOf`/`anyOf` nodes to their first branch. A field
  declared via a union reports metadata for all its branches (see
  `variants` below), and descending *through* a union field (e.g. into
  `/applications/0/deployStrategy`) merges the field across every branch
  rather than reading only branch 0.
- Add `description` to a field's reported metadata when the schema
  declares one.
- Add item metadata (type + constraints) for array-typed fields, so an
  array of enum-constrained scalars reports its allowed values.
- Replace the fixed constraint keyword allowlist with a denylist of
  structural JSON Schema keywords, so any constraint keyword the schema
  actually uses is reported, not just a fixed list chosen up front.
- Generalize `listTopLevelFields(schemaPath)` to
  `listFields(schemaPath, pointer?)`: without a pointer, top-level
  fields (current behavior); with one, the fields declared under that
  pointer's node — answering "what's inside this array's items?" or
  "what's inside this object?", not just "what's at the root?".

Out of scope: the `get_schema_info` agent-tool request/response wiring
(same boundary as `validate-mef-config` and `fix-union-validation`);
`minProperties`/`maxProperties`-style implicit unions (not recognized as
unions here either, same as `mef-config-validation`).

## Capabilities

### New Capabilities
- (none)

### Modified Capabilities
- `mef-schema-info`: field lookup switches from dotted paths to JSON
  Pointer, gains array/`patternProperties`/union/`description` support,
  and its top-level-only listing generalizes to listing any node's
  fields.

## Impact

- `backend/src/schema-info/getSchemaInfo.ts` and its tests — path
  resolution, `FieldInfo` shape, and the public function signatures
  change.
- No new external dependency.
- No other capability's requirements change; `mef-config-validation`
  already emits JSON Pointer paths as of `fix-union-validation`, so this
  change makes the two capabilities consistent rather than diverging
  further.
