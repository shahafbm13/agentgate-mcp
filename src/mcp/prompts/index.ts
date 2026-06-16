import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerPrompts(server: McpServer): void {
  server.registerPrompt(
    "access_review",
    {
      description: "Structured workflow for reviewing whether a user can access an application",
      argsSchema: {
        userId: z.string().describe("User UUID to review"),
        applicationId: z.string().describe("Application UUID to review"),
      },
    },
    async ({ userId, applicationId }) => {
      return {
        messages: [{
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `# Access Review Workflow

Review whether user \`${userId}\` should have access to application \`${applicationId}\`.

## Steps
1. Call \`get_user\` with userId to understand the user's role and department.
2. Call \`list_applications\` or read resource \`app://${applicationId}/metadata\` for app sensitivity.
3. Call \`check_permission\` with userId, applicationId, and action "read".
4. Read resource \`policy://${applicationId}\` to inspect existing policies.
5. If access is denied and justified, call \`create_access_request\` with a clear reason.

## Output
Provide a concise recommendation: ALLOW, DENY, or REQUEST_ACCESS with rationale citing policy and sensitivity level.`,
          },
        }],
      };
    },
  );
}
