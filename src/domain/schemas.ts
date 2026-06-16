import { z } from "zod";

export const RoleSchema = z.enum(["admin", "developer", "auditor", "readonly"]);
export type Role = z.infer<typeof RoleSchema>;

export const ScopeSchema = z.enum([
  "users:read",
  "apps:read",
  "audit:read",
  "access:read",
  "access:write",
  "docs:read",
]);
export type Scope = z.infer<typeof ScopeSchema>;

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string(),
  role: RoleSchema,
  department: z.string().nullable(),
  createdAt: z.coerce.date(),
});
export type User = z.infer<typeof UserSchema>;

export const ApplicationSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  ownerTeam: z.string(),
  sensitivity: z.enum(["public", "internal", "confidential", "restricted"]),
  createdAt: z.coerce.date(),
});
export type Application = z.infer<typeof ApplicationSchema>;

export const AccessPolicySchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  applicationId: z.string().uuid(),
  permission: z.enum(["read", "write", "admin"]),
  grantedAt: z.coerce.date(),
  expiresAt: z.coerce.date().nullable(),
});
export type AccessPolicy = z.infer<typeof AccessPolicySchema>;

export const AccessRequestSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  applicationId: z.string().uuid(),
  requestedPermission: z.enum(["read", "write", "admin"]),
  reason: z.string(),
  status: z.enum(["pending", "approved", "denied", "expired"]),
  createdAt: z.coerce.date(),
});
export type AccessRequest = z.infer<typeof AccessRequestSchema>;

export const AuditEventSchema = z.object({
  id: z.string().uuid(),
  actorUserId: z.string().uuid().nullable(),
  actorEmail: z.string().nullable(),
  action: z.string(),
  resourceType: z.string(),
  resourceId: z.string().nullable(),
  metadata: z.record(z.unknown()).nullable(),
  createdAt: z.coerce.date(),
});
export type AuditEvent = z.infer<typeof AuditEventSchema>;

export const TokenClaimsSchema = z.object({
  sub: z.string(),
  email: z.string().email().optional(),
  roles: z.array(RoleSchema).default([]),
  scope: z.string().optional(),
  scopes: z.array(ScopeSchema).optional(),
  aud: z.union([z.string(), z.array(z.string())]).optional(),
  iss: z.string().optional(),
  exp: z.number().optional(),
  iat: z.number().optional(),
});
export type TokenClaims = z.infer<typeof TokenClaimsSchema>;

export const GetUserInputSchema = z.object({
  userId: z.string().uuid().optional(),
  email: z.string().email().optional(),
}).refine((d) => d.userId || d.email, { message: "userId or email required" });

export const ListApplicationsInputSchema = z.object({
  sensitivity: z.enum(["public", "internal", "confidential", "restricted"]).optional(),
  limit: z.number().int().min(1).max(100).default(20),
});

export const GetAuditEventsInputSchema = z.object({
  limit: z.number().int().min(1).max(100).default(20),
  action: z.string().optional(),
  resourceType: z.string().optional(),
});

export const CreateAccessRequestInputSchema = z.object({
  applicationId: z.string().uuid(),
  requestedPermission: z.enum(["read", "write", "admin"]).default("read"),
  reason: z.string().min(10).max(500),
  durationHours: z.number().int().min(1).max(168).default(24),
});

export const CheckPermissionInputSchema = z.object({
  userId: z.string().uuid(),
  applicationId: z.string().uuid(),
  action: z.enum(["read", "write", "admin"]).default("read"),
});

export const SearchDocumentationInputSchema = z.object({
  query: z.string().min(2).max(200),
  limit: z.number().int().min(1).max(10).default(5),
});
