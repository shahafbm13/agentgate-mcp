# Role-Based Access Control (RBAC)

AgentGate maps platform roles to OAuth scopes and row-level rules.

## Roles

| Role | Description |
|------|-------------|
| admin | Full access to users, apps, audit, access requests, docs |
| developer | Read users/apps, create access requests, check permissions |
| auditor | Read users, apps, audit logs, docs — no write access |
| readonly | Read apps and documentation only |

## Row-Level Rules

- Users can read their own profile; admin/auditor can read any profile.
- Audit events are restricted to admin and auditor roles even with valid scopes.
- Access requests cannot be created if the user already has sufficient active policy.
