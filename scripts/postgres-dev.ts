import { loadEnv } from "./load-env.js";

loadEnv();

import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";

const DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://agentgate:agentgate@127.0.0.1:5432/agentgate";

async function isPostgresReachable(): Promise<boolean> {
  const pool = new pg.Pool({ connectionString: DATABASE_URL });
  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  } finally {
    await pool.end();
  }
}

async function main() {
  if (await isPostgresReachable()) {
    console.log("PostgreSQL already reachable at", DATABASE_URL);
    return;
  }

  console.log("Starting embedded PostgreSQL (no Docker required)...");

  const embedded = new EmbeddedPostgres({
    databaseDir: "./data/db",
    user: "agentgate",
    password: "agentgate",
    port: 5432,
    persistent: true,
  });

  await embedded.initialise();
  await embedded.start();

  try {
    await embedded.createDatabase("agentgate");
    console.log("Created database: agentgate");
  } catch {
    console.log("Database agentgate already exists");
  }

  console.log("Embedded PostgreSQL running.");
  console.log("DATABASE_URL=postgresql://agentgate:agentgate@127.0.0.1:5432/agentgate");
  console.log("Press Ctrl+C to stop.");

  const shutdown = async () => {
    console.log("\nStopping embedded PostgreSQL...");
    await embedded.stop();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await new Promise(() => {});
}

main().catch((err) => {
  console.error("Failed to start embedded PostgreSQL:", err);
  process.exit(1);
});
