# MCP Tools vs Resources vs Prompts

Understanding MCP primitives helps design secure, composable AI integrations.

## Tools

Executable actions with side effects. Examples: `create_access_request`, `check_permission`. Require scope validation per tool.

## Resources

Read-only context attached to the model context. URI-addressable (`app://{id}/metadata`). No side effects; filtered by caller scopes.

## Prompts

Reusable workflow templates. Example: `access_review` guides the model through a multi-step permission review.

## REST Endpoints

General HTTP APIs (`/health`, `/oauth/token`) serve infrastructure and auth — not exposed as MCP primitives. MCP wraps capabilities for AI client discovery and invocation.
