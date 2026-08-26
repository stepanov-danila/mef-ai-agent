## 1. Module scaffold

- [x] 1.1 Create `backend/src/config-template/generateConfigTemplate.ts` importing `getSchema` from `../schema/loadSchema.js` and `isPlainObject` from `../schema/schemaUtils.js`; verify the file compiles with `npx tsc --noEmit`

## 2. Fixtures

- [x] 2.1 Create `backend/src/config-template/__fixtures__/generate-schema.json`: a Draft-04 schema with required and optional scalar fields (string with `pattern`, string with `enum`, string with `format: "email"`, integer with `minimum`/`maximum`), a required nested object with its own required sub-field, a required array field with `minItems: 2` and an object item schema whose own required field must also be filled, and an optional field that must never appear in output; verify the file is valid JSON and matches the Draft-04 meta-schema (mirrors `backend/src/schema-info/__fixtures__/schema-info-schema.json`'s existing pattern)
- [x] 2.2 Create `backend/src/config-template/__fixtures__/union-schema.json`: a Draft-04 schema with a required field whose value is a `oneOf` of ≥2 branches discriminated by a single-value `enum` property (mirrors `backend/src/validation/__fixtures__/union-schema.json`'s enum-discriminator branch), each branch with its own distinct required field; verify the file is valid JSON and matches the Draft-04 meta-schema

## 3. Required-field walk and placeholder values

- [x] 3.1 Implement the recursive `buildValue(node, pointer, overrides)` walker per design.md: object nodes iterate `required` and recurse into `properties[name]` (skipping a required name absent from `properties`); verify a unit test against `generate-schema.json` asserts every required field (including the nested required object's own required sub-field) is present and every optional field is absent
- [x] 3.2 Implement scalar placeholder generation for `enum` (first value), `type: "string"` with `format` (fixed table: `date-time`, `date`, `email`, `uri`, generic fallback), `type: "string"` with `pattern` (candidate-list match, `"example"` fallback), `type: "string"` with `minLength`/`maxLength`, `type: "integer"`/`"number"` with `minimum`/`exclusiveMinimum`/`maximum`/`exclusiveMaximum`, `type: "boolean"`, typeless `object`/`array`, and fully untyped nodes (`null`); verify unit tests cover each case against fields in `generate-schema.json` and assert the produced value actually satisfies the declared constraint (e.g. matches the `pattern` via `RegExp.test`, falls within `minimum`/`maximum`)
- [x] 3.3 Implement array generation: `node.minItems ?? 0` elements, each built via `buildValue` against `node.items`; verify a unit test on the `minItems: 2` array field asserts at least 2 elements, each satisfying the item schema's own required fields

## 4. Union branch selection

- [x] 4.1 Implement discriminator detection (first branch property whose schema has a single-value `enum`) and default first-branch selection, merging the chosen branch into the node like the deleted `collapseFirstBranch` did; verify a unit test against `union-schema.json` with no overrides asserts the output matches the first branch's shape (its required field present, no other branch's required field present)
- [x] 4.2 Implement override-driven branch selection: when an override's pointer equals `${pointer}/${discriminatorProperty}` and its value matches a non-first branch's discriminator value, select that branch instead; verify a unit test against `union-schema.json` with such an override asserts the output matches that branch instead of the first

## 5. Field-value overrides (public API)

- [x] 5.1 Implement `generateConfigTemplate(schemaPath: string, overrides?: Record<string, unknown>): Promise<Record<string, unknown>>`, reusing `parsePointer` from `../schema-info/getSchemaInfo.js` to parse each override key; after generation, walk each parsed pointer against the generated plain object and set the final segment's value only if every prior segment already resolves to an existing container; verify a unit test overrides a generated required string field (e.g. a model-name-shaped field) and asserts the output carries the override's value instead of the placeholder
- [x] 5.2 Verify a unit test supplies an override pointer that does not resolve against the generated tree (targets an optional field the minimal template omitted) and asserts the generated output is unaffected, with no error thrown
- [x] 5.3 Verify a unit test calls `generateConfigTemplate` with no `overrides` argument at all and asserts it generates the same minimal template as calling it with `{}`

## 6. Cross-check against validation

- [x] 6.1 Add a unit test that generates a template from `backend/src/validation/__fixtures__/union-schema.json` (the real-shaped fixture already used by `mef-config-validation`'s tests) with no overrides, then feeds the result through `validateConfig` from `../validation/validateConfig.js`, asserting zero errors — a concrete regression check that generation and validation agree on what "valid" means for a realistic multi-branch schema

## 7. Optional real-schema regression harness

- [x] 7.1 Add `backend/src/config-template/realSchema.test.ts` mirroring the existing pattern in `validation/realSchema.test.ts` and `schema-info/realSchema.test.ts`: skipped unless `process.env.MEF_REAL_SCHEMA_PATH` is set; when set, generates a template with no overrides and asserts `validateConfig` reports zero errors against it, then generates again with a `modelName`-shaped override and asserts the override's value appears at that field in the output; verify the suite passes locally with `MEF_REAL_SCHEMA_PATH` set and is skipped (not failed) when unset

## 8. Verification

- [x] 8.1 Run `cd backend && npm test` and verify all tests pass, including existing `backend-skeleton`, `mef-config-validation`, and `mef-schema-info` tests (no regressions)
- [x] 8.2 Run `npm run build` and verify it succeeds with no type errors
- [x] 8.3 Run `npx @fission-ai/openspec validate --all --strict` from the repo root and verify it passes
