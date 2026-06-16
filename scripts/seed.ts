import { loadEnv } from "./load-env.js";

loadEnv();

import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const SEED_IDS = {
  users: {
    alice: "11111111-1111-4111-8111-111111111111",
    bob: "22222222-2222-4222-8222-222222222222",
    carol: "33333333-3333-4333-8333-333333333333",
  },
  apps: {
    payments: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    analytics: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    hr: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    publicDocs: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  },
} as const;

async function seed() {
  const connectionString = process.env.DATABASE_URL ?? "postgresql://agentgate:agentgate@127.0.0.1:5432/agentgate";
  const pool = new pg.Pool({ connectionString });

  try {
    await pool.query("DELETE FROM audit_events");
    await pool.query("DELETE FROM access_requests");
    await pool.query("DELETE FROM access_policies");
    await pool.query("DELETE FROM documentation_articles");
    await pool.query("DELETE FROM applications");
    await pool.query("DELETE FROM users");

    await pool.query(`
      INSERT INTO users (id, email, display_name, role, department) VALUES
      ($1, 'alice@corp.dev', 'Alice Developer', 'developer', 'Engineering'),
      ($2, 'bob@corp.dev', 'Bob Auditor', 'auditor', 'Security'),
      ($3, 'carol@corp.dev', 'Carol Admin', 'admin', 'Platform')
    `, [SEED_IDS.users.alice, SEED_IDS.users.bob, SEED_IDS.users.carol]);

    await pool.query(`
      INSERT INTO applications (id, slug, name, description, owner_team, sensitivity) VALUES
      ($1, 'payments-api', 'Payments API', 'Core payment processing service', 'Payments', 'confidential'),
      ($2, 'analytics-dashboard', 'Analytics Dashboard', 'Internal metrics and reporting', 'Data', 'internal'),
      ($3, 'hr-portal', 'HR Portal', 'Employee records and benefits', 'HR', 'restricted'),
      ($4, 'public-docs', 'Public Docs', 'External developer documentation', 'Developer Relations', 'public')
    `, [SEED_IDS.apps.payments, SEED_IDS.apps.analytics, SEED_IDS.apps.hr, SEED_IDS.apps.publicDocs]);

    await pool.query(`
      INSERT INTO access_policies (user_id, application_id, permission, expires_at) VALUES
      ($1, $2, 'read', NULL),
      ($1, $3, 'write', NULL),
      ($4, $5, 'admin', NULL),
      ($4, $2, 'admin', NULL),
      ($4, $6, 'admin', NULL),
      ($4, $3, 'read', NULL)
    `, [
      SEED_IDS.users.alice,
      SEED_IDS.apps.analytics,
      SEED_IDS.apps.publicDocs,
      SEED_IDS.users.carol,
      SEED_IDS.apps.payments,
      SEED_IDS.apps.hr,
    ]);

    const auditActions = [
      ["access_policy.granted", "access_policy", SEED_IDS.users.carol, "carol@corp.dev"],
      ["user.login", "session", SEED_IDS.users.alice, "alice@corp.dev"],
      ["user.login", "session", SEED_IDS.users.bob, "bob@corp.dev"],
      ["permission.checked", "application", SEED_IDS.users.alice, "alice@corp.dev"],
      ["access_request.created", "access_request", SEED_IDS.users.alice, "alice@corp.dev"],
      ["audit.export", "audit_log", SEED_IDS.users.bob, "bob@corp.dev"],
      ["application.registered", "application", SEED_IDS.users.carol, "carol@corp.dev"],
      ["scope.validated", "mcp_tool", SEED_IDS.users.bob, "bob@corp.dev"],
      ["permission.denied", "application", SEED_IDS.users.alice, "alice@corp.dev"],
      ["documentation.searched", "documentation", SEED_IDS.users.alice, "alice@corp.dev"],
    ];

    for (const [action, resourceType, actorId, actorEmail] of auditActions) {
      await pool.query(`
        INSERT INTO audit_events (actor_user_id, actor_email, action, resource_type, resource_id, metadata)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [actorId, actorEmail, action, resourceType, null, JSON.stringify({ source: "seed" })]);
    }

    for (let i = 0; i < 10; i++) {
      await pool.query(`
        INSERT INTO audit_events (actor_user_id, actor_email, action, resource_type, metadata)
        VALUES ($1, $2, 'tool.invoked', 'mcp_tool', $3)
      `, [SEED_IDS.users.alice, "alice@corp.dev", JSON.stringify({ tool: "check_permission", iteration: i })]);
    }

    const docsDir = join(__dirname, "../docs/knowledge");
    const files = readdirSync(docsDir).filter((f) => f.endsWith(".md"));

    for (const file of files) {
      const content = readFileSync(join(docsDir, file), "utf-8");
      const slug = file.replace(".md", "");
      const titleMatch = content.match(/^#\s+(.+)$/m);
      const title = titleMatch?.[1] ?? slug;
      const category = slug.split("-")[0] ?? "general";

      await pool.query(`
        INSERT INTO documentation_articles (slug, title, category, content)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (slug) DO UPDATE SET title = $2, category = $3, content = $4
      `, [slug, title, category, content]);
    }

    console.log("Seed complete:");
    console.log(`  Users: ${Object.keys(SEED_IDS.users).length}`);
    console.log(`  Applications: ${Object.keys(SEED_IDS.apps).length}`);
    console.log(`  Documentation articles: ${files.length}`);
  } finally {
    await pool.end();
  }
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
