# Temporary Access Policies

Access policies grant users permission to applications with optional expiration.

## Policy Fields

- `permission`: read, write, or admin (ordered hierarchy)
- `grantedAt`: When access was granted
- `expiresAt`: Optional expiration for temporary access

## Permission Hierarchy

`admin` >= `write` >= `read`. A user with `write` can perform `read` actions but not `admin` actions.

## Expired Policies

Expired policies are treated as no access. The `check_permission` tool returns `allowed: false` with reason "Access policy expired".
