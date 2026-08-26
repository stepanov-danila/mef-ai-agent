## Why

MEF AI Copilot has no backend yet. Every later capability — the agent
tools, the GigaChat-powered chat loop, and the frontend — needs a running
Express/TypeScript service and a way to load and cache the MEF JSON Schema
before any of that can be built. This change lays that foundation so
follow-up changes can add real functionality on top of it instead of
re-solving project setup each time.

## What Changes

- Add a Node.js + TypeScript project scaffold (package.json, tsconfig,
  lint/build scripts) for the backend service.
- Add an Express REST API app with a `GET /health` endpoint reporting
  service status.
- Add a schema-loading service that reads the MEF config JSON Schema
  (Draft-04) from disk, resolves internal `$ref` references, and caches
  the resolved schema in memory for reuse by later requests.
- Establish the base backend layout (folders for routes, services, agent
  tools, config) that later changes (GigaChat integration, agent tools,
  chat endpoint) will build into.

Out of scope for this change: GigaChat/LLM integration, the agentic
tool-execution loop, and the actual agent tools (`validate_mef_config`,
`get_schema_info`, `generate_config_template`). Those are follow-up
changes built on this foundation.

## Capabilities

### New Capabilities
- `backend-service-foundation`: the Express/TypeScript service itself —
  it starts, serves a health-check endpoint, and reports its status.
- `schema-loading`: loading the MEF JSON Schema (Draft-04) from disk,
  resolving `$ref`, and caching the resolved schema in memory.

### Modified Capabilities
- (none — this is the first change in the project)

## Impact

- New backend project under a `backend/` directory (or repo root, per
  design.md): `package.json`, `tsconfig.json`, `src/` layout.
- New dependencies: Express, TypeScript, a JSON Schema Draft-04 `$ref`
  resolver, and their type packages.
- No existing code is modified (greenfield project).
