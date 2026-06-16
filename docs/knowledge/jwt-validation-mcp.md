# JWT Validation for MCP Resource Servers

JSON Web Tokens (JWTs) are the primary access token format for MCP HTTP transports.

## Required Validation Steps

1. Verify signature using JWKS from the authorization server.
2. Validate `iss` (issuer) matches the configured authorization server.
3. Validate `aud` (audience) matches the MCP server resource URI (RFC 8707).
4. Check `exp` and `nbf` for token lifetime.
5. Extract scopes from `scope` claim (space-delimited) or custom `scopes` array.

## Security Notes

- Never log raw tokens.
- Validate on every request; do not cache validation results across requests in production without short TTL.
- Reject tokens passed in query strings; use Authorization header only.
