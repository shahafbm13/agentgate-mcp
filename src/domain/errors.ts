export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(
      id ? `${resource} not found: ${id}` : `${resource} not found`,
      "NOT_FOUND",
      404,
    );
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super(message, "FORBIDDEN", 403);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(message, "UNAUTHORIZED", 401);
  }
}

export class InsufficientScopeError extends AppError {
  constructor(
    public readonly requiredScopes: string[],
    public readonly tokenScopes: string[],
    public readonly missingScopes: string[],
  ) {
    super(
      `Insufficient scope. Required: ${requiredScopes.join(", ")}`,
      "insufficient_scope",
      403,
      {
        error: "insufficient_scope",
        scope: [...new Set([...tokenScopes, ...requiredScopes])].join(" "),
        error_description: `Missing scopes: ${missingScopes.join(", ")}`,
        missing_scopes: missingScopes,
        token_scopes: tokenScopes,
        required_scopes: requiredScopes,
      },
    );
  }

  toMcpErrorJson(): Record<string, unknown> {
    return {
      error: "insufficient_scope",
      scope: this.details?.scope,
      error_description: this.details?.error_description,
      missing_scopes: this.missingScopes,
      token_scopes: this.tokenScopes,
      required_scopes: this.requiredScopes,
    };
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "VALIDATION_ERROR", 400, details);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, "CONFLICT", 409);
  }
}
