import { loadEnv } from "./load-env.js";

loadEnv();

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const MCP_URL = process.env.MCP_URL ?? "http://127.0.0.1:3000/mcp";
const AUTH_URL = process.env.AUTH_SERVER_URL ?? "http://127.0.0.1:9000";

async function check(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`✓ ${name}`);
  } catch (err) {
    console.error(`✗ ${name}:`, err instanceof Error ? err.message : err);
    throw err;
  }
}

async function main() {
  console.log("Verifying local AgentGate MCP stack...\n");

  await check("MCP health", async () => {
    const res = await fetch(`${MCP_URL.replace(/\/mcp$/, "")}/health`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  });

  await check("MCP ready (database)", async () => {
    const base = MCP_URL.replace(/\/mcp$/, "");
    const res = await fetch(`${base}/ready`);
    const body = await res.json() as { database?: boolean };
    if (!res.ok || !body.database) throw new Error(`not ready: ${JSON.stringify(body)}`);
  });

  await check("Mock auth JWKS", async () => {
    const res = await fetch(`${AUTH_URL}/.well-known/jwks.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  });

  let token = "";
  await check("Token issuance", async () => {
    const res = await fetch(`${AUTH_URL}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grant_type: "client_credentials", role: "developer" }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json() as { access_token?: string };
    if (!data.access_token) throw new Error("no access_token");
    token = data.access_token;
  });

  await check("MCP tools/list (via client)", async () => {
    const transport = new StreamableHTTPClientTransport(new URL(MCP_URL), {
      requestInit: { headers: { Authorization: `Bearer ${token}` } },
    });
    const client = new Client({ name: "verify-local", version: "1.0.0" });
    await client.connect(transport);
    const tools = await client.listTools();
    if (!tools.tools.length) throw new Error("no tools returned");
    await client.close();
  });

  console.log("\nAll local checks passed.");
}

main().catch(() => process.exit(1));
