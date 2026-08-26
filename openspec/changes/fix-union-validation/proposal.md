## Why

The `mef-config-validation` capability was built against synthetic fixtures. The
real MEF config schema (4729 lines, 82 definitions, 597 `$ref`) has now been
tested against the implementation, and the capability does not work on it:

1. **Validation cannot run at all.** The validator is constructed with Ajv's
   default strict mode, and the real schema contains a node with a keyword
   outside `properties`, so compiling it throws `strict mode: unknown keyword`.
   Every validation request would fail.
2. **The "first branch only" rule reports errors that are not real.** A minimal,
   legitimate config validates cleanly under standard JSON Schema semantics but
   is rejected with two fabricated errors under the current behaviour. The real
   schema has 15 multi-branch unions, and they sit on its most-used fields:
   `secrets` (a required top-level field, 12 branches keyed by `valueType`),
   `applications` (5 branches keyed by `deployStrategy`), and `build` (6
   branches keyed by `serviceType`). Under the current rule only one branch of
   each is accepted, so most valid configs are rejected.

The Phase 1 limitation was not a simplification on this schema — it produces
false negatives. Removing it also removes code: Ajv implements `oneOf`/`anyOf`
correctly already, and the implementation deliberately overrides that.

The real problem the limitation was avoiding is error noise: with correct
semantics, a config with 2 genuine mistakes produces 13 Ajv errors, because
every branch's failures are reported plus a generic "must match exactly one
schema in oneOf". That is solved by attributing errors to the branch the data
was aimed at, rather than by discarding branches.

## What Changes

- **BREAKING** Remove the "validate against the first branch only" behaviour.
  `oneOf`/`anyOf` are validated with standard JSON Schema semantics, so a config
  matching any valid branch is accepted.
- Compile schemas tolerantly, so a schema carrying keywords the validator does
  not recognise still validates rather than failing to load.
- When a union fails, report only the errors of the branch the config was aimed
  at, chosen from the config's own discriminator value, and drop the generic
  union error. A union failure yields a short, specific error list instead of
  every branch's failures concatenated.
- Delete the now-unused first-branch collapse transform; move its shared
  object-type guard to a shared schema utility module.

Out of scope: the `mef-schema-info` capability's own gaps against the real
schema (arrays, `patternProperties`, `description`) — a separate follow-up
change; the LLM agent loop and GigaChat wiring.

## Capabilities

### New Capabilities
- (none)

### Modified Capabilities
- `mef-config-validation`: the `oneOf`/`anyOf` first-branch requirement is
  removed and replaced with standard union semantics plus branch-attributed
  error reporting; a new requirement covers tolerating schemas that carry
  unrecognised keywords.

## Impact

- `backend/src/validation/validateConfig.ts` — validator options and error mapping.
- `backend/src/validation/collapseFirstBranch.ts` and its test — deleted.
- New `backend/src/validation/branchErrors.ts` and `backend/src/schema/schemaUtils.ts`.
- `backend/src/schema-info/getSchemaInfo.ts` — imports updated to the new shared
  utility; its own behaviour is unchanged by this change.
- `docs/PROJECT_SPEC.md` §7.1 and `openspec/config.yaml` `context:` — the stated
  Phase 1 `oneOf`/`anyOf` limitation no longer holds and must be corrected.
- New test fixture reproducing the real schema's structural patterns without
  reproducing its contents (the repository is public; the schema is internal).
