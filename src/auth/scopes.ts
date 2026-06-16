import type { Scope } from "../domain/schemas.js";

export const ALL_SCOPES: Scope[] = [
  "users:read",
  "apps:read",
  "audit:read",
  "access:read",
  "access:write",
  "docs:read",
];

export const TOOL_SCOPES: Record<string, Scope[]> = {
  get_user: ["users:read"],
  list_applications: ["apps:read"],
  get_audit_events: ["audit:read"],
  create_access_request: ["access:write"],
  check_permission: ["access:read"],
  search_identity_documentation: ["docs:read"],
};

export const RESOURCE_SCOPES: Record<string, Scope[]> = {
  "user://": ["users:read"],
  "app://": ["apps:read"],
  "policy://": ["access:read"],
  "audit://": ["audit:read"],
  "docs://": ["docs:read"],
};

export function parseScopesFromToken(scopeClaim?: string, scopesArray?: Scope[]): Scope[] {
  if (scopesArray?.length) return scopesArray;
  if (!scopeClaim) return [];
  return scopeClaim.split(/\s+/).filter(Boolean) as Scope[];
}

export function getRequiredScopesForTool(toolName: string): Scope[] {
  return TOOL_SCOPES[toolName] ?? [];
}

export function getRequiredScopesForResource(uri: string): Scope[] {
  for (const [prefix, scopes] of Object.entries(RESOURCE_SCOPES)) {
    if (uri.startsWith(prefix)) return scopes;
  }
  return [];
}
