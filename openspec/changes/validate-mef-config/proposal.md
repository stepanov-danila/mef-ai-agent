## Why

ML engineers currently only find out their `mef-config.json` is invalid
after running the MEF deploy pipeline — a slow, expensive way to discover
a typo or a missing field. The backend can now load and cache the MEF
JSON Schema (`schema-loading`, from `backend-skeleton`), so the next step
is a validation capability the future agent tool-execution loop can call
to check a config against that schema and report exactly what's wrong,
before deployment.

## What Changes

- Add a config-validation capability: given a MEF config (JSON) and the
  cached MEF JSON Schema, validate the config and return a structured
  list of errors — each naming the offending field's path and the reason
  it failed.
- A config that fully conforms to the schema validates with zero errors.
- Handle `oneOf`/`anyOf` per the project's documented Phase 1 limitation:
  validate against the first branch only (see docs/PROJECT_SPEC.md -
  Текущие ограничения).
- Cross-field/dependency validation stays out of scope (also a documented
  Phase 1 limitation) — only per-field, schema-declared constraints are
  checked.

Out of scope for this change: the LLM agent tool-execution loop and
GigaChat wiring that will eventually call this capability, YAML configs
(JSON only), and automatic error correction (Phase 1 is report-only, per
docs/PROJECT_SPEC.md - Ограничения и допущения). Exposing this as the
`validate_mef_config` agent tool's request/response wiring to an LLM is
also deferred — this change delivers the underlying validation
capability as an internal backend function.

## Capabilities

### New Capabilities
- `mef-config-validation`: validating a MEF config against the cached MEF
  JSON Schema and producing a structured list of field-level errors.

### Modified Capabilities
- (none)

## Impact

- New backend module under `backend/src/` that consumes the schema
  exposed by the `schema-loading` capability (`backend-skeleton`).
- New dependency: a JSON Schema Draft-04 validator library.
- No existing capability's requirements change.
