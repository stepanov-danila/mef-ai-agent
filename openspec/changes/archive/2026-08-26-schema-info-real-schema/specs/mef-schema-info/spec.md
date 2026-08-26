## MODIFIED Requirements

### Requirement: Field metadata lookup by path
Given a JSON Pointer (RFC 6901) identifying a field within the MEF
config, the system SHALL return that field's type, whether it is
required by its parent object, its description when the schema declares
one, and whatever format constraints (e.g. `pattern`, `enum`, `minimum`,
`maximum`) the schema declares for it.

#### Scenario: Existing top-level field
- **WHEN** metadata is requested for a JSON Pointer identifying a field
  at the top level of the schema (e.g. `/modelName`)
- **THEN** the system returns that field's type, required status, and
  declared format constraints

#### Scenario: Existing nested field
- **WHEN** metadata is requested for a JSON Pointer identifying a field
  nested under an object in the schema (e.g. `/runtime/kind`)
- **THEN** the system returns that nested field's type, required status
  (relative to its own parent object), and declared format constraints

#### Scenario: Field with no format constraints
- **WHEN** metadata is requested for a field the schema declares only a
  type for, with no pattern, enum, or range constraints
- **THEN** the system returns that field's type and required status, with
  an empty set of format constraints

#### Scenario: Field inside an array
- **WHEN** metadata is requested for a JSON Pointer that includes a
  numeric segment addressing an array field's element schema (e.g.
  `/applications/0/name`)
- **THEN** the system resolves the numeric segment against the array's
  `items` schema and returns that field's metadata

#### Scenario: Field matched by a pattern property
- **WHEN** metadata is requested for a JSON Pointer segment that does not
  match a literal property name but does match one of the parent's
  `patternProperties` regular expressions
- **THEN** the system returns the metadata declared for that pattern

### Requirement: Listing all top-level fields
When a JSON Pointer is given, the system SHALL return metadata for every
field declared directly under the node it identifies. When no pointer is
given, the system SHALL return metadata for every field declared at the
top level of the schema.

#### Scenario: No field path given
- **WHEN** a field listing is requested with no pointer
- **THEN** the system returns a list covering every top-level field in
  the schema, each with its type, required status, and format
  constraints

#### Scenario: Pointer identifies an object node
- **WHEN** a field listing is requested with a pointer identifying an
  object field nested in the schema (e.g. the element schema of an
  array)
- **THEN** the system returns a list covering every field declared
  directly under that node

## ADDED Requirements

### Requirement: Array fields expose their item constraints
For a field whose schema type is an array, the system SHALL include the
constraints declared on the array's item schema (e.g. an `enum` of
allowed scalar values) alongside the array's own constraints (e.g.
`minItems`).

#### Scenario: Array of enum-constrained scalars
- **WHEN** metadata is requested for an array field whose items are
  constrained to a fixed set of values via `enum`
- **THEN** the system returns that array's own constraints together with
  the item schema's `enum` values

### Requirement: Union fields expose every variant
For a field declared using `oneOf` or `anyOf`, the system SHALL report
every branch as a distinct variant, rather than only the first.

#### Scenario: Field is a discriminated union
- **WHEN** metadata is requested for a field whose schema is a `oneOf` or
  `anyOf` where each branch is identified by a distinct value of one
  property (e.g. an `enum` of length one)
- **THEN** the system returns every branch as a variant, each naming its
  discriminating property and value and its own required fields

#### Scenario: Descending through a union field
- **WHEN** metadata is requested for a field nested inside a union field
  (e.g. a property common to every branch)
- **THEN** the system resolves that field's metadata by combining its
  declaration across every branch, rather than only the first
