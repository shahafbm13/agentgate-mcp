import { loadEnv } from "./load-env.js";

loadEnv();

import { spawn, type ChildProcess } from "node:child_process";
import { execSync } from "node:child_process";
import pg from "pg";

const DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://agentgate:agentgate@127.0.0.1:5432/agentgate";
const children: ChildProcess[] = [];

function run(name: string, command: string, args: string[], extraEnv: Record<string, string> = {}) {
  const child = spawn(command, args, {
    stdio: "inherit",
    shell: true,
    env: { ...process.env, ...extraEnv },
  });
  child.on("exit", (code) => {
    if (code !== 0 && code !== null) {
      console.error(`${name} exited with code ${code}`);
    }
  });
  children.push(child);
  return child;
}

async function waitForPostgres(maxAttempts = 60): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    const pool = new pg.Pool({ connectionString: DATABASE_URL });
    try {
      await pool.query("SELECT 1");
      return true;
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    } finally {
      await pool.end().catch(() => {});
    }
  }
  return false;
}

async function main() {
  process.env.DATABASE_URL = DATABASE_URL;

  console.log("=== AgentGate MCP — local dev ===\n");

  let embedded: ChildProcess | null = null;
  const pool = new pg.Pool({ connectionString: DATABASE_URL });
  let postgresUp = false;
  try {
    await pool.query("SELECT 1");
    postgresUp = true;
  } catch {
    // start embedded
  } finally {
    await pool.end().catch(() => {});
  }

  if (!postgresUp) {
    console.log("Starting embedded PostgreSQL...");
    embedded = run("postgres", "npx", ["tsx", "scripts/postgres-dev.ts"]);
    const ready = await waitForPostgres(90);
    if (!ready) {
      throw new Error("Embedded PostgreSQL failed to start");
    }
    console.log("Embedded PostgreSQL ready.\n");
  } else {
    console.log("Using existing PostgreSQL.\n");
  }

  execSync("npx tsx scripts/setup-local.ts", { stdio: "inherit", env: process.env });

  console.log("\nStarting services...\n");

  run("mock-auth", "npx", ["tsx", "mock-auth-server/index.ts"], {
    MOCK_AUTH_PORT: "9000",
    JWT_ISSUER: "http://localhost:9000",
    JWT_AUDIENCE: "http://localhost:3000/mcp",
  });

  run("notification-api", "npx", ["tsx", "notification-api/index.ts"], {
    NOTIFICATION_API_PORT: "9001",
    NOTIFICATION_API_KEY: "dev-notification-key",
  });

  run("mcp-server", "npx", ["tsx", "src/index.ts"], {
    TRANSPORT: "http",
    PORT: "3000",
    MCP_RESOURCE_URI: "http://localhost:3000/mcp",
    BASE_URL: "http://localhost:3000",
    JWT_ISSUER: "http://localhost:9000",
    JWT_AUDIENCE: "http://localhost:3000/mcp",
    JWKS_URI: "http://localhost:9000/.well-known/jwks.json",
    AUTH_SERVER_URL: "http://localhost:9000",
    NOTIFICATION_API_URL: "http://localhost:9001",
    NOTIFICATION_API_KEY: "dev-notification-key",
  });

  console.log("\nWaiting for MCP server...");
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch("http://127.0.0.1:3000/health");
      if (res.ok) break;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log("\nServices:");
  console.log("  MCP server:        http://127.0.0.1:3000/mcp");
  console.log("  Health:            http://127.0.0.1:3000/health");
  console.log("  Mock auth:         http://127.0.0.1:9000");
  console.log("  Notification API:  http://127.0.0.1:9001");
  console.log("\nGet a token:");
  console.log('  curl -X POST http://localhost:9000/oauth/token -H "Content-Type: application/json" -d "{\\"grant_type\\":\\"client_credentials\\",\\"role\\":\\"developer\\"}"');
  console.log("\nRun demo:");
  console.log("  npm run demo -- --persona developer");
  console.log("\nPress Ctrl+C to stop all services.\n");

  const shutdown = () => {
    for (const child of children) {
      child.kill("SIGTERM");
    }
    if (embedded) embedded.kill("SIGTERM");
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
