# Audit Logging Standards

All mutating MCP tool calls generate audit events for compliance and forensics.

## Event Schema

Each audit event captures:
- `actorUserId` and `actorEmail` from the JWT
- `action` (e.g., `access_request.created`)
- `resourceType` and `resourceId`
- `metadata` JSON with request-specific details
- `createdAt` timestamp

## Retention

Portfolio demo retains events indefinitely. Production systems should define retention policies and immutable storage.

## AI Agent Considerations

Log both the human user (`sub`) and the MCP client identity when available to support agentic identity auditing.
