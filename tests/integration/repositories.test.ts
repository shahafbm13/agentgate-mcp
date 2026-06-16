import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { UserRepository, ApplicationRepository, DocumentationRepository } from "../../src/repositories/index.js";
import { getPool, closeDb } from "../../src/db/client.js";
import { SEED_IDS } from "../helpers/setup.js";

describe("repositories integration", () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://agentgate:agentgate@localhost:5432/agentgate";
    const pool = getPool();
    try {
      await pool.query("SELECT 1");
    } catch {
      console.warn("PostgreSQL not available — skipping integration tests");
      return;
    }
    const { execSync } = await import("node:child_process");
    execSync("npx tsx src/db/migrate.ts", { stdio: "pipe" });
    execSync("npx tsx scripts/seed.ts", { stdio: "pipe" });
  });

  it("finds seeded users", async () => {
    const pool = getPool();
    try {
      await pool.query("SELECT 1");
    } catch {
      return;
    }

    const users = new UserRepository();
    const alice = await users.findByEmail("alice@corp.dev");
    expect(alice?.id).toBe(SEED_IDS.users.alice);
    expect(alice?.role).toBe("developer");
  });

  it("lists applications", async () => {
    const pool = getPool();
    try {
      await pool.query("SELECT 1");
    } catch {
      return;
    }

    const apps = new ApplicationRepository();
    const list = await apps.list({ limit: 10 });
    expect(list.length).toBeGreaterThanOrEqual(4);
  });

  it("searches documentation", async () => {
    const pool = getPool();
    try {
      await pool.query("SELECT 1");
    } catch {
      return;
    }

    const docs = new DocumentationRepository();
    const results = await docs.search("OAuth", 5);
    expect(results.length).toBeGreaterThan(0);
  });

  afterAll(async () => {
    await closeDb();
  });
});
