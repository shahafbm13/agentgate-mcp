import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { requireAuthContext } from "../../auth/context.js";
import { requireScopes } from "../../auth/jwt-validator.js";
import { getRequiredScopesForResource } from "../../auth/scopes.js";
import { canReadAuditEvents } from "../../auth/rbac.js";
import { ForbiddenError } from "../../domain/errors.js";
import type { Services } from "../../services/index.js";

function jsonResource(uri: string, data: unknown) {
  return {
    contents: [{
      uri,
      mimeType: "application/json",
      text: JSON.stringify(data, null, 2),
    }],
  };
}

function singleVariable(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

export function registerResources(server: McpServer, services: Services): void {
  server.registerResource(
    "application-metadata",
    new ResourceTemplate("app://{applicationId}/metadata", { list: undefined }),
    { description: "Metadata for a registered application", mimeType: "application/json" },
    async (uri, variables) => {
      const auth = requireAuthContext();
      requireScopes(auth, getRequiredScopesForResource("app://"));
      const data = await services.applications.getMetadata(singleVariable(variables.applicationId));
      return jsonResource(uri.href, data);
    },
  );

  server.registerResource(
    "user-profile",
    new ResourceTemplate("user://{userId}/profile", { list: undefined }),
    { description: "Profile data for a platform user", mimeType: "application/json" },
    async (uri, variables) => {
      const auth = requireAuthContext();
      requireScopes(auth, getRequiredScopesForResource("user://"));
      const data = await services.users.getUser(auth, { userId: singleVariable(variables.userId) });
      return jsonResource(uri.href, data);
    },
  );

  server.registerResource(
    "access-policies",
    new ResourceTemplate("policy://{applicationId}", { list: undefined }),
    { description: "Access policies for an application", mimeType: "application/json" },
    async (uri, variables) => {
      const auth = requireAuthContext();
      requireScopes(auth, getRequiredScopesForResource("policy://"));
      const data = await services.permissions.getPoliciesForApp(singleVariable(variables.applicationId));
      return jsonResource(uri.href, data);
    },
  );

  server.registerResource(
    "recent-audit-logs",
    "audit://recent",
    { description: "Recent audit log entries (admin/auditor only)", mimeType: "application/json" },
    async (uri) => {
      const auth = requireAuthContext();
      requireScopes(auth, getRequiredScopesForResource("audit://"));
      const role = auth.roles[0] ?? "readonly";
      if (!canReadAuditEvents(role)) {
        throw new ForbiddenError("Only admin and auditor roles can read audit logs");
      }
      const events = await services.audit.getRecentEvents({ limit: 20 });
      return jsonResource(uri.href, { events, count: events.length });
    },
  );

  server.registerResource(
    "documentation-index",
    "docs://index",
    { description: "Index of identity and security documentation articles", mimeType: "application/json" },
    async (uri) => {
      const auth = requireAuthContext();
      requireScopes(auth, getRequiredScopesForResource("docs://"));
      const data = await services.documentation.getIndex();
      return jsonResource(uri.href, data);
    },
  );
}

export function listResourceTemplates(): Array<{ uriTemplate: string; name: string; description: string; mimeType: string }> {
  return [
    { uriTemplate: "app://{applicationId}/metadata", name: "application-metadata", description: "Application metadata", mimeType: "application/json" },
    { uriTemplate: "user://{userId}/profile", name: "user-profile", description: "User profile", mimeType: "application/json" },
    { uriTemplate: "policy://{applicationId}", name: "access-policies", description: "Access policies", mimeType: "application/json" },
    { uriTemplate: "audit://recent", name: "recent-audit-logs", description: "Recent audit logs", mimeType: "application/json" },
    { uriTemplate: "docs://index", name: "documentation-index", description: "Documentation index", mimeType: "application/json" },
  ];
}
