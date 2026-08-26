# agent-tool-loop Specification

## Purpose

Lets an LLM decide which of `validate-mef-config`, `mef-schema-info`, and
`mef-config-template` to invoke and when, across as many rounds as it
needs, instead of the caller having to pick the right tool and call
sequence itself.

## Requirements

### Requirement: Tools are described for LLM function-calling
The system SHALL expose `validate-mef-config`, `mef-schema-info`, and
`mef-config-template` as named tools, each with a natural-language
description and a JSON Schema describing its arguments, suitable for an
LLM function-calling API.

#### Scenario: Tool catalog is available
- **WHEN** the tool catalog is requested
- **THEN** the system returns one entry per capability, each with a name,
  description, and argument schema

### Requirement: The loop executes LLM-requested tool calls
Given a conversation and a system prompt, the system SHALL call the
configured LLM provider, and for every tool call in its response, execute
the matching tool and feed the result back to the provider as part of the
conversation, repeating until the provider responds with no further tool
calls.

#### Scenario: Single tool call then final answer
- **WHEN** the provider's first response requests one tool call, and its
  second response (given that tool's result) contains no further tool
  calls
- **THEN** the system executes that one tool call, sends its result back
  to the provider, and returns the provider's final answer

#### Scenario: Multiple rounds of tool calls
- **WHEN** the provider requests a tool call, is given the result, and
  requests a further tool call before finally answering
- **THEN** the system executes each requested tool call in turn, feeding
  every result back, until the provider's response contains no further
  tool calls

#### Scenario: No tool call needed
- **WHEN** the provider's first response already contains no tool calls
- **THEN** the system returns that response without executing any tool

### Requirement: A failing tool call does not abort the loop
When an executed tool throws, or its arguments don't satisfy that tool's
argument schema, the system SHALL feed an error result for that specific
call back to the provider and continue the loop, rather than raising an
error out of the loop itself.

#### Scenario: Tool call with invalid arguments
- **WHEN** the provider requests a tool call whose arguments don't match
  that tool's argument schema
- **THEN** the system feeds back an error result identifying the problem
  for that tool call, and the provider is called again with it in the
  conversation

#### Scenario: Tool execution throws
- **WHEN** an executed tool's underlying function throws
- **THEN** the system feeds back an error result for that tool call
  rather than propagating the exception out of the loop

### Requirement: Runaway tool-calling is bounded
The system SHALL stop calling the provider after a configured maximum
number of tool-calling rounds, even if the provider keeps requesting
further tool calls.

#### Scenario: Provider requests tool calls indefinitely
- **WHEN** the provider's response requests a further tool call on every
  round, up to and past the configured maximum
- **THEN** the system stops after that maximum and returns without
  calling the provider again
