import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url().or(z.string().startsWith("postgresql://")),
  PORT: z.coerce.number().default(3000),
  TRANSPORT: z.enum(["http", "stdio"]).default("http"),
  MCP_RESOURCE_URI: z.string().url().default("http://localhost:3000/mcp"),
  BASE_URL: z.string().url().default("http://localhost:3000"),
  JWT_ISSUER: z.string().url().default("http://localhost:9000"),
  JWT_AUDIENCE: z.string().default("http://localhost:3000/mcp"),
  JWKS_URI: z.string().url().default("http://localhost:9000/.well-known/jwks.json"),
  AUTH_SERVER_URL: z.string().url().default("http://localhost:9000"),
  AGENTGATE_ACCESS_TOKEN: z.string().optional(),
  NOTIFICATION_API_URL: z.string().url().default("http://localhost:9001"),
  NOTIFICATION_API_KEY: z.string().default("dev-notification-key"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
});

export type AppConfig = z.infer<typeof envSchema>;

let cachedConfig: AppConfig | null = null;

export function loadConfig(overrides?: Partial<Record<string, string>>): AppConfig {
  if (cachedConfig && !overrides) return cachedConfig;

  const env = { ...process.env, ...overrides };
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Invalid configuration: ${parsed.error.message}`);
  }
  cachedConfig = parsed.data;
  return parsed.data;
}

export function resetConfigCache(): void {
  cachedConfig = null;
}
