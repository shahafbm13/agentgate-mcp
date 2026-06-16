# Access Request Workflow

Temporary access requests follow an approval workflow designed for AI-assisted self-service.

## Flow

1. Developer identifies need via AI agent (`check_permission` returns denied).
2. Agent calls `create_access_request` with application ID, permission level, and business justification.
3. System writes audit event and notifies approvers via notification webhook.
4. Approver reviews in admin console (out of scope for MCP demo).
5. On approval, access policy is created with expiration.

## Required Fields

- `applicationId`: Target application UUID
- `reason`: Minimum 10 characters explaining business need
- `requestedPermission`: read, write, or admin
- `durationHours`: 1–168 hours (default 24)
