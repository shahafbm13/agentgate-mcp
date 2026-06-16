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

export async function getToken(
  role: "developer" | "auditor" | "admin" | "readonly" = "developer",
  authUrl = "http://127.0.0.1:9000",
): Promise<string> {
  const response = await fetch(`${authUrl}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ grant_type: "client_credentials", role }),
  });
  if (!response.ok) {
    throw new Error(`Failed to get token: ${response.status}`);
  }
  const data = await response.json() as { access_token: string };
  return data.access_token;
}

export async function setupDatabase(): Promise<void> {
  process.env.DATABASE_URL ??= "postgresql://agentgate:agentgate@localhost:5432/agentgate";
  const { execSync } = await import("node:child_process");
  execSync("npx tsx src/db/migrate.ts", { stdio: "inherit", cwd: process.cwd() });
  execSync("npx tsx scripts/seed.ts", { stdio: "inherit", cwd: process.cwd() });
}
