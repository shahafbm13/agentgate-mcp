# Agentic Identity Overview

Agentic identity extends traditional IAM to AI agents acting on behalf of users.

## Key Concepts

- **Resource Server**: MCP server validating tokens (AgentGate).
- **Authorization Server**: Issues scoped tokens (mock auth server in demo; production OAuth 2.1 / OIDC provider in real deployments).
- **Tool-level scopes**: Fine-grained permissions per MCP tool.
- **Connections**: Secure storage for downstream API credentials (notification API key pattern in demo).

## Production Considerations

A production deployment would add full OAuth 2.1 (PKCE, DCR/CIMD, consent flows) and centralized policy enforcement. This portfolio project implements a simplified subset for learning purposes.
