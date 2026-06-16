import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { getToken, SEED_IDS } from "../helpers/setup.js";

let mockAuth: ChildProcess | null = null;
let mcpServer: ChildProcess | null = null;
let notificationApi: ChildProcess | null = null;
let token = "";

async function waitFor(url: string, attempts = 30): Promise<void> {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Service not ready: ${url}`);
}

async function mcpRequest(method: string, params: Record<string, unknown>, authToken: string) {
  const response = await fetch("http://localhost:3000/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params,
    }),
  });
  return { status: response.status, body: await response.json() };
}

describe("MCP e2e flow", () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = "postgresql://agentgate:agentgate@localhost:5432/agentgate";

    try {
      const pool = await import("pg").then((m) => new m.default.Pool({ connectionString: process.env.DATABASE_URL }));
      await pool.query("SELECT 1");
      await pool.end();
    } catch {
      console.warn("PostgreSQL not available — skipping e2e tests");
      return;
    }

    const { execSync } = await import("node:child_process");
    execSync("npx tsx src/db/migrate.ts", { stdio: "pipe" });
    execSync("npx tsx scripts/seed.ts", { stdio: "pipe" });

    mockAuth = spawn("npx", ["tsx", "mock-auth-server/index.ts"], {
      cwd: process.cwd(),
      stdio: "pipe",
      shell: true,
      env: { ...process.env, MOCK_AUTH_PORT: "9000" },
    });

    notificationApi = spawn("npx", ["tsx", "notification-api/index.ts"], {
      cwd: process.cwd(),
      stdio: "pipe",
      shell: true,
      env: { ...process.env, NOTIFICATION_API_PORT: "9001" },
    });

    mcpServer = spawn("npx", ["tsx", "src/index.ts"], {
      cwd: process.cwd(),
      stdio: "pipe",
      shell: true,
      env: {
        ...process.env,
        PORT: "3000",
        TRANSPORT: "http",
        JWT_ISSUER: "http://localhost:9000",
        JWKS_URI: "http://localhost:9000/.well-known/jwks.json",
        AUTH_SERVER_URL: "http://localhost:9000",
        NOTIFICATION_API_URL: "http://localhost:9001",
      },
    });

    await waitFor("http://localhost:9000/.well-known/jwks.json");
    await waitFor("http://localhost:3000/health");
    token = await getToken("developer");
  }, 60000);

  afterAll(async () => {
    mockAuth?.kill();
    mcpServer?.kill();
    notificationApi?.kill();
    const { closeDb } = await import("../../src/db/client.js");
    await closeDb();
  });

  it("returns protected resource metadata", async () => {
    if (!token) return;
    const res = await fetch("http://localhost:3000/.well-known/oauth-protected-resource");
    const data = await res.json() as { scopes_supported: string[] };
    expect(data.scopes_supported).toContain("apps:read");
  });

  it("rejects unauthenticated MCP requests", async () => {
    if (!token) return;
    const res = await fetch("http://localhost:3000/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
    });
    expect(res.status).toBe(401);
  });

  it("lists tools with valid token", async () => {
    if (!token) return;
    const { status, body } = await mcpRequest("tools/list", {}, token);
    expect(status).toBe(200);
    expect(body.result.tools.map((t: { name: string }) => t.name)).toContain("check_permission");
  });

  it("checks permission for user", async () => {
    if (!token) return;
    const { body } = await mcpRequest("tools/call", {
      name: "check_permission",
      arguments: {
        userId: SEED_IDS.users.alice,
        applicationId: SEED_IDS.apps.payments,
        action: "read",
      },
    }, token);

    const text = body.result?.content?.[0]?.text;
    expect(text).toBeDefined();
    const parsed = JSON.parse(text);
    expect(parsed.allowed).toBe(false);
  });
});
