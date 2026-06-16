import { loadEnv } from "../../scripts/load-env.js";

loadEnv();
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function migrate(): Promise<void> {
  const connectionString = process.env.DATABASE_URL ?? "postgresql://agentgate:agentgate@127.0.0.1:5432/agentgate";
  const pool = new pg.Pool({ connectionString });

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash VARCHAR(255) NOT NULL UNIQUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const migrationsDir = join(__dirname, "../../drizzle");
    let files: string[] = [];
    try {
      files = readdirSync(migrationsDir)
        .filter((f) => f.endsWith(".sql"))
        .sort();
    } catch {
      console.log("No migration files found, applying inline schema...");
      await applyInlineSchema(pool);
      return;
    }

    for (const file of files) {
      const hash = file.replace(".sql", "");
      const existing = await pool.query("SELECT 1 FROM drizzle_migrations WHERE hash = $1", [hash]);
      if (existing.rowCount && existing.rowCount > 0) continue;

      const sql = readFileSync(join(migrationsDir, file), "utf-8");
      await pool.query(sql);
      await pool.query("INSERT INTO drizzle_migrations (hash) VALUES ($1)", [hash]);
      console.log(`Applied migration: ${file}`);
    }

    console.log("Migrations complete.");
  } finally {
    await pool.end();
  }
}

async function applyInlineSchema(pool: pg.Pool): Promise<void> {
  const sql = readFileSync(join(__dirname, "../../drizzle/0000_init.sql"), "utf-8");
  await pool.query(sql);
  console.log("Applied inline schema.");
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
