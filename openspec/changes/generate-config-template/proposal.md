## Why

ML engineers starting a new `mef-config.json` from scratch face the same
hundreds-of-fields problem `validate-mef-config` and `get-schema-info`
already help with after a config exists — but there's nothing yet that
produces a first draft. The backend already knows how to load the schema
(`schema-loading`) and read its field metadata (`mef-schema-info`); this
change adds the capability to generate a minimal, schema-valid starting
config, closing the last of the three agent tools named in
`docs/PROJECT_SPEC.md` §5.3.

## What Changes

- Add a config-template generation capability: given the cached MEF JSON
  Schema, build a minimal config object containing every required field,
  filled with a placeholder value that satisfies that field's declared
  constraints (type, `enum`, `pattern`/`format` where feasible,
  `minimum`/`maximum`, `minItems`).
- Support a `oneOf`/`anyOf` union anywhere in the schema by committing to
  one branch (its first, unless an override selects a different one — see
  next point), so the generated template is a single coherent shape
  rather than a merge of mutually-exclusive branches.
- Support field-value overrides passed in as JSON Pointer → value pairs.
  An override is applied in two ways: (a) if its pointer names a union
  branch's discriminator field, that branch is chosen over the default
  first branch; (b) once generation finishes, the value is written at
  that pointer if the pointer resolves inside the generated tree. This is
  the general, schema-driven mechanism behind both `docs/PROJECT_SPEC.md`
  §4.1 asks — "generate a config for a specific model type" (an override
  targeting whichever field/union that turns out to be) and "substitute
  the model name the user gave" (an override targeting the model-name
  field) — without hardcoding either field's name into the generator.

Out of scope for this change: the LLM agent tool-execution loop and
GigaChat wiring that will eventually expose this as the
`generate_config_template` tool call (same boundary already used for
`validate-mef-config` and `get-schema-info` — this change delivers the
underlying generation function only). Also out of scope: creating a path
for an override that targets a field the minimal template didn't already
generate (i.e., an optional field with no override support for
materializing it from scratch) — overrides only set values already
present in the minimal (required-fields-only) tree; YAML output; and
`patternProperties`-keyed fields, since no required field is ever named
via a pattern rather than a literal key.

## Capabilities

### New Capabilities
- `mef-config-template`: generating a minimal, schema-valid MEF config
  object with every required field placeholder-filled, one committed
  branch per union, and optional JSON-Pointer-targeted value overrides.

### Modified Capabilities
- (none)

## Impact

- New backend module under `backend/src/`, alongside `schema/`,
  `schema-info/`, and `validation/`, consuming the schema exposed by the
  `schema-loading` capability (`backend-skeleton`) directly — same
  dependency `mef-config-validation` and `mef-schema-info` already rely
  on.
- No new external dependency expected — this is schema-driven object
  construction, not validation or parsing.
- No existing capability's requirements change.
