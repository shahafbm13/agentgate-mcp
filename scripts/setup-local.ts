import { loadEnv } from "./load-env.js";

loadEnv();

import { execSync } from "node:child_process";
import pg from "pg";

const DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://agentgate:agentgate@127.0.0.1:5432/agentgate";

async function waitForPostgres(maxAttempts = 30): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    const pool = new pg.Pool({ connectionString: DATABASE_URL });
    try {
      await pool.query("SELECT 1");
      console.log("PostgreSQL is ready.");
      return;
    } catch {
      if (i === 0) {
        console.log("Waiting for PostgreSQL...");
        console.log("  If not running, open another terminal and run: npm run db:local");
      }
      await new Promise((r) => setTimeout(r, 1000));
    } finally {
      await pool.end().catch(() => {});
    }
  }
  throw new Error(
    "PostgreSQL is not reachable. Start it with:\n  npm run db:local\nOr install PostgreSQL and set DATABASE_URL in .env",
  );
}

async function main() {
  process.env.DATABASE_URL = DATABASE_URL;
  await waitForPostgres();

  console.log("Running migrations...");
  execSync("npx tsx src/db/migrate.ts", { stdio: "inherit", env: process.env });

  console.log("Seeding database...");
  execSync("npx tsx scripts/seed.ts", { stdio: "inherit", env: process.env });

  console.log("Local setup complete.");
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
