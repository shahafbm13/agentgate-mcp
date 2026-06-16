import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { requireAuthContext } from "../../auth/context.js";
import { requireScopes } from "../../auth/jwt-validator.js";
import { getRequiredScopesForTool } from "../../auth/scopes.js";
import {
  GetUserInputSchema,
  ListApplicationsInputSchema,
  GetAuditEventsInputSchema,
  CreateAccessRequestInputSchema,
  CheckPermissionInputSchema,
  SearchDocumentationInputSchema,
} from "../../domain/schemas.js";
import { canReadAuditEvents } from "../../auth/rbac.js";
import { ForbiddenError } from "../../domain/errors.js";
import type { Services } from "../../services/index.js";
import { toolErrorResult, toolSuccessResult } from "../utils.js";

export function registerTools(server: McpServer, services: Services): void {
  server.registerTool(
    "get_user",
    {
      description: "Get user profile by ID or email. Developers can read self; admin/auditor can read any.",
      inputSchema: {
        userId: z.string().uuid().optional().describe("User UUID"),
        email: z.string().email().optional().describe("User email"),
      },
    },
    async (args) => {
      try {
        const auth = requireAuthContext();
        requireScopes(auth, getRequiredScopesForTool("get_user"));
        const input = GetUserInputSchema.parse(args);
        const result = await services.users.getUser(auth, input);
        return toolSuccessResult(result);
      } catch (err) {
        return toolErrorResult(err);
      }
    },
  );

  server.registerTool(
    "list_applications",
    {
      description: "List registered internal applications, optionally filtered by sensitivity.",
      inputSchema: {
        sensitivity: z.enum(["public", "internal", "confidential", "restricted"]).optional(),
        limit: z.number().int().min(1).max(100).default(20),
      },
    },
    async (args) => {
      try {
        const auth = requireAuthContext();
        requireScopes(auth, getRequiredScopesForTool("list_applications"));
        const input = ListApplicationsInputSchema.parse(args ?? {});
        const result = await services.applications.listApplications(input);
        return toolSuccessResult({ applications: result, count: result.length });
      } catch (err) {
        return toolErrorResult(err);
      }
    },
  );

  server.registerTool(
    "get_audit_events",
    {
      description: "Retrieve recent audit events. Restricted to admin and auditor roles.",
      inputSchema: {
        limit: z.number().int().min(1).max(100).default(20),
        action: z.string().optional(),
        resourceType: z.string().optional(),
      },
    },
    async (args) => {
      try {
        const auth = requireAuthContext();
        requireScopes(auth, getRequiredScopesForTool("get_audit_events"));
        const role = auth.roles[0] ?? "readonly";
        if (!canReadAuditEvents(role)) {
          throw new ForbiddenError("Only admin and auditor roles can read audit events");
        }
        const input = GetAuditEventsInputSchema.parse(args ?? {});
        const events = await services.audit.getRecentEvents(input);
        return toolSuccessResult({ events, count: events.length });
      } catch (err) {
        return toolErrorResult(err);
      }
    },
  );

  server.registerTool(
    "create_access_request",
    {
      description: "Request temporary access to an application. Creates audit trail and notifies approvers.",
      inputSchema: {
        applicationId: z.string().uuid(),
        requestedPermission: z.enum(["read", "write", "admin"]).default("read"),
        reason: z.string().min(10).max(500),
        durationHours: z.number().int().min(1).max(168).default(24),
      },
    },
    async (args) => {
      try {
        const auth = requireAuthContext();
        requireScopes(auth, getRequiredScopesForTool("create_access_request"));
        const input = CreateAccessRequestInputSchema.parse(args);
        const result = await services.accessRequests.createRequest(auth, input);
        return toolSuccessResult(result);
      } catch (err) {
        return toolErrorResult(err);
      }
    },
  );

  server.registerTool(
    "check_permission",
    {
      description: "Check whether a user has permission to perform an action on an application.",
      inputSchema: {
        userId: z.string().uuid(),
        applicationId: z.string().uuid(),
        action: z.enum(["read", "write", "admin"]).default("read"),
      },
    },
    async (args) => {
      try {
        const auth = requireAuthContext();
        requireScopes(auth, getRequiredScopesForTool("check_permission"));
        const input = CheckPermissionInputSchema.parse(args);
        const result = await services.permissions.checkPermission(input);
        return toolSuccessResult(result);
      } catch (err) {
        return toolErrorResult(err);
      }
    },
  );

  server.registerTool(
    "search_identity_documentation",
    {
      description: "Search internal identity and security documentation using full-text search.",
      inputSchema: {
        query: z.string().min(2).max(200),
        limit: z.number().int().min(1).max(10).default(5),
      },
    },
    async (args) => {
      try {
        const auth = requireAuthContext();
        requireScopes(auth, getRequiredScopesForTool("search_identity_documentation"));
        const input = SearchDocumentationInputSchema.parse(args);
        const result = await services.documentation.search(input);
        return toolSuccessResult(result);
      } catch (err) {
        return toolErrorResult(err);
      }
    },
  );
}
