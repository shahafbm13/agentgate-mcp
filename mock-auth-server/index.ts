import { webcrypto } from "node:crypto";

if (!globalThis.crypto) {
  (globalThis as { crypto: typeof webcrypto }).crypto = webcrypto;
}

import express from "express";
import { generateKeyPair, exportJWK, SignJWT } from "jose";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const KEYS_DIR = join(__dirname, "keys");
const PRIVATE_KEY_PATH = join(KEYS_DIR, "private.pem");
const PUBLIC_KEY_PATH = join(KEYS_DIR, "public.pem");

const PORT = Number(process.env.MOCK_AUTH_PORT ?? 9000);
const ISSUER = process.env.JWT_ISSUER ?? `http://localhost:${PORT}`;
const AUDIENCE = process.env.JWT_AUDIENCE ?? "http://localhost:3000/mcp";

type Role = "admin" | "developer" | "auditor" | "readonly";

const ROLE_SCOPES: Record<Role, string[]> = {
  admin: ["users:read", "apps:read", "audit:read", "access:read", "access:write", "docs:read"],
  developer: ["users:read", "apps:read", "access:read", "access:write", "docs:read"],
  auditor: ["users:read", "apps:read", "audit:read", "docs:read"],
  readonly: ["apps:read", "docs:read"],
};

interface KeyPair {
  privateKey: Awaited<ReturnType<typeof generateKeyPair>>["privateKey"];
  publicKey: Awaited<ReturnType<typeof generateKeyPair>>["publicKey"];
  kid: string;
}

async function loadOrGenerateKeys(): Promise<KeyPair> {
  mkdirSync(KEYS_DIR, { recursive: true });
  const kid = "agentgate-demo-key";

  if (existsSync(PRIVATE_KEY_PATH) && existsSync(PUBLIC_KEY_PATH)) {
    const { importPKCS8, importSPKI } = await import("jose");
    const privatePem = readFileSync(PRIVATE_KEY_PATH, "utf-8");
    const publicPem = readFileSync(PUBLIC_KEY_PATH, "utf-8");
    return {
      privateKey: await importPKCS8(privatePem, "RS256"),
      publicKey: await importSPKI(publicPem, "RS256"),
      kid,
    };
  }

  const { privateKey, publicKey } = await generateKeyPair("RS256", { extractable: true });
  const { exportPKCS8, exportSPKI } = await import("jose");
  writeFileSync(PRIVATE_KEY_PATH, await exportPKCS8(privateKey));
  writeFileSync(PUBLIC_KEY_PATH, await exportSPKI(publicKey));
  return { privateKey, publicKey, kid };
}

async function main() {
  const keys = await loadOrGenerateKeys();
  const publicJwk = await exportJWK(keys.publicKey);
  publicJwk.kid = keys.kid;
  publicJwk.alg = "RS256";
  publicJwk.use = "sig";

  const app = express();
  app.use(express.json());

  app.get("/.well-known/jwks.json", (_req, res) => {
    res.json({ keys: [publicJwk] });
  });

  app.get("/.well-known/oauth-protected-resource", (_req, res) => {
    res.json({
      resource: AUDIENCE,
      authorization_servers: [ISSUER],
      scopes_supported: Object.values(ROLE_SCOPES).flat(),
      bearer_methods_supported: ["header"],
    });
  });

  app.post("/oauth/token", async (req, res) => {
    const {
      grant_type = "client_credentials",
      scope,
      sub,
      email,
      role = "developer",
    } = req.body as {
      grant_type?: string;
      scope?: string;
      sub?: string;
      email?: string;
      role?: Role;
    };

    if (grant_type !== "client_credentials") {
      res.status(400).json({ error: "unsupported_grant_type" });
      return;
    }

    const roleScopes = ROLE_SCOPES[role] ?? ROLE_SCOPES.developer;
    const requestedScopes = scope ? scope.split(/\s+/).filter(Boolean) : roleScopes;
    const grantedScopes = requestedScopes.filter((s) => roleScopes.includes(s));

    const defaultUsers: Record<Role, { sub: string; email: string }> = {
      developer: { sub: "11111111-1111-4111-8111-111111111111", email: "alice@corp.dev" },
      auditor: { sub: "22222222-2222-4222-8222-222222222222", email: "bob@corp.dev" },
      admin: { sub: "33333333-3333-4333-8333-333333333333", email: "carol@corp.dev" },
      readonly: { sub: "44444444-4444-4444-8444-444444444444", email: "readonly@corp.dev" },
    };

    const userId = sub ?? defaultUsers[role]?.sub ?? defaultUsers.developer.sub;
    const userEmail = email ?? defaultUsers[role]?.email ?? `${role}@corp.dev`;

    const token = await new SignJWT({
      email: userEmail,
      roles: [role],
      scope: grantedScopes.join(" "),
      scopes: grantedScopes,
    })
      .setProtectedHeader({ alg: "RS256", kid: keys.kid })
      .setSubject(userId)
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(keys.privateKey);

    res.json({
      access_token: token,
      token_type: "Bearer",
      expires_in: 3600,
      scope: grantedScopes.join(" "),
    });
  });

  app.listen(PORT, () => {
    console.log(`Mock auth server listening on http://localhost:${PORT}`);
    console.log(`JWKS: http://localhost:${PORT}/.well-known/jwks.json`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
