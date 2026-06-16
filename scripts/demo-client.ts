#!/usr/bin/env tsx
/**
 * Demo MCP client — runs realistic scenarios against AgentGate MCP.
 *
 * Usage:
 *   npm run demo -- --persona developer
 *   npm run demo -- --persona auditor
 *   npm run demo -- --persona admin
 */

import { loadEnv } from "./load-env.js";

loadEnv();

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { SEED_IDS, getToken } from "../tests/helpers/setup.js";

const MCP_URL = process.env.MCP_URL ?? "http://127.0.0.1:3000/mcp";
const AUTH_URL = process.env.AUTH_SERVER_URL ?? "http://127.0.0.1:9000";

function parseArgs(): { persona: "developer" | "auditor" | "admin" } {
  const idx = process.argv.indexOf("--persona");
  const persona = (idx >= 0 ? process.argv[idx + 1] : "developer") as "developer" | "auditor" | "admin";
  return { persona };
}

async function callTool(client: Client, name: string, args: Record<string, unknown>) {
  const result = await client.callTool({ name, arguments: args });
  const content = result.content as Array<{ type: string; text?: string }> | undefined;
  const text = content?.[0]?.type === "text" ? content[0].text : JSON.stringify(result);
  console.log(`\n=== ${name} ===`);
  console.log(text);
  return JSON.parse(text ?? "{}");
}

async function main() {
  const { persona } = parseArgs();
  console.log(`AgentGate MCP Demo — persona: ${persona}`);

  const token = await getToken(persona, AUTH_URL);
  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL), {
    requestInit: {
      headers: { Authorization: `Bearer ${token}` },
    },
  });

  const client = new Client({ name: "agentgate-demo", version: "1.0.0" });
  await client.connect(transport);

  const tools = await client.listTools();
  console.log("\nAvailable tools:", tools.tools.map((t) => t.name).join(", "));

  // Scenario 1: Permission check
  await callTool(client, "check_permission", {
    userId: SEED_IDS.users.alice,
    applicationId: SEED_IDS.apps.payments,
    action: "read",
  });

  if (persona === "auditor" || persona === "admin") {
    // Scenario 2: Audit trail
    await callTool(client, "get_audit_events", { limit: 5 });
  }

  if (persona === "developer" || persona === "admin") {
    // Scenario 3: Access request
    await callTool(client, "create_access_request", {
      applicationId: SEED_IDS.apps.payments,
      reason: "Need read access to investigate payment reconciliation issue",
      requestedPermission: "read",
      durationHours: 24,
    });
  }

  // Scenario 4: Documentation search
  await callTool(client, "search_identity_documentation", {
    query: "OAuth scope",
    limit: 3,
  });

  await client.close();
  console.log("\nDemo complete.");
}

main().catch((err) => {
  console.error("Demo failed:", err);
  process.exit(1);
});
