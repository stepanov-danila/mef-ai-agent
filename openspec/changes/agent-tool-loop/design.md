## Context

Three capabilities already exist as plain async functions taking
`config.mefSchemaPath` as their first argument: `validateConfig`
(`validation/validateConfig.ts`), `getFieldInfo`/`listFields`
(`schema-info/getSchemaInfo.ts`), and `generateConfigTemplate`
(`config-template/generateConfigTemplate.ts`). `agent-tool-api` already
wraps each in a thin HTTP route for direct callers. This change adds the
piece those two didn't: something that lets an LLM pick which of the
three to call, with what arguments, possibly across several rounds,
without a human or script driving that choice. No GigaChat (or any
other) LLM client exists yet in this codebase — this change only
introduces the *shape* it will plug into.

## Goals / Non-Goals

**Goals:**
- An `LLMProvider` interface narrow enough that a real GigaChat client
  (or any other function-calling-capable LLM API) can implement it later
  without changing the loop.
- Tool wrappers thin enough that the loop, not the wrapper, owns retry/
  error-feedback behavior — a wrapper's job is argument validation +
  delegating to the existing function, nothing more.
- A scripted provider test double that lets the loop's control flow
  (multi-round calls, error recovery, the iteration cap) be tested
  without any LLM, real or otherwise.

**Non-Goals:**
- Any real `LLMProvider` implementation (GigaChat or otherwise) — no
  credentials available yet, tracked as separate follow-up work per
  proposal.md.
- The `POST /chat` endpoint, conversation persistence/sessions, or the
  production system prompt's wording — all depend on this loop existing
  first; this change delivers the loop as a callable function, not a
  route.
- Secret-masking in tool arguments/results — relevant once a real
  provider and real configs flow through the loop; the test double never
  sees real secrets.
- Streaming responses — the three wrapped tools are already fast,
  synchronous-shaped operations (schema tree walks); nothing here forces
  a streaming provider contract now.

## Decisions

- **Placement**: `backend/src/agent/`, alongside `schema/`, `schema-info/`,
  `validation/`, `config-template/`, and `routes/` under `backend/src/`.
  Files: `types.ts` (the `LLMProvider`/`ChatMessage`/`ToolCall`/
  `AgentTool` interfaces), `tools.ts` (the three tool wrappers + the
  catalog), `runAgentTurn.ts` (the loop), `ScriptedProvider.ts` (the test
  double).

- **`LLMProvider` shape**: `complete(messages: ChatMessage[], tools:
  ToolDefinition[]): Promise<LLMResponse>` where `LLMResponse` is `{
  content: string | null; toolCalls: ToolCall[] }`. This mirrors the
  request/response shape common to OpenAI-style and GigaChat-style
  function-calling APIs (a list of messages in, one assistant turn with
  optional tool calls out) closely enough that a real implementation is
  a network-call translation layer, not a redesign.

- **`AgentTool` shape**: `{ definition: ToolDefinition; execute(args:
  unknown): Promise<unknown> }` where `ToolDefinition` is `{ name:
  string; description: string; parameters: JSONSchemaObject }`. Each of
  the three tools' `execute` validates `args` against a small
  hand-written shape check (not full JSON Schema validation — the
  argument shapes are simple enough: an optional string, an unknown
  object, an optional record — that pulling in a schema validator for
  this alone isn't warranted) before delegating to the wrapped function,
  throwing a descriptive error the loop turns into a tool-error result.

- **Tool catalog and argument shapes**:
  - `validate_mef_config({ config: unknown })` → `validateConfig(schemaPath, config)`,
    returns `{ errors }`.
  - `get_schema_info({ pointer?: string })` → both
    `getFieldInfo(schemaPath, pointer)` (when `pointer` given) and
    `listFields(schemaPath, pointer)` are called, returning `{ field?,
    fields }`. Combining both in one tool (rather than mirroring
    `agent-tool-api`'s two-route split) is a deliberate difference for
    this layer: an HTTP caller picks the right endpoint for the question
    it already knows it's asking, but an LLM benefits from getting both
    "what does this field need" and "what's nested under it" in one
    round trip, since it often doesn't know in advance which framing its
    next question will need — and the extra query costs nothing beyond
    an in-memory tree walk.
  - `generate_config_template({ overrides?: Record<string, unknown> })` →
    `generateConfigTemplate(schemaPath, overrides)`, returns the
    generated config.

- **Loop shape**: `runAgentTurn(messages: ChatMessage[], options: {
  systemPrompt: string; tools: AgentTool[]; provider: LLMProvider;
  maxIterations?: number }): Promise<ChatMessage[]>`. Prepends a system
  message, calls `provider.complete` with the running message list and
  the tools' `ToolDefinition`s, and on a response with `toolCalls`:
  appends the assistant's tool-call message, executes each call (via the
  matching `AgentTool` looked up by name — an unrecognized tool name is
  itself a tool-error result, same path as a throwing tool), appends one
  tool-result message per call, and calls `provider.complete` again.
  Stops and returns the full message list either when a response has no
  `toolCalls`, or `maxIterations` (default 5) rounds have run.

- **Scripted test double**: `ScriptedProvider` takes an array of
  `LLMResponse`s at construction and returns them in order on successive
  `complete` calls, throwing if `complete` is called more times than
  there are scripted responses (surfaces a test's wrong iteration-count
  assumption immediately rather than returning `undefined`). It ignores
  its `messages`/`tools` arguments — assertions about what the loop sent
  the provider belong in a spy/mock at the call site, not in the double
  itself.

## Risks / Trade-offs

- [`get_schema_info` always calls both `getFieldInfo` and `listFields`,
  doing work the LLM may not need (e.g. it only wanted the field's own
  metadata)] → Accepted: both are in-memory schema-tree walks against an
  already-cached schema, not I/O; the saved round trip (and the tokens
  a second LLM call would cost) outweighs the wasted CPU of an unused
  `fields` array.
- [The `LLMProvider` interface is designed against no real
  implementation yet, so it may need to change once GigaChat's actual
  request/response shape is known] → Accepted, flagged explicitly as a
  non-goal; the interface is deliberately narrow (one method) to keep
  that future change small.
- [A tool-error result's message is whatever the wrapped function's
  thrown error says, which wasn't written with an LLM audience in mind]
  → Low risk for now: all three wrapped functions already produce
  descriptive, specific error messages (this is exactly the class of
  message the existing HTTP routes already surface to callers); revisit
  if a real provider's behavior shows it needs different phrasing.

## Migration Plan

Greenfield addition — no existing behavior changes. New module only.
