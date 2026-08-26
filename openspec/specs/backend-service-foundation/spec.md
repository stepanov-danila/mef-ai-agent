# backend-service-foundation Specification

## Purpose
Provides the running backend HTTP service that every other MEF AI Copilot
capability (chat, validation, schema info) is built on top of, and a way
for operators to confirm the service is up.

## Requirements

### Requirement: Backend service starts and listens for HTTP requests
The system SHALL run as an HTTP server that starts on a configurable port
and accepts REST requests.

#### Scenario: Service starts successfully
- **WHEN** the backend process is started with a valid configuration
- **THEN** it listens for HTTP requests on the configured port

#### Scenario: Port already in use
- **WHEN** the backend process is started but the configured port is
  already bound by another process
- **THEN** the process fails to start and exits with a non-zero status
  and a descriptive error, rather than silently binding elsewhere

### Requirement: Health-check endpoint
The system SHALL expose a `GET /health` endpoint that reports whether the
service is running and ready to serve requests.

#### Scenario: Service is healthy
- **WHEN** a client sends `GET /health` while the service is running
  normally
- **THEN** the system responds with HTTP 200 and a JSON body indicating
  status `ok`

### Requirement: Unhandled errors do not crash the service
The system SHALL respond to a request that raises an unexpected error
with an HTTP 5xx response instead of terminating the process.

#### Scenario: Request handler throws an unexpected error
- **WHEN** a request causes an unhandled error in a route handler
- **THEN** the system responds with an HTTP 5xx status and continues
  serving subsequent requests
