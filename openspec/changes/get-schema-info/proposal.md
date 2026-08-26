## Why

ML engineers writing a `mef-config.json` by hand need to know what a
field expects — its type, whether it's required, and its format
constraints (pattern, enum, min/max) — without digging through the raw
JSON Schema themselves. The backend already loads and caches that schema
(`schema-loading`); this change adds the lookup capability the future
agent tool-execution loop can call to answer "what does field X need?"
and "what fields exist at all?".

## What Changes

- Add a schema-info capability: given a field path within the MEF config
  (e.g. `modelName`, or a nested path like `runtime.kind`), look it up in
  the cached MEF JSON Schema and return its metadata — type, whether it's
  required (by its parent object), and whatever format constraints the
  schema declares for it (pattern, enum, minimum/maximum, etc.).
- Support listing metadata for every top-level field when no path is
  given, since "what fields exist and what do they need?" is a common
  starting question.
- An unknown field path (not present in the schema) is reported as a
  distinct "not found" result, not conflated with a field that exists but
  has no constraints.

Out of scope for this change: the LLM agent tool-execution loop and
GigaChat wiring that will eventually call this capability (same boundary
as `validate-mef-config`) — this change delivers the underlying lookup
function only, not the `get_schema_info` tool's request/response wiring
to an LLM.

## Capabilities

### New Capabilities
- `mef-schema-info`: looking up a MEF config field's metadata (type,
  required, format constraints) from the cached MEF JSON Schema, by path
  or as a full top-level listing.

### Modified Capabilities
- (none)

## Impact

- New backend module under `backend/src/` that consumes the schema
  exposed by the `schema-loading` capability (`backend-skeleton`), the
  same dependency `mef-config-validation` already relies on.
- No new external dependency expected — this is schema tree lookup, not
  schema validation.
- No existing capability's requirements change.
