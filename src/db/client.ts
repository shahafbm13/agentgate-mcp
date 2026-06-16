import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.js";

const { Pool } = pg;

let pool: pg.Pool | null = null;
let db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getPool(connectionString?: string): pg.Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: connectionString ?? process.env.DATABASE_URL,
    });
  }
  return pool;
}

export function getDb(connectionString?: string) {
  if (!db) {
    db = drizzle(getPool(connectionString), { schema });
  }
  return db;
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    db = null;
  }
}

export async function pingDb(connectionString?: string): Promise<boolean> {
  const client = getPool(connectionString);
  try {
    await client.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

export { schema };
