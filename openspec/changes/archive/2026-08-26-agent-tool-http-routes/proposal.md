## Why

`validate-mef-config`, `mef-schema-info`, and `mef-config-template` each
already deliver the underlying function an agent tool needs, but each
proposal explicitly deferred "the request/response wiring" as out of
scope. Nothing outside a test file can call them yet. Before the LLM
agent tool-execution loop and GigaChat wiring exist to call these
functions as tools, they need to be reachable over HTTP at all — both so
the (still-to-come) frontend/agent loop has something concrete to call,
and so each capability can be exercised and verified independently of
that larger integration.

## What Changes

- Add three HTTP routes on the existing Express app, one per capability:
  - `POST /tools/validate-mef-config` — body is a MEF config document;
    response is its validation errors (empty array when valid).
  - `GET /tools/get-schema-info/field` — `pointer` query parameter;
    response is that field's metadata, or a 404 when not found.
  - `GET /tools/get-schema-info/list` — optional `pointer` query
    parameter; response is the list of fields declared under it (or at
    the schema root when omitted).
  - `POST /tools/generate-config-template` — optional JSON body
    `{ overrides }`; response is the generated config.
- Each route uses the schema path from the existing `config` module
  (`MEF_SCHEMA_PATH`) rather than accepting one from the request, since
  this backend serves a single MEF schema.
- Each route validates its own request shape (e.g. a missing/malformed
  `pointer`, a non-object `overrides`) and responds `400` with a
  descriptive error, rather than reaching the generic error handler.
- Fix the central error handler to honor an error's own `status` (falling
  back to `500`), so a client mistake — such as `POST
  /tools/validate-mef-config` with an unparseable JSON body, which
  Express's body parser already flags with a `400` status — is reported
  as `400` instead of the generic `500` every uncaught error currently
  produces. This is a one-line correction the new POST routes are the
  first thing in this codebase to actually exercise; `GET /health` never
  had a body to get wrong.

Out of scope: the LLM agent tool-execution loop and GigaChat wiring that
will eventually call these routes; authentication/rate limiting on the
routes (Phase 1's `docs/PROJECT_SPEC.md` §5.4 item, not yet designed);
request body size limits beyond Express's existing default; masking
sensitive fields in a validated/generated config before it's returned
(no route in this change returns anything containing secret values from
outside the request itself — `validate-mef-config` echoes back only
field paths and messages, `generate-config-template` only ever fills
placeholders).

## Capabilities

### New Capabilities
- `agent-tool-api`: HTTP endpoints exposing `validate-mef-config`,
  `mef-schema-info`, and `mef-config-template` for external callers.

### Modified Capabilities
- (none — the error-handler status fix is an implementation-level
  correction with no previously-specified behavior to change; `GET
  /health`'s only documented behavior, an unconditional `200`, is
  unaffected)

## Impact

- New routes under `backend/src/routes/`, wired into `createApp()` in
  `backend/src/app.ts`.
- `backend/src/app.ts`'s error handler gains a one-line change (read
  `err.status`/`err.statusCode` when present).
- Each route is a thin adapter calling an already-implemented function
  (`validateConfig`, `getFieldInfo`/`listFields`,
  `generateConfigTemplate`) — no changes to those functions themselves.
- No new external dependency.
