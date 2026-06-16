# Bearer Token Transport

MCP HTTP transports require Bearer tokens in the Authorization header.

```
Authorization: Bearer eyJhbGciOiJSUzI1NiIs...
```

## Prohibited

- Query string tokens
- Cookie-based tokens without explicit MCP client support
- Hardcoded tokens in tool implementations

## 401 Handling

Resource servers must return `WWW-Authenticate` header pointing to `/.well-known/oauth-protected-resource` per RFC 9728.
