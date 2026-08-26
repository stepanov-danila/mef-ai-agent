# mef-config-validation Specification

## Purpose
Checks a MEF config against the cached MEF JSON Schema and reports exactly
which fields are wrong and why, so a config's problems surface immediately
instead of only after a deploy pipeline run.

## Requirements

### Requirement: Valid config produces no errors
The system SHALL report zero errors for a config that satisfies every
constraint in the MEF JSON Schema.

#### Scenario: Fully conforming config
- **WHEN** a config is validated that satisfies every schema constraint
  (required fields present, correct types, patterns, and enums)
- **THEN** the system reports an empty list of errors

### Requirement: Invalid config produces field-level error details
The system SHALL report each schema violation as a separate error that
identifies the violating field's path within the config and the reason
the value is invalid.

#### Scenario: Missing required field
- **WHEN** a config omits a field the schema marks as required
- **THEN** the system reports an error identifying that field's path and
  stating that it is required

#### Scenario: Wrong type or pattern
- **WHEN** a config field's value does not match the type, pattern, or
  enum the schema declares for it
- **THEN** the system reports an error identifying that field's path and
  the constraint the value violates

#### Scenario: Multiple violations in one config
- **WHEN** a config violates more than one schema constraint at once
- **THEN** the system reports one error per violation, each naming its
  own field path, rather than stopping at the first violation found

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
