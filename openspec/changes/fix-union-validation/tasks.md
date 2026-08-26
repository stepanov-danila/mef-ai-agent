## 1. Shared schema utility

- [ ] 1.1 Create `backend/src/schema/schemaUtils.ts` exporting `isPlainObject` (moved verbatim from `collapseFirstBranch.ts`); update `backend/src/schema-info/getSchemaInfo.ts`'s import to the new location; verify `npx tsc --noEmit` passes

## 2. Sanitized test fixture

- [ ] 2.1 Create `backend/src/validation/__fixtures__/union-schema.json`: a Draft-04 schema reproducing (without any real internal data) an array of objects whose items are a `oneOf` of ≥3 branches discriminated by a single-value `enum` property required by the parent (mirrors `applications`/`secretConfig`); a second `oneOf` whose branches are distinguished only by which property is `required` (mirrors the `vaultSecretRef`/`vaultADSecretRef` pattern); a single-branch `oneOf`; a `oneOf` nested inside another `oneOf`'s branch; a node with an unrecognized keyword outside `properties` (mirrors the `s3Client` defect); verify the file is valid JSON and matches the Draft-04 meta-schema (`ajv-draft-04`'s own compile of it as a schema)

## 3. Union error attribution

- [ ] 3.1 Implement `backend/src/validation/branchErrors.ts` exporting `attributeUnionErrors(errors: ErrorObject[]): ErrorObject[]` per design.md's algorithm (deepest-first grouping by union `schemaPath`, branch scoring, drop non-selected branches and the generic union error); verify a unit test feeds it a hand-built Ajv-shaped error array (not a live Ajv run) covering: an enum-discriminated union, a required-property-discriminated union, and a nested union, and asserts only the intended branch's errors remain
- [ ] 3.2 Verify a unit test confirms the generic `oneOf`/`anyOf` "must match exactly one/any schema" error itself is dropped from the output, not just the losing branches' errors

## 4. Validator changes

- [ ] 4.1 Update `backend/src/validation/validateConfig.ts`: construct Ajv with `{ allErrors: true, strict: false }`; remove the `collapseFirstBranch` call so the schema from `schema-loading` is compiled as-is; verify a unit test compiles `union-schema.json` successfully (previously would have thrown on a schema with this shape once the unrecognized-keyword fixture node is present)
- [ ] 4.2 Wire `attributeUnionErrors` into `validateConfig`'s error path, applied to `validate.errors` before mapping to `{path, message}`; verify a unit test on `union-schema.json`: a config matching the 2nd (non-first) enum-discriminated branch validates with zero errors; a config with 2 genuine mistakes in one branch produces exactly the errors for that branch, not the other branches' errors and not the generic union message
- [ ] 4.3 Delete `backend/src/validation/collapseFirstBranch.ts` and `collapseFirstBranch.test.ts`

## 5. Optional real-schema regression harness

- [ ] 5.1 Add `backend/src/validation/realSchema.test.ts`: reads `process.env.MEF_REAL_SCHEMA_PATH`; if unset, `describe.skip`; if set, runs `validateConfig` against it with a minimal config using a non-first branch of a real multi-branch union (e.g. `deployStrategy: "None"`) and asserts zero errors, and against a config with a deliberate mistake asserting the error count is small (≤3) rather than the double-digit count the un-fixed code produces; verify the suite passes locally when run with `MEF_REAL_SCHEMA_PATH` set to the real schema, and is skipped (not failed) when unset
- [ ] 5.2 Add `*.local.json` to `backend/.gitignore`

## 6. Docs and spec-context updates

- [ ] 6.1 Update `docs/PROJECT_SPEC.md` §7.1: remove "Ограниченная обработка `oneOf`/`anyOf` (выбор первого варианта)"; state that unions are validated with standard semantics and that `minProperties`/`maxProperties`-style implicit unions aren't recognized as unions for error-message purposes (still validate correctly as constraints)
- [ ] 6.2 Update `openspec/config.yaml`'s `context:` block to match (the "oneOf/anyOf: only the first branch is handled" line)
- [ ] 6.3 Create `docs/SCHEMA_ISSUES.md` documenting the three real-schema defects found (`mlsConfig.s3Client` keyword outside `properties`; `profiler`'s `type:"object"` + `items`; `resources`' unanchored `patternProperties`), each with what's affected and why the backend doesn't attempt to work around them beyond tolerating compilation

## 7. Verification

- [ ] 7.1 Run `cd backend && npm test` and verify all tests pass, including existing `backend-skeleton`, `mef-config-validation`, and `mef-schema-info` tests (no regressions)
- [ ] 7.2 Run `npm run build` and verify it succeeds with no type errors
- [ ] 7.3 Run `npx @fission-ai/openspec validate --all --strict` from the repo root and verify it passes
