## 1. Project scaffold

- [ ] 1.1 Create `backend/` with `package.json` (name, scripts: `dev`, `build`, `start`) and verify `npm install` succeeds from `backend/`
- [ ] 1.2 Add `tsconfig.json` with `strict: true` targeting Node.js, and verify `npm run build` produces `backend/dist/`
- [ ] 1.3 Add dependencies: `express`, `@apidevtools/json-schema-ref-parser`, `dotenv`, and dev dependencies `typescript`, `tsx`, `@types/express`, `@types/node`; verify `npm install` completes with no errors
- [ ] 1.4 Create the folder layout from design.md (`src/index.ts`, `src/app.ts`, `src/config.ts`, `src/routes/`, `src/schema/`, `src/types/`, `src/agent-tools/`) and verify the files/folders exist

## 2. Config module

- [ ] 2.1 Implement `src/config.ts` reading `PORT` (default `3000`) and `MEF_SCHEMA_PATH` (required, no default) from `process.env`, loaded via `dotenv` in development, and verify a unit test confirms defaults apply when env vars are unset

## 3. Backend service foundation (`backend-service-foundation` capability)

- [ ] 3.1 Implement `src/app.ts`: create the Express 5 app, JSON body parsing, and mount routes; verify the app module exports a callable Express app
- [ ] 3.2 Implement `GET /health` in `src/routes/health.ts` returning HTTP 200 with `{ "status": "ok" }`; verify an integration test hits the route and asserts the response
- [ ] 3.3 Implement a central Express error-handling middleware that turns any error reaching it into an HTTP 5xx JSON response; verify a test route that throws/rejects is caught and returns 5xx without crashing the process
- [ ] 3.4 Implement `src/index.ts`: load the schema (see Section 4), then start the HTTP server on `config.port`; verify starting the process with a valid schema path successfully logs a "listening" message
- [ ] 3.5 Verify the port-in-use failure path: starting a second instance on an already-bound port exits with a non-zero status and a descriptive error message

## 4. Schema loading (`schema-loading` capability)

- [ ] 4.1 Implement `src/schema/loadSchema.ts`: read the JSON file at `config.mefSchemaPath`, parse it, and reject non-JSON/unreadable files with a descriptive error; verify a unit test covers a missing file and an invalid-JSON file
- [ ] 4.2 Resolve internal `$ref` references with `@apidevtools/json-schema-ref-parser`'s `dereference()`; verify a unit test loads a fixture schema containing internal `$ref` entries and asserts the returned object has no remaining `$ref` keys
- [ ] 4.3 Handle unresolvable `$ref` (e.g., pointing at a missing definition) by failing with a descriptive error identifying the reference; verify a unit test covers this case
- [ ] 4.4 Cache the resolved schema in a module-level singleton after first load, exposing a `getSchema()` accessor; verify a unit test calls `getSchema()` twice and confirms the file is only read/dereferenced once (e.g., via a spy/mock on the file read)
- [ ] 4.5 Wire startup failure: any error from 4.1-4.3 during `src/index.ts` startup logs the error and calls `process.exit(1)` before the HTTP server starts listening; verify an integration test asserts the process does not start listening when given a bad schema path

## 5. Verification

- [ ] 5.1 Run the full test suite (`npm test`) and verify all tests pass
- [ ] 5.2 Manually start the service with a real MEF schema fixture, `curl` `GET /health`, and confirm HTTP 200 with `{ "status": "ok" }`
