## Context

`backend/src/app.ts`'s `createApp()` currently mounts only
`healthRouter` (`GET /health`, no input) ahead of a catch-all
`errorHandler` that unconditionally responds `500`. The three
capabilities this change exposes already exist as plain async functions
taking `config.mefSchemaPath` (from `backend/src/config.ts`, a
module-level singleton read from `MEF_SCHEMA_PATH` at import time) as
their first argument: `validateConfig` (`validation/validateConfig.ts`),
`getFieldInfo`/`listFields` (`schema-info/getSchemaInfo.ts`), and
`generateConfigTemplate` (`config-template/generateConfigTemplate.ts`).
`vitest.config.ts` already sets `MEF_SCHEMA_PATH` for every test file
specifically anticipating a file that "transitively imports" `config.ts`
— i.e., anticipating routes like these.

## Goals / Non-Goals

**Goals:**
- One thin Express route per capability operation, each parsing/
  validating its own request input and delegating to the existing
  function — no business logic duplicated in the route layer.
- A single, small error-handler fix (respect `err.status`/
  `err.statusCode`) so a route's `400`-worthy input error reaches the
  client as `400`, not `500`.

**Non-Goals:**
- Authentication, rate limiting, request size limits — Phase 1 security
  items not yet designed (`docs/PROJECT_SPEC.md` §5.4), unrelated to
  making these three capabilities reachable at all.
- Any masking/redaction pass on response bodies — out of scope per
  proposal.md; none of these responses can contain a request-external
  secret (validation echoes back only paths/messages; generation only
  ever fills placeholders).
- Multi-schema support (a `schemaPath` per request) — the backend serves
  one configured schema, matching every existing capability's usage.

## Decisions

- **Route file layout**: one file per capability under
  `backend/src/routes/`, mirroring `health.ts`'s existing
  `Router()`-per-file convention: `validateConfig.ts` (route),
  `schemaInfo.ts`, `generateTemplate.ts`. (Named to avoid collision with
  the same-named modules under `validation/`/`schema-info/`/
  `config-template/` that they import from — Node/TS resolve by full
  relative path, but distinct names keep stack traces and imports
  unambiguous for a reader.)

- **`get-schema-info` as two routes, not one with a flag**: `getFieldInfo`
  (single field, 404-able) and `listFields` (always an array, never 404s)
  have different response shapes and error semantics. A single endpoint
  branching on a query flag would blur that distinction in the route
  itself; `/field` vs `/list` keeps each route's request/response
  contract uniform, mirroring the two distinct functions it wraps 1:1.

- **`validate-mef-config`'s body is the config itself, not `{ config }`**:
  the endpoint's entire purpose is "validate this document" — wrapping it
  in an envelope key would be pure ceremony. `generate-config-template`,
  by contrast, wraps in `{ overrides }` because its body isn't itself a
  config; overrides is one optional field among a response that IS a
  generated config, so a bare body would be ambiguous.

- **Query/body validation lives in the route, not a shared middleware**:
  each route's input shape is different enough (a required pointer vs. an
  optional one vs. a JSON body key) that a generic validation middleware
  would need per-route configuration anyway; three short, readable
  `if` checks are simpler than a middleware abstraction for three call
  sites.

- **Error handler fix**: change
  `res.status(500).json(...)` to
  `res.status(typeof err?.status === "number" ? err.status : typeof err?.statusCode === "number" ? err.statusCode : 500).json({ error: err?.message ?? "Internal server error" })`
  guarded so a non-Error-like thrown value still falls back to the
  existing generic message. Express's built-in JSON body-parser
  (`express.json()`, already mounted) throws a `SyntaxError` with
  `.status = 400` and `.expose = true` for unparseable JSON — the
  motivating case — without any new dependency.

- **404 vs 400 for `get-schema-info/field`**: a syntactically valid
  pointer that doesn't resolve is `404` (matches `mef-schema-info`'s own
  "not found" vs. "no constraints" distinction); a missing or
  syntactically malformed pointer (fails `parsePointer`) is a client
  request error, `400`, since it's not a lookup that failed but a request
  that wasn't well-formed. `parsePointer` is already exported from
  `getSchemaInfo.ts` for this exact check.

- **`list` never 404s**: per `mef-schema-info`'s existing contract,
  `listFields` returns `[]` for a pointer that doesn't resolve to
  anything listable — the route passes that through as a `200` with an
  empty array, not a `404`, keeping "list" and "single-field lookup"
  behaviorally distinct as designed upstream.

## Risks / Trade-offs

- [Response shapes (`{ errors: [...] }`, `{ field: {...} }`,
  `{ fields: [...] }`, generated config as the bare body) are chosen now,
  ahead of the still-undesigned agent tool-execution loop, and could need
  to change once that loop's actual calling convention is designed] →
  Accepted: these are the natural HTTP-level shapes for what each
  function already returns: an array, an optional single object, an
  array, and an object, respectively. If the tool-loop needs a different
  envelope, adapting these thin routes is a small, contained change.
- [The error-handler fix changes `GET /health`'s error path too (any
  future error thrown there would now honor `.status` if set)] → No
  observable change for `/health` today: it throws nothing, and
  `app.test.ts`'s existing thrown-error tests use a generic `Error`
  with no `.status`, which still falls through to `500` exactly as
  before.

## Migration Plan

Additive only — three new routes and a backwards-compatible widening of
the error handler's status selection (defaults to the same `500` any
existing caller already sees for a status-less error). No existing route
or response shape changes.
