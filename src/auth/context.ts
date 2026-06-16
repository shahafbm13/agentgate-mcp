import { AsyncLocalStorage } from "node:async_hooks";
import type { AuthContext } from "./jwt-validator.js";

export const authStorage = new AsyncLocalStorage<AuthContext>();

let stdioAuthContext: AuthContext | undefined;

export function setStdioAuthContext(auth: AuthContext): void {
  stdioAuthContext = auth;
}

export function getAuthContext(): AuthContext | undefined {
  return authStorage.getStore() ?? stdioAuthContext;
}

export function requireAuthContext(): AuthContext {
  const ctx = getAuthContext();
  if (!ctx) {
    throw new Error("Authentication context not available");
  }
  return ctx;
}

export function extractBearerToken(authHeader?: string): string | undefined {
  if (!authHeader?.startsWith("Bearer ")) return undefined;
  return authHeader.slice(7).trim();
}
