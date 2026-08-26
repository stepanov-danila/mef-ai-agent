## 1. Module scaffold

- [ ] 1.1 Create `backend/src/schema-info/` and implement the `FieldInfo` type (`{ path: string; type: unknown; required: boolean; constraints: Record<string, unknown> }`) in `backend/src/schema-info/getSchemaInfo.ts`; verify the file compiles with `npx tsc --noEmit`

## 2. Path resolution and constraint extraction (`mef-schema-info` capability)

- [ ] 2.1 Implement path resolution: split a dotted field path on `.`, walk `properties` at each segment starting from the schema-loading module's cached (and `collapseFirstBranch`-collapsed) root schema, applying `collapseFirstBranch` to each segment's node before descending; verify a unit test resolves a nested path (e.g. `runtime.kind`) against a fixture schema
- [ ] 2.2 Implement required resolution: a segment is required if its name is in its parent node's `required` array (false if the array is absent); verify unit tests cover both a required and a non-required field
- [ ] 2.3 Implement constraint extraction using the allowlist from design.md (`pattern`, `enum`, `minimum`, `maximum`, `exclusiveMinimum`, `exclusiveMaximum`, `minLength`, `maxLength`, `minItems`, `maxItems`, `format`); verify a unit test asserts only allowlisted keys present on a fixture field appear in the result, and non-allowlisted keys (e.g. a `description`) do not
- [ ] 2.4 Implement the "field with no constraints" case: a field with only a `type` declared returns an empty constraints object; verify a unit test

## 3. Public API (`mef-schema-info` capability)

- [ ] 3.1 Implement `getFieldInfo(schemaPath: string, fieldPath: string): Promise<FieldInfo | undefined>`, returning `undefined` for a field path that does not resolve; verify a unit test covers both a resolvable and an unresolvable (not found) path, asserting the not-found case is `undefined` rather than a default-valued result
- [ ] 3.2 Implement `listTopLevelFields(schemaPath: string): Promise<FieldInfo[]>`, returning one `FieldInfo` per top-level `properties` key of the (collapsed) root schema, reusing the required/constraint logic from section 2; verify a unit test asserts the returned list's field names match the fixture schema's top-level properties

## 4. Verification

- [ ] 4.1 Run the full backend test suite (`npm test`) and verify all tests pass, including existing `backend-skeleton` and `validate-mef-config` tests (no regressions)
- [ ] 4.2 Run `npm run build` and verify it succeeds with no type errors
