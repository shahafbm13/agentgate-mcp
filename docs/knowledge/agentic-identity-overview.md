# Agentic Identity Overview

Agentic identity extends traditional IAM to AI agents acting on behalf of users.

## Key Concepts

- **Resource Server**: MCP server validating tokens (AgentGate).
- **Authorization Server**: Issues scoped tokens (mock auth server in demo; Descope Agentic Identity Hub in production).
- **Tool-level scopes**: Fine-grained permissions per MCP tool.
- **Connections**: Secure storage for downstream API credentials (notification API key pattern in demo).

## Descope Alignment

Descope's Agentic Identity Hub provides OAuth 2.1, DCR/CIMD, consent flows, and policy enforcement that this portfolio project implements in simplified form for learning purposes.
