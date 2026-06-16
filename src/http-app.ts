import express, { type Request, type Response, type NextFunction } from "express";
import rateLimit from "express-rate-limit";
import { randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AppConfig } from "./config/index.js";
import type { Logger } from "./infra/logger.js";
import { validateToken } from "./auth/jwt-validator.js";
import { authStorage, extractBearerToken } from "./auth/context.js";
import { buildProtectedResourceMetadata, buildWwwAuthenticateHeader } from "./auth/protected-resource-metadata.js";
import { UnauthorizedError } from "./domain/errors.js";
import { createMcpServer } from "./mcp/server.js";
import type { Services } from "./services/index.js";
import { pingDb } from "./db/client.js";

interface SessionEntry {
  transport: StreamableHTTPServerTransport;
  server: McpServer;
}

export function createHttpApp(config: AppConfig, services: Services, logger: Logger) {
  const app = createMcpExpressApp({ host: "0.0.0.0" });
  const sessions = new Map<string, SessionEntry>();

  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "agentgate-mcp" });
  });

  app.get("/ready", async (_req, res) => {
    const dbOk = await pingDb(config.DATABASE_URL);
    if (!dbOk) {
      res.status(503).json({ status: "not_ready", database: false });
      return;
    }
    res.json({ status: "ready", database: true });
  });

  app.get("/.well-known/oauth-protected-resource", (_req, res) => {
    res.json(buildProtectedResourceMetadata(config));
  });

  const mcpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "rate_limit_exceeded", message: "Too many MCP requests" },
  });

  async function authMiddleware(req: Request, res: Response, next: NextFunction) {
    try {
      const token = extractBearerToken(req.headers.authorization);
      const auth = await validateToken(token ?? "", config);
      (req as Request & { authContext?: typeof auth }).authContext = auth;
      next();
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        res.setHeader("WWW-Authenticate", buildWwwAuthenticateHeader(config));
        res.status(401).json({ error: "unauthorized", message: err.message });
        return;
      }
      next(err);
    }
  }

  app.post("/mcp", mcpLimiter, authMiddleware, async (req, res) => {
    const auth = (req as Request & { authContext?: Awaited<ReturnType<typeof validateToken>> }).authContext;
    if (!auth) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }

    const sessionIdHeader = req.headers["mcp-session-id"];
    const sessionId = typeof sessionIdHeader === "string" ? sessionIdHeader : undefined;

    await authStorage.run(auth, async () => {
      try {
        if (sessionId && sessions.has(sessionId)) {
          const { transport } = sessions.get(sessionId)!;
          await transport.handleRequest(req, res, req.body);
          return;
        }

        if (!sessionId && isInitializeRequest(req.body)) {
          const server = createMcpServer(services, config);
          let transport!: StreamableHTTPServerTransport;

          transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            onsessioninitialized: (sid) => {
              sessions.set(sid, { transport, server });
            },
          });

          transport.onclose = () => {
            const sid = transport.sessionId;
            if (sid && sessions.has(sid)) {
              sessions.delete(sid);
            }
          };

          await server.connect(transport);
          await transport.handleRequest(req, res, req.body);
          return;
        }

        res.status(400).json({
          jsonrpc: "2.0",
          error: {
            code: -32000,
            message: "Bad Request: Server not initialized",
          },
          id: null,
        });
      } catch (error) {
        logger.error({ err: error }, "MCP request failed");
        if (!res.headersSent) {
          res.status(500).json({
            jsonrpc: "2.0",
            error: { code: -32603, message: "Internal server error" },
            id: null,
          });
        }
      }
    });
  });

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error({ err }, "Unhandled error");
    if (!res.headersSent) {
      res.status(500).json({ error: "internal_error", message: err.message });
    }
  });

  return app;
}
