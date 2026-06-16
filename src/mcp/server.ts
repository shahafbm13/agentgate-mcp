import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AppConfig } from "../config/index.js";
import type { Services } from "../services/index.js";
import { registerTools } from "./tools/index.js";
import { registerResources } from "./resources/index.js";
import { registerPrompts } from "./prompts/index.js";

export function createMcpServer(services: Services, _config: AppConfig): McpServer {
  const server = new McpServer({
    name: "agentgate-mcp",
    version: "1.0.0",
  });

  registerTools(server, services);
  registerResources(server, services);
  registerPrompts(server);

  return server;
}
