import { describe, it, expect } from "vitest";
import { canReadUserProfile, canReadAuditEvents, canCreateAccessRequest, ROLE_SCOPES } from "../../../src/auth/rbac.js";

describe("rbac", () => {
  it("maps roles to scopes", () => {
    expect(ROLE_SCOPES.admin).toContain("audit:read");
    expect(ROLE_SCOPES.readonly).not.toContain("access:write");
  });

  it("allows admin to read any user profile", () => {
    expect(canReadUserProfile("admin", "a", "b")).toBe(true);
  });

  it("allows developer to read own profile only", () => {
    expect(canReadUserProfile("developer", "user-1", "user-1")).toBe(true);
    expect(canReadUserProfile("developer", "user-1", "user-2")).toBe(false);
  });

  it("restricts audit access to admin and auditor", () => {
    expect(canReadAuditEvents("auditor")).toBe(true);
    expect(canReadAuditEvents("developer")).toBe(false);
  });

  it("allows developers to create access requests", () => {
    expect(canCreateAccessRequest("developer")).toBe(true);
    expect(canCreateAccessRequest("readonly")).toBe(false);
  });
});
