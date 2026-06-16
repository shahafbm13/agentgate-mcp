import { describe, it, expect } from "vitest";
import { parseScopesFromToken, getRequiredScopesForTool, TOOL_SCOPES } from "../../../src/auth/scopes.js";

describe("scopes", () => {
  it("parses space-delimited scope claim", () => {
    expect(parseScopesFromToken("apps:read audit:read")).toEqual(["apps:read", "audit:read"]);
  });

  it("prefers scopes array over scope string", () => {
    expect(parseScopesFromToken("apps:read", ["docs:read"])).toEqual(["docs:read"]);
  });

  it("returns required scopes for each tool", () => {
    expect(getRequiredScopesForTool("get_user")).toEqual(["users:read"]);
    expect(getRequiredScopesForTool("create_access_request")).toEqual(["access:write"]);
    expect(TOOL_SCOPES).toHaveProperty("check_permission");
  });
});
