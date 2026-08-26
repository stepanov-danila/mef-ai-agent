## 1. Dependencies

- [x] 1.1 Add `ajv` and `ajv-draft-04` to `backend/package.json` dependencies; verify `npm install` completes with no errors

## 2. oneOf/anyOf collapse transform

- [x] 2.1 Implement `backend/src/validation/collapseFirstBranch.ts`: recursively walks a schema object and, for any node containing `oneOf` or `anyOf`, replaces the node with itself merged with its first branch (keyword removed); returns a new object without mutating the input; verify a unit test covers a top-level `oneOf`, a nested `anyOf` inside `properties`, and a schema with neither keyword (returned unchanged)
- [x] 2.2 Verify a unit test confirms the transform does not mutate the schema object passed in (compares the input's `oneOf` array is still present on the original object after the call)

## 3. Validator compilation (`mef-config-validation` capability)

- [x] 3.1 Implement `backend/src/validation/validateConfig.ts`: on first use, build the collapsed schema (via `collapseFirstBranch` on the `schema-loading` module's cached schema) and compile it once with Ajv (`ajv-draft-04` meta-schema); cache the compiled validator in a module-level singleton; verify a unit test calls the exported validate function twice and confirms compilation happens only once (e.g. via a spy on the Ajv compile call)
- [x] 3.2 Implement the error-mapping step: convert each Ajv error into `{ path: string; message: string }`, using `instancePath` for `path` and a human-readable message derived from the Ajv error's keyword/params; verify a unit test asserts the shape and content for a known invalid input

## 4. Behavior per spec (`mef-config-validation` capability)

- [x] 4.1 Verify: a config that satisfies every schema constraint returns an empty error array (unit test with a fully valid fixture config)
- [x] 4.2 Verify: a config missing a required field returns an error identifying that field's path and that it is required (unit test)
- [x] 4.3 Verify: a config field with the wrong type/pattern/enum value returns an error identifying that field's path and the violated constraint (unit test)
- [x] 4.4 Verify: a config with multiple simultaneous violations returns one error per violation, not just the first (unit test with a fixture violating 2+ constraints)
- [x] 4.5 Verify: a field whose value matches only the first `oneOf`/`anyOf` branch validates with no error, and a field whose value matches only a later branch (not the first) reports an error describing the first-branch mismatch (unit test using a schema fixture with a multi-branch `oneOf`)

## 5. Verification

- [x] 5.1 Run the full backend test suite (`npm test`) and verify all tests pass, including the existing `backend-skeleton` tests (no regressions)
- [x] 5.2 Run `npm run build` and verify it succeeds with no type errors
