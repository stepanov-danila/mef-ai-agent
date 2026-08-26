## REMOVED Requirements

### Requirement: oneOf/anyOf validated against the first branch only
**Reason**: Testing against the real MEF config schema showed this rule
produces false-negative rejections, not a simplification. The schema has
15 multi-branch `oneOf`/`anyOf` unions on its most-used fields — including
the required `secrets` field (12 branches keyed by `valueType`) and
`applications` (5 branches keyed by `deployStrategy`) — and restricting
validation to the first branch rejects every config that legitimately
uses any other branch. A minimal, schema-conforming config was rejected
with fabricated errors under this rule.
**Migration**: No caller-visible migration — this was an internal
validation rule, not a public config format change. Configs that were
previously rejected for using a non-first branch now validate correctly
under `Union schemas are validated with standard semantics` (below).

## ADDED Requirements

### Requirement: Union schemas are validated with standard semantics
Where the schema declares a field using `oneOf` or `anyOf`, the system
SHALL validate the field's value using standard JSON Schema semantics
(matching any valid branch), not a restricted subset of branches.

#### Scenario: Value matches a non-first branch
- **WHEN** a field's value satisfies a `oneOf`/`anyOf` branch other than
  the first one, and satisfies the union's matching rule (exactly one
  branch for `oneOf`, at least one for `anyOf`)
- **THEN** the system reports no error for that field

#### Scenario: Value matches no branch
- **WHEN** a field's value satisfies none of a `oneOf`/`anyOf` schema's
  branches
- **THEN** the system reports an error for that field

### Requirement: Errors from a failed union are attributed to the intended variant
When a config fails a `oneOf`/`anyOf` union, the system SHALL report
only the errors of the single branch the config's own values indicate
were intended, rather than every branch's errors concatenated.

#### Scenario: Union has a value-discriminated branch
- **WHEN** a config fails a union where one property's value (e.g. a
  single-value `enum`) identifies which branch was intended, and the
  config's value for that property identifies one branch
- **THEN** the system reports only that branch's validation errors, and
  does not report the other branches' errors or a generic
  "did not match any branch" error

#### Scenario: Union has no clear discriminator
- **WHEN** a config fails a union where no single property value
  identifies the intended branch
- **THEN** the system reports the errors of whichever branch the config
  comes closest to satisfying (fewest violations), rather than every
  branch's errors concatenated

### Requirement: A schema with non-standard keywords still compiles
The system SHALL successfully compile and use a schema that contains
keywords or constructs the validator does not specifically recognize,
rather than failing to start validating at all.

#### Scenario: Schema node uses an unrecognized keyword
- **WHEN** the loaded schema contains a node with a keyword the
  validator has no specific handling for
- **THEN** the system still compiles the schema and validates configs
  against it, treating the unrecognized keyword as a no-op rather than
  raising a compilation error
