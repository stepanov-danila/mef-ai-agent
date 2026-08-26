## Context

This is the first code in the repository (see proposal.md - Why). There is
no existing backend layout, build tooling, or dependency set to conform
to, so this design also fixes the conventions that later changes (GigaChat
integration, agent tools, chat endpoint, frontend) will build on.

## Goals / Non-Goals

**Goals:**
- Fix the backend project layout and toolchain once, so later changes add
  files into an established structure instead of re-deciding it.
- Keep the dependency surface minimal — only what `backend-service-foundation`
  and `schema-loading` actually need.

**Non-Goals:**
- Deciding the frontend layout or a monorepo/workspaces strategy for
  `backend/` + `frontend/` together — deferred to the change that adds the
  frontend, once there are two packages to actually coordinate.
- GigaChat integration, the agent tool-execution loop, and the three agent
  tools — explicitly out of scope per proposal.md.

## Decisions

- **Directory**: `backend/` at the repo root, as its own npm package
  (`backend/package.json`), rather than putting source at the repo root.
  Keeps room for `frontend/` to land the same way later without a
  restructure.

- **Runtime/language**: Node.js + TypeScript, `strict: true`. Build with
  `tsc` (`npm run build` → `dist/`), run in dev with `tsx` (fast, no
  separate compile step, no extra config file like `ts-node-dev` needs).

- **HTTP framework**: Express 5. Express 5 forwards rejected promises from
  async route handlers to the error-handling middleware automatically
  (Express 4 requires a wrapper or a dependency like `express-async-errors`
  for this). That directly satisfies the "unhandled errors don't crash the
  service" requirement with no extra dependency or hand-rolled wrapper.

- **Config**: environment variables (`PORT`, `MEF_SCHEMA_PATH`) with
  defaults, read through a single `src/config.ts` module — one place other
  modules import from instead of reading `process.env` directly. `dotenv`
  loads a local `.env` in development; not required in deployed
  environments where env vars are set directly.

- **Schema `$ref` resolution**: `@apidevtools/json-schema-ref-parser`'s
  `dereference()`. It walks and resolves `$ref` purely structurally, so it
  works the same on Draft-04 as on later drafts — it doesn't need to
  understand Draft-04-specific keyword semantics, only `$ref` pointers.
  Chosen over hand-rolling a resolver: correct handling of internal
  pointers and circular refs is easy to get subtly wrong, and this is a
  maintained, widely-used library. External (`$ref` to another file) and
  remote refs are not needed yet — the spec only requires resolving
  references within the same schema document.

- **Schema cache**: a module-level singleton loaded once at startup
  (`src/schema/loadSchema.ts`), not per-request and not a general-purpose
  cache abstraction. There is exactly one schema and it does not change
  without a restart (see docs/PROJECT_SPEC.md - Допущения: schema stays
  Draft-04); a full caching layer would be solving a problem this project
  doesn't have yet.

- **Startup failure handling**: schema load happens synchronously during
  startup, before the HTTP server begins listening. A missing file,
  invalid JSON, or unresolvable `$ref` logs a descriptive error and calls
  `process.exit(1)` — matching the spec's "fails to start" scenarios and
  avoiding a server that's technically listening but can't serve anything
  useful.

- **Folder layout**:
  ```
  backend/
    src/
      index.ts        # entrypoint: load schema, start server
      app.ts           # Express app + routes wiring
      config.ts        # env var reads with defaults
      routes/
        health.ts       # GET /health
      schema/
        loadSchema.ts   # load + dereference + cache
      types/
      agent-tools/      # empty, placeholder for follow-up changes
    package.json
    tsconfig.json
  ```

## Risks / Trade-offs

- [Express 5 is a newer major version; some third-party middleware may
  still assume Express 4] → Only built-in Express features are used in
  this change (JSON body parsing, routing, error middleware); no
  third-party Express middleware is added yet, so this risk doesn't bite
  until a later change needs one — evaluate compatibility then.
- [Module-level singleton schema cache has no invalidation/hot-reload] →
  Acceptable for Phase 1 per the documented assumption that the schema
  doesn't change without a restart; revisit if/when Phase 2 needs live
  schema updates.
- [`@apidevtools/json-schema-ref-parser` is an added runtime dependency] →
  Small, focused, widely used; avoids a hand-rolled resolver that would
  need its own correctness testing for circular/nested refs.

## Migration Plan

Greenfield — no existing deployment to migrate. First run:
`cd backend && npm install && npm run dev`, with `MEF_SCHEMA_PATH`
pointing at a Draft-04 MEF config schema file.
