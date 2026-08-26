## 1. Error handler fix

- [x] 1.1 Update `backend/src/app.ts`'s `errorHandler` to respond with `err.status`/`err.statusCode` when either is a number, falling back to `500`, and to use `err.message` when present (falling back to `"Internal server error"`); verify existing `app.test.ts` tests still pass unmodified (a status-less `Error` still yields `500`) and add a test that a thrown error with `status: 400` yields a `400` response with that error's message

## 2. validate-mef-config route

- [x] 2.1 Create `backend/src/routes/validateConfig.ts` exporting a `Router` with `POST /tools/validate-mef-config`: calls `validateConfig(config.mefSchemaPath, req.body)` from `../validation/validateConfig.js` and responds `200` with `{ errors }`; verify an integration test (supertest, mirroring `app.test.ts`'s pattern) posts a schema-valid config and asserts `200` with `{ errors: [] }`
- [x] 2.2 Verify an integration test posts a config violating a schema constraint and asserts `200` with a non-empty `errors` array containing the expected field path
- [x] 2.3 Verify an integration test posts a malformed-JSON body (raw string, wrong `Content-Type: application/json` header, unparseable) and asserts `400` with a descriptive error, exercising the task-1 error-handler fix end to end

## 3. get-schema-info routes

- [x] 3.1 Create `backend/src/routes/schemaInfo.ts` exporting a `Router` with `GET /tools/get-schema-info/field`: reads `pointer` from `req.query`, responds `400` when missing or when `parsePointer` (imported from `../schema-info/getSchemaInfo.js`) rejects it, calls `getFieldInfo(config.mefSchemaPath, pointer)`, responds `404` with a descriptive error when it returns `undefined`, otherwise `200` with `{ field: <FieldInfo> }`; verify integration tests cover an existing top-level field (`200`), a non-existent field path (`404`), and a missing `pointer` query parameter (`400`)
- [x] 3.2 Add `GET /tools/get-schema-info/list` to the same router: reads optional `pointer` from `req.query`, responds `400` when present but `parsePointer` rejects it, calls `listFields(config.mefSchemaPath, pointer)`, responds `200` with `{ fields: <FieldInfo[]> }`; verify integration tests cover no `pointer` (root listing), a `pointer` identifying an object node (nested listing), and a malformed `pointer` (`400`)

## 4. generate-config-template route

- [x] 4.1 Create `backend/src/routes/generateTemplate.ts` exporting a `Router` with `POST /tools/generate-config-template`: reads optional `overrides` from `req.body`, responds `400` when present but not a plain JSON object, calls `generateConfigTemplate(config.mefSchemaPath, overrides)` from `../config-template/generateConfigTemplate.js`, responds `200` with the generated config as the bare response body; verify integration tests cover an empty body (`200`, minimal template) and a body with a valid `overrides` object (`200`, override reflected in the response)
- [x] 4.2 Verify an integration test posts a body whose `overrides` field is present but not an object (e.g. a string or array) and asserts `400` with a descriptive error

## 5. Wiring

- [x] 5.1 Mount all three new routers in `backend/src/app.ts`'s `createApp()` alongside `healthRouter`; verify `npx tsc --noEmit` passes and a smoke integration test hits all three route groups (`/tools/validate-mef-config`, `/tools/get-schema-info/field`, `/tools/generate-config-template`) against the running app and gets non-`404` responses

## 6. Verification

- [x] 6.1 Run `cd backend && npm test` and verify all tests pass, including every existing capability's tests (no regressions)
- [x] 6.2 Run `npm run build` and verify it succeeds with no type errors
- [x] 6.3 Run `npx @fission-ai/openspec validate --all --strict` from the repo root and verify it passes
