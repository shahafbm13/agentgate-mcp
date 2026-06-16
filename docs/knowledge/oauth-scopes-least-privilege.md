# OAuth Scopes and Least Privilege

AgentGate uses OAuth-style scopes to enforce least privilege for MCP tool access.

## Scope Design Principles

- Assign one scope per tool or tool group (e.g., `audit:read`, `access:write`).
- Never grant write scopes when read-only access suffices.
- Scope tokens at request time; avoid long-lived broad tokens for AI agents.

## MCP Resource Server Pattern

The MCP server acts as an OAuth 2.0 Resource Server. It validates Bearer tokens on every request and checks that token scopes match the requested tool or resource.

## Insufficient Scope Errors

When a token lacks required scopes, the server returns an MCP-spec-compliant error with `error: insufficient_scope` and a `scope` field listing required scopes per RFC 6750.
