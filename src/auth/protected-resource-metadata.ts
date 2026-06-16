import type { AppConfig } from "../config/index.js";
import { ALL_SCOPES } from "./scopes.js";

export interface ProtectedResourceMetadata {
  resource: string;
  authorization_servers: string[];
  scopes_supported: string[];
  bearer_methods_supported: string[];
}

export function buildProtectedResourceMetadata(config: AppConfig): ProtectedResourceMetadata {
  return {
    resource: config.MCP_RESOURCE_URI,
    authorization_servers: [config.AUTH_SERVER_URL],
    scopes_supported: ALL_SCOPES,
    bearer_methods_supported: ["header"],
  };
}

export function buildWwwAuthenticateHeader(config: AppConfig): string {
  const metadataUrl = `${config.BASE_URL}/.well-known/oauth-protected-resource`;
  return `Bearer realm="agentgate", resource_metadata="${metadataUrl}"`;
}
