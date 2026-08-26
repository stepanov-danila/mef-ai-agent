## Context

`getSchemaInfo.ts` resolves a field path by walking `properties` only,
against a schema pre-collapsed to first-`oneOf`/`anyOf`-branch via
`collapseFirstBranch` (now shared from `schema/schemaUtils.ts`, still
used elsewhere). `mef-config-validation`, after `fix-union-validation`,
no longer collapses branches and reports error paths as JSON Pointers.
This change brings `mef-schema-info` in line with both realities: it
needs to reach the real schema's array-heavy structure, and it needs to
speak the same path dialect as the sibling capability.

The design was validated against the real schema before being written
here (path resolution, union-descent merging, and array/pattern lookups
were each prototyped and run against it; see proposal.md - Why for the
specific gaps found).

## Goals / Non-Goals

**Goals:**
- Resolve any JSON Pointer the real schema's structure requires:
  through `properties`, array `items`, and `patternProperties`.
- Report a union field's full set of variants instead of silently
  picking one, and merge correctly when a lookup path passes *through*
  a union on its way to a deeper field.
- Share one path dialect with `mef-config-validation`'s error output.

**Non-Goals:**
- The `get_schema_info` agent-tool wiring — out of scope per proposal.md.
- Recognizing `minProperties`/`maxProperties`-style implicit unions as
  unions — same non-goal as `fix-union-validation`; they still surface
  correctly as ordinary constraints via the denylist-based extraction.
- Circular `$ref` handling — no change from `fix-union-validation`'s
  assessment (the real schema has none).

## Decisions

- **Path dialect: JSON Pointer (RFC 6901), replacing dotted paths.**
  The real schema has 16 property names containing a literal `.`
  (e.g. `metadata.regInfo`), which a dot-joined path cannot address
  unambiguously. JSON Pointer's escaping (`~0`/`~1`) is a published
  standard, array indices are a natural segment, and — the deciding
  factor — `mef-config-validation` already emits `/applications/0/name`-
  style paths in its error output; matching that dialect means an error
  path can be handed straight to a schema-info lookup with no
  translation layer. There are no external callers of the dotted form to
  migrate (both capabilities are pre-release).

- **`resolveNode` gains two lookup strategies, tried after `properties`
  fails to match a segment**: a numeric segment descends into an
  `items` schema (object or array-of-object fields); a non-numeric
  segment that doesn't match any literal `properties` key is tried
  against each `patternProperties` regex. A segment matching neither
  path is "not found" — same behavior as today, just after a longer
  search.

- **Union nodes are no longer collapsed while resolving a path — but
  descending *through* one requires merging, not just "don't collapse".**
  Prototyping surfaced this precisely: if path resolution simply looks
  at branch 0 when stepping through a union node (the direct fix for
  "don't collapse"), the first-branch bug comes back through the back
  door — e.g. `/applications/0/deployStrategy` would report only
  branch 0's `enum: ["Apply"]"` instead of all five values. The fix
  verified against the real schema: when a path segment must be found
  inside a union node, look it up in *every* branch and merge the
  results (`enum` arrays unioned, first non-`enum` value of each other
  keyword kept). Verified: `deployStrategy` → all 5 values, `secrets`'
  `valueType` → all 12, `sources`' `serviceType` → all 6, after this
  fix; only branch 0's value before it.

- **Union field metadata (when the lookup path resolves exactly *to* the
  union node) reports every branch as a `variants` entry**, rather than
  merging: `{ discriminator?: { property, value }, required: string[] }`
  per branch. A discriminator is detected the same way
  `fix-union-validation`'s `branchErrors.ts` does: a branch property
  with a single-value `enum`. This is different from the *merge* case
  above — merging answers "what can this field be", `variants` answers
  "what are the distinct shapes this object can take" for a field whose
  own schema *is* the union.

- **Constraint extraction: denylist of structural keywords, replacing
  the fixed allowlist.** The real schema uses 6 constraint-shaped
  keywords the allowlist didn't cover (`uniqueItems`, `minProperties`,
  `maxProperties`, `multipleOf`, `not`, `description` — the last handled
  separately, see below) and includes 5 the schema never uses at all.
  A denylist of the schema's own structural vocabulary
  (`properties`, `patternProperties`, `items`, `additionalProperties`,
  `definitions`, `$ref`, `$schema`, `id`, `title`, `description`,
  `type`, `required`, `oneOf`, `anyOf`) reports everything else
  automatically, so a schema keyword this change's authors didn't think
  of still surfaces instead of silently vanishing.

- **`description` is its own `FieldInfo` field, not folded into
  `constraints`.** It's prose, not a validation constraint; giving it
  a dedicated optional field keeps `constraints` a machine-checkable set
  and makes "does this field have documentation" a direct check rather
  than a lookup key convention.

- **Array items: `FieldInfo.items?: { type: unknown; constraints:
  Record<string, unknown> }`**, populated when `type` is `"array"` and
  `items` is an object schema. Covers the `pipelineParameters.goals`
  case (an `enum` living on `items`, invisible today).

- **`listTopLevelFields(schemaPath)` → `listFields(schemaPath, pointer?)`.**
  Omitting `pointer` preserves today's top-level behavior; passing one
  lists the fields directly under that node (its `properties`, or the
  fields of an `items` object for an array pointer). Implemented by
  resolving the pointer to a node (empty pointer resolves to root) and
  reusing the same per-field construction as `getFieldInfo`, so the two
  entry points share one code path end to end, not two parallel ones.

## Risks / Trade-offs

- [JSON Pointer is a breaking change to `getFieldInfo`'s input format] →
  No production callers exist yet (agent-tool wiring isn't built); the
  proposal marks it BREAKING and this design doc records the rationale.
- [Union-descent merging is more code than "just don't collapse"] →
  Necessary per the prototyping trap above; verified correct against the
  real schema's three highest-traffic discriminated unions
  (`deployStrategy`, `valueType`, `serviceType`).
- [Denylist must be kept in sync if the schema's structural vocabulary
  grows (e.g. `dependencies`, `allOf` if ever introduced)] → Lower risk
  than the allowlist it replaces: a structural keyword this list misses
  leaks into `constraints` (visible, easy to spot and fix) rather than a
  constraint keyword silently vanishing (invisible, per the original
  allowlist's actual failure mode against this schema).

## Migration Plan

No deployed callers exist; `getFieldInfo`/`listTopLevelFields`'s dotted-
path behavior is replaced outright, not deprecated alongside a JSON
Pointer form.
