import type { Role, Scope } from "../domain/schemas.js";

export const ROLE_SCOPES: Record<Role, Scope[]> = {
  admin: ["users:read", "apps:read", "audit:read", "access:read", "access:write", "docs:read"],
  developer: ["users:read", "apps:read", "access:read", "access:write", "docs:read"],
  auditor: ["users:read", "apps:read", "audit:read", "docs:read"],
  readonly: ["apps:read", "docs:read"],
};

export function roleHasScope(role: Role, scope: Scope): boolean {
  return ROLE_SCOPES[role]?.includes(scope) ?? false;
}

export function canReadUserProfile(actorRole: Role, actorUserId: string, targetUserId: string): boolean {
  if (actorRole === "admin" || actorRole === "auditor") return true;
  return actorUserId === targetUserId;
}

export function canReadAuditEvents(role: Role): boolean {
  return role === "admin" || role === "auditor";
}

export function canCreateAccessRequest(role: Role): boolean {
  return role === "admin" || role === "developer";
}
