# AgentGate MCP

A portfolio MCP server for identity-aware internal access management — check permissions, request temporary access, read audit logs, and search security runbooks from an AI client.

Built with TypeScript while exploring the [Model Context Protocol](https://modelcontextprotocol.io) and OAuth resource-server patterns (JWT validation, tool-level scopes, RBAC). Not production software; auth is a mock issuer for local demos.

## What it does

Engineering teams often need to answer: *can this person access this app?* *who approved it?* *what does our runbook say?*

AgentGate exposes that through MCP:

- **Tools** — `check_permission`, `create_access_request`, `get_audit_events`, etc.
- **Resources** — read-only URIs like `policy://{appId}` and `audit://recent`
- **Prompts** — `access_review` workflow template for agents

Each tool requires OAuth-style scopes; sensitive operations (audit logs) also check role.

## Architecture

```
AI client  →  MCP server (HTTP or stdio)  →  services  →  PostgreSQL
                    ↑
              mock auth (JWT) + notification webhook
```

See [docs/knowledge/](docs/knowledge/) for the internal runbooks the search tool indexes.

## Tools & scopes

| Tool | Scope |
|------|-------|
| `get_user` | `users:read` |
| `list_applications` | `apps:read` |
| `get_audit_events` | `audit:read` (+ admin/auditor role) |
| `create_access_request` | `access:write` |
| `check_permission` | `access:read` |
| `search_identity_documentation` | `docs:read` |

Resources mirror similar scope rules (`app://`, `user://`, `policy://`, `audit://`, `docs://`).

## Quick start

**Requirements:** Node 18+, npm

```powershell
git clone https://github.com/shahafbm13/agentgate-mcp.git
cd agentgate-mcp
npm install
cp .env.example .env
npm run local
```

`npm run local` starts embedded Postgres (if nothing is listening on 5432), runs migrations + seed, then mock auth, notification API, and the MCP server.

Verify in another terminal:

```powershell
npm run verify:local
npm run demo -- --persona developer
npm run demo -- --persona auditor
```

### Manual setup (four terminals)

```powershell
npm run db:local          # or use Docker: docker compose up postgres -d
npm run mock-auth:dev
npm run notification-api:dev
npm run local:setup && npm run dev:http
```

### Get a token

```powershell
curl -s -X POST http://127.0.0.1:9000/oauth/token `
  -H "Content-Type: application/json" `
  -d '{"grant_type":"client_credentials","role":"developer"}'
```

### Docker Compose

```bash
docker compose up --build
docker compose exec mcp-server npm run db:migrate
docker compose exec mcp-server npm run db:seed
```

## Auth flow (short version)

1. Client gets a JWT from the mock auth server (`POST /oauth/token`).
2. MCP requests include `Authorization: Bearer …`.
3. Server validates via JWKS (`iss`, `aud`, expiry).
4. Each tool checks scopes; audit tools also check role.

Resource metadata: `GET /.well-known/oauth-protected-resource` (RFC 9728).

## Connect from an IDE

Copy [examples/mcp-stdio.json](examples/mcp-stdio.json), paste a token from the mock auth server into `AGENTGATE_ACCESS_TOKEN`, and point your MCP client at it.

## Testing

```bash
npm test                  # unit
npm run test:integration  # needs Postgres
npm run test:e2e          # needs full stack
```

CI runs lint, typecheck, tests, and a Docker build on push.

## Project layout

```
src/mcp/           tools, resources, prompts
src/auth/          JWT, scopes, RBAC
src/services/      business logic
src/repositories/  Drizzle + PostgreSQL
mock-auth-server/  demo token issuer
notification-api/  fake approval webhook
scripts/           local dev, demo client, seed
```

## Limitations

- Mock OAuth — not full OAuth 2.1 (no PKCE/DCR/consent)
- Single tenant, in-memory rate limits
- Doc search is ILIKE, not embeddings
- Intended for local demos and learning

## Possible next steps

- Wire up [Descope Agentic Identity Hub](https://docs.descope.com/agentic-identity-hub) instead of mock auth
- Vector search over docs
- Deploy Streamable HTTP (Render / ECS)

## License

MIT
