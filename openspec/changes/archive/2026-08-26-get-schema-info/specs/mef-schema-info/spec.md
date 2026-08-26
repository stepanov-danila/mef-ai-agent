## Purpose

Lets a caller look up what the MEF JSON Schema declares for a given
config field — its type, whether it's required, and its format
constraints — or list every top-level field at once, without reading the
raw schema directly.

## ADDED Requirements

### Requirement: Field metadata lookup by path
Given a field path within the MEF config, the system SHALL return that
field's type, whether it is required by its parent object, and whatever
format constraints (e.g. `pattern`, `enum`, `minimum`, `maximum`) the
schema declares for it.

#### Scenario: Existing top-level field
- **WHEN** metadata is requested for a field path that exists at the top
  level of the schema (e.g. `modelName`)
- **THEN** the system returns that field's type, required status, and
  declared format constraints

#### Scenario: Existing nested field
- **WHEN** metadata is requested for a dotted field path that exists
  under a nested object in the schema (e.g. `runtime.kind`)
- **THEN** the system returns that nested field's type, required status
  (relative to its own parent object), and declared format constraints

#### Scenario: Field with no format constraints
- **WHEN** metadata is requested for a field the schema declares only a
  type for, with no pattern, enum, or range constraints
- **THEN** the system returns that field's type and required status, with
  an empty set of format constraints

### Requirement: Unknown field path is reported distinctly
The system SHALL report a field path that does not exist anywhere in the
schema as "not found", distinct from a field that exists but has no
format constraints.

#### Scenario: Field path not present in the schema
- **WHEN** metadata is requested for a field path that does not
  correspond to any field defined in the schema
- **THEN** the system reports that the field was not found, rather than
  returning empty or default metadata for it

### Requirement: Listing all top-level fields
When no field path is given, the system SHALL return metadata for every
field declared at the top level of the schema.

#### Scenario: No field path given
- **WHEN** metadata is requested with no specific field path
- **THEN** the system returns a list covering every top-level field in
  the schema, each with its type, required status, and format
  constraints
