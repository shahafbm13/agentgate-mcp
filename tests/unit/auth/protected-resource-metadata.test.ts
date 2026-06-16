import { describe, it, expect } from "vitest";
import { buildProtectedResourceMetadata, buildWwwAuthenticateHeader } from "../../../src/auth/protected-resource-metadata.js";
import { loadConfig, resetConfigCache } from "../../../src/config/index.js";

describe("protected resource metadata", () => {
  it("builds RFC 9728 metadata document", () => {
    resetConfigCache();
    const config = loadConfig({
      DATABASE_URL: "postgresql://agentgate:agentgate@localhost:5432/agentgate",
      BASE_URL: "http://localhost:3000",
      MCP_RESOURCE_URI: "http://localhost:3000/mcp",
      AUTH_SERVER_URL: "http://localhost:9000",
    });
    const metadata = buildProtectedResourceMetadata(config);
    expect(metadata.resource).toBe("http://localhost:3000/mcp");
    expect(metadata.authorization_servers).toContain("http://localhost:9000");
    expect(metadata.scopes_supported).toContain("apps:read");
    expect(metadata.bearer_methods_supported).toEqual(["header"]);
  });

  it("builds WWW-Authenticate header", () => {
    resetConfigCache();
    const config = loadConfig({
      DATABASE_URL: "postgresql://agentgate:agentgate@localhost:5432/agentgate",
      BASE_URL: "http://localhost:3000",
    });
    const header = buildWwwAuthenticateHeader(config);
    expect(header).toContain("Bearer");
    expect(header).toContain("oauth-protected-resource");
  });
});
