import { createRemoteJWKSet, jwtVerify, type JWTVerifyOptions } from "jose";
import type { AppConfig } from "../config/index.js";
import { TokenClaimsSchema, type TokenClaims } from "../domain/schemas.js";
import { InsufficientScopeError, UnauthorizedError } from "../domain/errors.js";
import { parseScopesFromToken } from "./scopes.js";
import type { Scope } from "../domain/schemas.js";

export interface AuthContext {
  sub: string;
  email?: string;
  roles: TokenClaims["roles"];
  scopes: Scope[];
  rawClaims: TokenClaims;
}

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks(jwksUri: string) {
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(jwksUri));
  }
  return jwks;
}

export function resetJwksCache(): void {
  jwks = null;
}

export async function validateToken(
  token: string,
  config: AppConfig,
): Promise<AuthContext> {
  if (!token) {
    throw new UnauthorizedError("Missing access token");
  }

  const verifyOptions: JWTVerifyOptions = {
    issuer: config.JWT_ISSUER,
    audience: config.JWT_AUDIENCE,
  };

  try {
    const { payload } = await jwtVerify(token, getJwks(config.JWKS_URI), verifyOptions);
    const parsed = TokenClaimsSchema.safeParse(payload);
    if (!parsed.success) {
      throw new UnauthorizedError("Invalid token claims");
    }

    const claims = parsed.data;
    const scopes = parseScopesFromToken(claims.scope, claims.scopes);

    return {
      sub: claims.sub,
      email: claims.email,
      roles: claims.roles ?? [],
      scopes,
      rawClaims: claims,
    };
  } catch (err) {
    if (err instanceof UnauthorizedError) throw err;
    throw new UnauthorizedError("Invalid or expired access token");
  }
}

export function requireScopes(auth: AuthContext, requiredScopes: Scope[]): void {
  const missing = requiredScopes.filter((s) => !auth.scopes.includes(s));
  if (missing.length > 0) {
    throw new InsufficientScopeError(requiredScopes, auth.scopes, missing);
  }
}
