# agent-tool-api Specification

## Purpose

Exposes the `validate-mef-config`, `mef-schema-info`, and
`mef-config-template` capabilities as HTTP endpoints on the backend
service, so a caller outside the process (eventually the agent
tool-execution loop) can invoke them without a direct code dependency.

## Requirements

### Requirement: Validate a MEF config over HTTP
The system SHALL accept a MEF config document as the JSON body of a
`POST /tools/validate-mef-config` request and respond with that config's
validation errors against the backend's configured MEF schema.

#### Scenario: Valid config
- **WHEN** `POST /tools/validate-mef-config` is called with a config that
  satisfies every schema constraint
- **THEN** the response has status `200` and an empty errors list

#### Scenario: Invalid config
- **WHEN** `POST /tools/validate-mef-config` is called with a config
  violating one or more schema constraints
- **THEN** the response has status `200` and lists each violation's field
  path and message

#### Scenario: Malformed request body
- **WHEN** `POST /tools/validate-mef-config` is called with a body that
  is not valid JSON
- **THEN** the response has status `400` with a descriptive error,
  rather than being validated as a config

### Requirement: Look up one field's metadata over HTTP
The system SHALL accept a JSON Pointer as the `pointer` query parameter
of a `GET /tools/get-schema-info/field` request and respond with that
field's metadata from the backend's configured MEF schema.

#### Scenario: Field exists
- **WHEN** `GET /tools/get-schema-info/field` is called with a `pointer`
  that resolves to a field in the schema
- **THEN** the response has status `200` and includes that field's type,
  required status, and constraints

#### Scenario: Field does not exist
- **WHEN** `GET /tools/get-schema-info/field` is called with a `pointer`
  that does not resolve to any field in the schema
- **THEN** the response has status `404` with a descriptive error

#### Scenario: Missing or malformed pointer
- **WHEN** `GET /tools/get-schema-info/field` is called with no `pointer`
  query parameter, or one that is not a valid JSON Pointer
- **THEN** the response has status `400` with a descriptive error

### Requirement: List fields under a node over HTTP
The system SHALL accept an optional JSON Pointer as the `pointer` query
parameter of a `GET /tools/get-schema-info/list` request and respond with
the metadata of every field declared directly under the node it
identifies, or under the schema root when the parameter is omitted.

#### Scenario: No pointer given
- **WHEN** `GET /tools/get-schema-info/list` is called with no `pointer`
  query parameter
- **THEN** the response has status `200` and lists every top-level field
  in the schema

#### Scenario: Pointer identifies an object node
- **WHEN** `GET /tools/get-schema-info/list` is called with a `pointer`
  identifying an object field in the schema
- **THEN** the response has status `200` and lists every field declared
  directly under that node

#### Scenario: Malformed pointer
- **WHEN** `GET /tools/get-schema-info/list` is called with a `pointer`
  that is not a valid JSON Pointer
- **THEN** the response has status `400` with a descriptive error

### Requirement: Generate a config template over HTTP
The system SHALL generate a minimal, schema-valid MEF config in response
to a `POST /tools/generate-config-template` request, optionally applying
field-value overrides supplied as a JSON object under `overrides` in the
request body.

#### Scenario: No request body
- **WHEN** `POST /tools/generate-config-template` is called with an empty
  body
- **THEN** the response has status `200` and contains a minimal
  schema-valid config with no overrides applied

#### Scenario: Overrides supplied
- **WHEN** `POST /tools/generate-config-template` is called with a body
  containing an `overrides` object mapping JSON Pointers to values
- **THEN** the response has status `200` and reflects those overrides in
  the generated config, per `mef-config-template`'s override rules

#### Scenario: Malformed overrides
- **WHEN** `POST /tools/generate-config-template` is called with a body
  whose `overrides` field is present but is not a JSON object
- **THEN** the response has status `400` with a descriptive error
