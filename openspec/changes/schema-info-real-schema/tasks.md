## 1. JSON Pointer parsing

- [x] 1.1 Implement a JSON Pointer (RFC 6901) parser in `backend/src/schema-info/getSchemaInfo.ts`: splits on `/`, drops the leading empty segment, unescapes `~1` → `/` and `~0` → `~`; returns `undefined` for a string that doesn't start with `/` (and isn't the empty string); verify a unit test covers a simple pointer, a pointer with an escaped `~1` (matching one of the real schema's 16 dotted property names, e.g. `/modelAnnotations/metadata.regInfo`), and a malformed pointer

## 2. Array and patternProperties traversal

- [x] 2.1 Extend path resolution so a numeric path segment descends into the current node's `items` schema; verify a unit test resolves a field inside an array element (e.g. `/applications/0/name`)
- [x] 2.2 Extend path resolution so a segment not matching a literal `properties` key is tried against each of the current node's `patternProperties` regular expressions; verify a unit test resolves a field via a pattern match

## 3. Union-aware resolution (merge across branches, don't collapse)

- [x] 3.1 Replace the `collapseFirstBranch`-based resolution with: when a path segment must be found inside a node that declares `oneOf`/`anyOf`, search every branch (plus the node's own `properties`, if any) for that segment, and merge the hits (`enum` arrays unioned; other keywords keep the first branch's value; `required` is true if any matching branch requires it); verify a unit test resolves a field common to every branch of a discriminated union and asserts the merged `enum`/`type` reflect all branches, not just the first
- [x] 3.2 **Regression test for the "first branch through the back door" trap found while designing this**: verify a unit test resolves a path stepping *through* a union field into a property present in every branch (e.g. a discriminator like `deployStrategy`) and asserts the result's `enum`/constraints cover every branch's value — not just branch 0's, which is what a naive "just don't collapse" implementation would still produce
- [x] 3.3 Verify a unit test confirms that when a path resolves *exactly to* a union node (no further segments), the returned node is the raw, unmerged union schema (feeds `variants` in task 5), not a merged one

## 4. FieldInfo: description, array items, constraint extraction

- [x] 4.1 Add `description?: string` to `FieldInfo` and populate it from the resolved node's `description` when present; verify a unit test on a field whose schema declares a `description`
- [x] 4.2 Add `items?: { type: unknown; constraints: Record<string, unknown> }` to `FieldInfo`, populated when the resolved node's `type` is `"array"` and its `items` is an object schema; verify a unit test on an array-of-enum-constrained-scalars field asserts `items.constraints.enum` covers all allowed values
- [x] 4.3 Replace `CONSTRAINT_KEYWORDS` (allowlist) with a denylist of structural keywords (`properties`, `patternProperties`, `items`, `additionalProperties`, `definitions`, `$ref`, `$schema`, `id`, `title`, `description`, `type`, `required`, `oneOf`, `anyOf`); verify a unit test asserts a keyword not on the old allowlist (e.g. `uniqueItems`, `multipleOf`, `not`) now appears in `constraints`, and that denylisted structural keywords never do

## 5. Union field variants

- [x] 5.1 Implement variant extraction: for a node with `oneOf`/`anyOf`, build one entry per branch — `{ discriminator?: { property: string; value: unknown }; required: string[] }` — detecting a discriminator the same way `validation/branchErrors.ts` does (a branch property with a single-value `enum`); add `variants?: FieldVariant[]` to `FieldInfo`, populated only when the resolved node is itself a union; verify a unit test on a discriminated union asserts one variant per branch with the correct discriminator property/value
- [x] 5.2 Verify a unit test on a non-discriminated union (branches distinguished only by which property is `required`, mirroring `secretConfig.valueFrom`'s pattern) asserts each variant's `required` list, with `discriminator` absent

## 6. Public API: JSON Pointer input, generalized listing

- [x] 6.1 Change `getFieldInfo(schemaPath, fieldPath)` to `getFieldInfo(schemaPath, pointer)`: parse the pointer per task 1.1, resolve via the union-aware resolver from task 3, return `undefined` for an unparseable or unresolvable pointer; update the returned `FieldInfo.path` to echo the input pointer as given
- [x] 6.2 Replace `listTopLevelFields(schemaPath)` with `listFields(schemaPath, pointer?)`: without a pointer, list the root's fields (today's behavior); with one, resolve it to a node (via task 3's resolver) and list the fields declared directly under it (through `properties`, merged across branches per task 3 if that node is itself a union); each result's `path` is the full JSON Pointer of that field (base pointer + `/` + escaped field name), not the bare field name; verify a unit test lists the fields of an array's element schema by pointing at the array (e.g. `/applications/0`)
- [x] 6.3 Update `backend/src/schema-info/getSchemaInfo.test.ts`: rewrite every dotted-path example (`modelName`, `runtime.kind`, etc.) to JSON Pointer form (`/modelName`, `/runtime/kind`); rename the `listTopLevelFields` describe block/calls to `listFields`; verify all existing assertions still pass under the new dialect

## 7. Real-schema-shaped fixture and tests

- [x] 7.1 Create `backend/src/schema-info/__fixtures__/real-schema-shaped.json`: a sanitized Draft-04 schema (no real content) covering an array of objects with a discriminated `oneOf` (≥3 branches, mirrors `applications`), a `patternProperties` node, a field with a `description`, an array of enum-constrained scalars (mirrors `pipelineParameters.goals`), and a non-discriminated union distinguished by required-property-name (mirrors `secretConfig.valueFrom`); verify the file is valid JSON and matches the Draft-04 meta-schema
- [x] 7.2 Write `backend/src/schema-info/getSchemaInfo.realSchemaShape.test.ts` exercising `getFieldInfo`/`listFields` against the fixture from 7.1, covering: array element lookup, pattern-property lookup, description, array items enum, union variants, and union-descent merging in one file separate from the core fixture tests

## 8. Optional real-schema regression harness

- [x] 8.1 Add `backend/src/schema-info/realSchema.test.ts` mirroring `validation/realSchema.test.ts`'s pattern: skipped unless `MEF_REAL_SCHEMA_PATH` is set; when set, resolves a known deep real-schema path (e.g. `/applications/0/components/models/0/settings/resources/limits/cpu`, verified during design to require an array index, a discriminated union, several `$ref` hops, and a `patternProperties` step) and asserts its `type`/`pattern`; resolves `/applications/0/deployStrategy` and asserts all 5 real branch values appear in `constraints.enum`; verify the suite passes locally with `MEF_REAL_SCHEMA_PATH` set and is skipped (not failed) when unset

## 8b. Cleanup

- [x] 8.5 **Found during implementation**: `collapseFirstBranch` in `backend/src/schema/schemaUtils.ts` was kept there only for `getSchemaInfo.ts`'s continued use (per `fix-union-validation` task 1.2); this change removes that last caller, so it's dead code. Delete `collapseFirstBranch` and its tests from `schemaUtils.ts`/`schemaUtils.test.ts`, keeping `isPlainObject`; verify `npx tsc --noEmit` passes and no other file references it

## 9. Verification

- [x] 9.1 Run `cd backend && npm test` and verify all tests pass, including existing `backend-skeleton`, `mef-config-validation`, and (rewritten) `mef-schema-info` tests, with no regressions
- [x] 9.2 Run `npm run build` and verify it succeeds with no type errors
- [x] 9.3 Run `npx @fission-ai/openspec validate --all --strict` from the repo root and verify it passes
