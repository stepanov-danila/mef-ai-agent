# schema-loading Specification

## Purpose
Loads the MEF config JSON Schema (Draft-04) once at startup, resolves its
internal `$ref` references, and keeps the resolved schema cached in memory
so downstream capabilities (validation, field lookup, template
generation) always work against a single, fully-resolved schema without
re-reading or re-resolving it on every request.

## Requirements

### Requirement: Schema is loaded from disk at startup
The system SHALL load the MEF config JSON Schema (Draft-04) from a
configured file path when the backend service starts.

#### Scenario: Valid schema file present
- **WHEN** the backend starts and the configured schema file exists and
  is valid JSON Schema (Draft-04)
- **THEN** the system loads it into memory and becomes ready to serve
  schema-dependent requests

#### Scenario: Schema file missing or invalid
- **WHEN** the backend starts and the configured schema file is missing,
  is not valid JSON, or is not a valid Draft-04 schema
- **THEN** the system fails to start and reports a descriptive error
  identifying the schema file and the problem

### Requirement: Internal $ref references are resolved
The system SHALL resolve internal `$ref` references within the loaded
schema so that consumers receive a fully-resolved schema without needing
to resolve references themselves.

#### Scenario: Schema contains internal $ref references
- **WHEN** the loaded schema contains `$ref` entries pointing to other
  definitions within the same schema document
- **THEN** the system resolves them into a single fully-dereferenced
  schema structure held in memory

#### Scenario: Schema contains an unresolvable $ref
- **WHEN** the loaded schema contains a `$ref` that cannot be resolved
  (e.g., points to a missing definition)
- **THEN** the system fails to start and reports a descriptive error
  identifying the unresolvable reference

### Requirement: Resolved schema is cached in memory
The system SHALL cache the resolved schema in memory after the first
load and reuse the cached copy for subsequent access instead of re-reading
or re-resolving the schema file from disk.

#### Scenario: Multiple consumers access the schema
- **WHEN** the resolved schema is requested multiple times after startup
- **THEN** the system serves the cached in-memory copy without re-reading
  the schema file from disk
