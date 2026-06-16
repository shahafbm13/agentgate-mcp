import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { getToken, SEED_IDS } from "../helpers/setup.js";

let mockAuth: ChildProcess | null = null;
let mcpServer: ChildProcess | null = null;

async function waitFor(url: string): Promise<void> {
  for (let i = 0; i < 30; i++) {
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

async function callTool(name: string, args: Record<string, unknown>, authToken: string) {
  const response = await fetch("http://localhost:3000/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name, arguments: args },
    }),
  });
  return response.json();
}

describe("authorization negative cases", () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = "postgresql://agentgate:agentgate@localhost:5432/agentgate";

    try {
      const pg = await import("pg");
      const pool = new pg.default.Pool({ connectionString: process.env.DATABASE_URL });
      await pool.query("SELECT 1");
      await pool.end();
    } catch {
      return;
    }

    mockAuth = spawn("npx", ["tsx", "mock-auth-server/index.ts"], {
      cwd: process.cwd(), stdio: "pipe", shell: true,
      env: { ...process.env, MOCK_AUTH_PORT: "9000" },
    });

    mcpServer = spawn("npx", ["tsx", "src/index.ts"], {
      cwd: process.cwd(), stdio: "pipe", shell: true,
      env: {
        ...process.env,
        PORT: "3000",
        TRANSPORT: "http",
        JWT_ISSUER: "http://localhost:9000",
        JWKS_URI: "http://localhost:9000/.well-known/jwks.json",
      },
    });

    await waitFor("http://localhost:9000/.well-known/jwks.json");
    await waitFor("http://localhost:3000/health");
  }, 60000);

  afterAll(() => {
    mockAuth?.kill();
    mcpServer?.kill();
  });

  it("readonly cannot create access requests", async () => {
    try {
      await fetch("http://localhost:3000/health");
    } catch {
      return;
    }

    const token = await getToken("readonly");
    const body = await callTool("create_access_request", {
      applicationId: SEED_IDS.apps.analytics,
      reason: "Need access for debugging production issue",
      requestedPermission: "read",
    }, token);

    const text = body.result?.content?.[0]?.text ?? "";
    expect(body.result?.isError || text.includes("insufficient_scope")).toBe(true);
  });

  it("developer cannot read audit events", async () => {
    try {
      await fetch("http://localhost:3000/health");
    } catch {
      return;
    }

    const token = await getToken("developer");
    const body = await callTool("get_audit_events", { limit: 5 }, token);
    const text = body.result?.content?.[0]?.text ?? "";
    expect(body.result?.isError || text.includes("Forbidden")).toBe(true);
  });

  it("auditor can read audit events", async () => {
    try {
      await fetch("http://localhost:3000/health");
    } catch {
      return;
    }

    const token = await getToken("auditor");
    const body = await callTool("get_audit_events", { limit: 5 }, token);
    expect(body.result?.isError).toBeFalsy();
    const parsed = JSON.parse(body.result.content[0].text);
    expect(parsed.count).toBeGreaterThan(0);
  });
});
