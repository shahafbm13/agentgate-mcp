import pino from "pino";
import type { AppConfig } from "../config/index.js";

export function createLogger(config: Pick<AppConfig, "LOG_LEVEL">) {
  return pino({
    level: config.LOG_LEVEL,
    redact: {
      paths: ["req.headers.authorization", "authorization", "token", "access_token"],
      censor: "[REDACTED]",
    },
    formatters: {
      level(label) {
        return { level: label };
      },
    },
  });
}

export type Logger = ReturnType<typeof createLogger>;
