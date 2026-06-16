import { loadEnv } from "../scripts/load-env.js";

loadEnv();

import "./infra/webcrypto-polyfill.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config/index.js";
import { createLogger } from "./infra/logger.js";
import { createServices } from "./services/index.js";
import { createMcpServer } from "./mcp/server.js";
import { createHttpApp } from "./http-app.js";
import { validateToken } from "./auth/jwt-validator.js";
import { setStdioAuthContext } from "./auth/context.js";
import { closeDb } from "./db/client.js";

async function startStdio(config: ReturnType<typeof loadConfig>, logger: ReturnType<typeof createLogger>) {
  const token = config.AGENTGATE_ACCESS_TOKEN;
  if (!token) {
    throw new Error("AGENTGATE_ACCESS_TOKEN is required for stdio transport");
  }

  const auth = await validateToken(token, config);
  setStdioAuthContext(auth);
  const services = createServices(config, logger);
  const server = createMcpServer(services, config);
  const transport = new StdioServerTransport();

  await server.connect(transport);

  logger.info("AgentGate MCP server running on stdio transport");
}

async function startHttp(config: ReturnType<typeof loadConfig>, logger: ReturnType<typeof createLogger>) {
  const services = createServices(config, logger);
  const app = createHttpApp(config, services, logger);

  app.listen(config.PORT, () => {
    logger.info({ port: config.PORT }, "AgentGate MCP server running on HTTP transport");
  });
}

async function main() {
  const config = loadConfig();
  const logger = createLogger(config);

  if (config.TRANSPORT === "stdio") {
    await startStdio(config, logger);
  } else {
    await startHttp(config, logger);
  }
}

process.on("SIGINT", async () => {
  await closeDb();
  process.exit(0);
});

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
