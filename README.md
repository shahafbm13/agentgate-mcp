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

**Requirements:** Docker + Docker Compose (recommended), or Node 18+ for local dev without Docker.

### Docker (recommended)

One command brings up Postgres, mock auth, notification API, and the MCP server (migrations + seed run automatically):

```bash
git clone https://github.com/shahafbm13/agentgate-mcp.git
cd agentgate-mcp
docker compose up --build
```

Wait until the MCP server logs `AgentGate MCP server running on HTTP transport`, then verify from another terminal:

```bash
curl http://127.0.0.1:3000/health
npm install   # only needed for demo CLI on the host
npm run demo -- --persona developer
npm run demo -- --persona auditor
```

Services:

| Service | URL |
|---------|-----|
| MCP server | http://127.0.0.1:3000/mcp |
| Mock auth | http://127.0.0.1:9000 |
| Health | http://127.0.0.1:3000/health |

Stop with `docker compose down` (add `-v` to reset the database).

### Local dev (no Docker)

Useful when iterating on code without rebuilding containers:

```powershell
npm install
copy .env.example .env   # or cp on macOS/Linux
npm run local
```

`npm run local` starts embedded Postgres (if nothing is listening on 5432), runs migrations + seed, then mock auth, notification API, and the MCP server.

Verify in another terminal:

```powershell
npm run verify:local
npm run demo -- --persona developer
npm run demo -- --persona auditor
```

To try it in **Cursor**, see [Connect from Cursor](#connect-from-cursor) below.

### Manual setup (four terminals)

```powershell
npm run db:local          # or: docker compose up postgres -d
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

## Auth flow (short version)

1. Client gets a JWT from the mock auth server (`POST /oauth/token`).
2. MCP requests include `Authorization: Bearer …`.
3. Server validates via JWKS (`iss`, `aud`, expiry).
4. Each tool checks scopes; audit tools also check role.

Resource metadata: `GET /.well-known/oauth-protected-resource` (RFC 9728).

## Connect from Cursor

Cursor connects via **stdio** — it spawns the MCP server as a child process on your machine. The mock auth server must still be running (for JWKS validation at startup).

### 1. Start the stack

Either Docker or local dev works as the backend:

```bash
docker compose up --build    # recommended
# or
npm run local
```

Keep that terminal running.

### 2. Get a token

In another terminal:

```powershell
curl -s -X POST http://127.0.0.1:9000/oauth/token `
  -H "Content-Type: application/json" `
  -d '{"grant_type":"client_credentials","role":"developer"}'
```

Use `"role":"auditor"` or `"role":"admin"` for audit-log tools. Tokens expire after 1 hour.

### 3. Add project MCP config

Copy [examples/mcp-stdio.json](examples/mcp-stdio.json) to `.cursor/mcp.json` and paste the `access_token` into `AGENTGATE_ACCESS_TOKEN`.

`.cursor/mcp.json` is gitignored — don't commit tokens.

**Important:** `JWT_ISSUER` and `JWT_AUDIENCE` must match the mock auth server (`http://localhost:9000` and `http://localhost:3000/mcp`). The token `iss`/`aud` claims use `localhost`, not `127.0.0.1`.

When using Docker, stdio still runs on the host — set `DATABASE_URL` to `postgresql://agentgate:agentgate@127.0.0.1:5432/agentgate` so the spawned process can reach the containerized Postgres.

### 4. Enable in Cursor

1. Open **Cursor Settings → MCP**
2. Find **agentgate** under project servers
3. Click **Refresh** if it shows disconnected
4. Start a **new chat** (MCP tools load at chat start)

Try prompts like *"Use agentgate to check if Alice can read the Payments API"* or *"Search identity docs for MFA via agentgate"*.

### Windows troubleshooting

If stdio fails to spawn, wrap the command:

```json
"command": "cmd",
"args": ["/c", "npx", "tsx", "src/index.ts"]
```

### Other MCP clients

The same env vars in [examples/mcp-stdio.json](examples/mcp-stdio.json) work for Claude Desktop and other stdio clients. For HTTP transport, point clients at `http://127.0.0.1:3000/mcp` with a Bearer token (see `npm run demo`).

## Testing

```bash
npm test                  # unit
npm run test:integration  # needs Postgres
npm run test:e2e          # needs full stack
```

CI runs lint, typecheck, tests, and a Docker build on push. The full stack is also runnable via `docker compose up --build`.

## Project layout

```
src/mcp/           tools, resources, prompts
src/auth/          JWT, scopes, RBAC
src/services/      business logic
src/repositories/  Drizzle + PostgreSQL
mock-auth-server/  demo token issuer
notification-api/  fake approval webhook
scripts/           local dev, demo client, seed
examples/          MCP client config templates
.cursor/mcp.json   Cursor project config (local only, gitignored)
```

## Limitations

- Mock OAuth — not full OAuth 2.1 (no PKCE/DCR/consent)
- Single tenant, in-memory rate limits
- Doc search is ILIKE, not embeddings
- Intended for local demos and learning

## Possible next steps

- Wire up a production OAuth 2.1 / OIDC provider instead of mock auth
- Vector search over docs
- Deploy Streamable HTTP (Render / ECS)

## License

MIT
