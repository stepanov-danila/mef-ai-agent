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

### Requirement: oneOf/anyOf validated against the first branch only
Where the schema declares a field using `oneOf` or `anyOf`, the system
SHALL validate the field's value against the first listed branch only,
per the project's documented Phase 1 limitation.

#### Scenario: Value matches the first branch
- **WHEN** a field's value satisfies the first branch of its `oneOf` or
  `anyOf` schema
- **THEN** the system reports no error for that field, regardless of
  whether the value would also match a later branch

#### Scenario: Value only matches a later branch
- **WHEN** a field's value satisfies a `oneOf`/`anyOf` branch other than
  the first one, but not the first branch itself
- **THEN** the system reports an error for that field describing why it
  fails the first branch, even though the value would be valid under a
  later branch
