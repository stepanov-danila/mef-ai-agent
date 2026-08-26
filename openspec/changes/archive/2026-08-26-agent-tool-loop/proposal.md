## Why

`validate-mef-config`, `mef-schema-info`, and `mef-config-template` exist
as plain functions, and `agent-tool-api` exposes them over HTTP for a
human or script to call directly — but nothing yet lets an LLM decide
*which* of them to call and *when*, which is the whole premise of the
"agentic approach" principle in `docs/PROJECT_SPEC.md` §9 and the point
of having three separate tools instead of one do-everything endpoint. The
GigaChat integration itself (`docs/PROJECT_SPEC.md` §5.1) needs corporate
mTLS credentials this environment doesn't have, so it can't be wired yet
— but the tool-execution loop around whichever LLM eventually gets
plugged in doesn't depend on GigaChat specifically, and can be built and
tested now against a provider abstraction.

## What Changes

- Add an LLM-provider-agnostic tool-execution loop: given a conversation
  and a system prompt, it calls a pluggable `LLMProvider`, and for every
  tool call the provider's response requests, executes the matching
  registered tool and feeds the result back to the provider — repeating
  until the provider returns a final answer with no further tool calls,
  or a maximum number of iterations is reached.
- Wrap `validate-mef-config`, `mef-schema-info`, and
  `mef-config-template` as three callable agent tools, each with a
  name, natural-language description, and a JSON Schema for its
  arguments — the same descriptive metadata an LLM function-calling API
  needs to decide when and how to call each one.
- A tool that throws or whose arguments don't match its schema produces
  an error result fed back to the LLM as that tool call's outcome (so the
  LLM can retry or explain the failure), rather than aborting the whole
  loop.
- Add a scripted `LLMProvider` test double — a provider that returns a
  pre-programmed sequence of responses — for exercising the loop's
  control flow (multi-round tool calls, error recovery, the iteration
  cap) without a real LLM. This is a test tool, not a stand-in chat
  experience.

Out of scope: an actual `LLMProvider` implementation talking to GigaChat
or any other LLM API (needs credentials this change doesn't have); the
`POST /chat` HTTP endpoint, session/conversation persistence, and the
system prompt's exact wording (`docs/PROJECT_SPEC.md` §4.4/§5.5 —
depends on this loop existing first, tracked as separate follow-up work);
masking secret values in tool arguments/results before they'd reach a
real LLM (`docs/PROJECT_SPEC.md` §5.4 — relevant once a real provider
and real user-supplied configs are in the loop, not to the mechanical
orchestration or the test double this change adds).

## Capabilities

### New Capabilities
- `agent-tool-loop`: an LLM-provider-agnostic loop that lets an LLM
  invoke `validate-mef-config`, `mef-schema-info`, and
  `mef-config-template` as named, schema-described tools across
  multiple rounds until it produces a final answer.

### Modified Capabilities
- (none)

## Impact

- New backend module under `backend/src/agent/`, wrapping the existing
  `validateConfig`, `getFieldInfo`/`listFields`, and
  `generateConfigTemplate` functions — no changes to those functions or
  to the `agent-tool-api` HTTP routes.
- No new external dependency — the `LLMProvider` interface and the
  scripted test double are both plain TypeScript, no LLM SDK.
- No existing capability's requirements change.
