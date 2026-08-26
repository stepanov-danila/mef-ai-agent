# mef-config-template Specification

## Purpose

Lets a caller obtain a minimal, schema-valid starting point for a MEF
config — every required field present and placeholder-filled — instead of
assembling one by hand from the raw JSON Schema.

## Requirements

### Requirement: Minimal valid template generation
Given the cached MEF JSON Schema, the system SHALL generate a config
object containing every field required at the schema's root, and every
field required within a required object or array-item field, recursively,
with no optional field included.

#### Scenario: Required scalar fields
- **WHEN** a template is generated from a schema whose root requires a
  string and an integer field
- **THEN** the generated config contains both fields with placeholder
  values, and no other root-level field

#### Scenario: Nested required object
- **WHEN** a required field's schema is itself an object with its own
  required sub-fields
- **THEN** the generated config includes that nested object with each of
  its required sub-fields filled

#### Scenario: Optional field is omitted
- **WHEN** a field is declared in the schema but not listed as required by
  its parent
- **THEN** the generated config does not include that field

### Requirement: Placeholder values satisfy declared constraints
For each generated field, the system SHALL produce a placeholder value
that satisfies that field's declared type and, where feasible, its
`enum`, `pattern`/`format`, `minimum`/`maximum`, and `minItems`
constraints.

#### Scenario: Enum-constrained field
- **WHEN** a generated field's schema declares an `enum`
- **THEN** the placeholder value is one of the declared enum values

#### Scenario: Numeric range constraint
- **WHEN** a generated field's schema declares a `minimum` (or
  `exclusiveMinimum`) and/or `maximum`
- **THEN** the placeholder value falls within the declared range

#### Scenario: Required array field
- **WHEN** a generated field's schema is an array with a declared
  `minItems`
- **THEN** the generated array contains at least that many elements, each
  satisfying the array's item schema

### Requirement: Union fields commit to one branch
For a field declared using `oneOf`/`anyOf`, the system SHALL generate a
value matching exactly one branch, rather than a value combining fields
from more than one branch.

#### Scenario: Default branch selection
- **WHEN** a generated field is a `oneOf`/`anyOf` with no override
  selecting a different branch
- **THEN** the generated value matches the union's first branch

#### Scenario: Override selects a non-default branch
- **WHEN** an override targets a union branch's discriminating field (a
  branch property identified by a single-value `enum`) with a value
  matching a branch other than the first
- **THEN** the generated value matches that branch instead of the first

### Requirement: Field-value overrides
The system SHALL accept a set of field-value overrides, each identifying
a field by JSON Pointer, and SHALL apply an override's value at that
pointer when the pointer resolves to a field already present in the
generated template.

#### Scenario: Override on a generated required field
- **WHEN** an override targets a JSON Pointer that resolves to a required
  field the template already generated (e.g. a model-name field)
- **THEN** the generated config carries the override's value at that field
  instead of the default placeholder

#### Scenario: Override with no corresponding generated field
- **WHEN** an override targets a JSON Pointer that does not resolve to any
  field present in the generated template (e.g. it names an optional
  field the minimal template omitted)
- **THEN** the system leaves the generated template unaffected by that
  override
