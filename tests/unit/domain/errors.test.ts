import { describe, it, expect } from "vitest";
import { InsufficientScopeError } from "../../../src/domain/errors.js";

describe("InsufficientScopeError", () => {
  it("produces MCP-spec-shaped JSON", () => {
    const err = new InsufficientScopeError(
      ["audit:read"],
      ["apps:read"],
      ["audit:read"],
    );
    const json = err.toMcpErrorJson();
    expect(json.error).toBe("insufficient_scope");
    expect(json.missing_scopes).toEqual(["audit:read"]);
    expect(json.required_scopes).toEqual(["audit:read"]);
  });
});
