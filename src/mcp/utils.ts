import { AppError, InsufficientScopeError } from "../domain/errors.js";

export function toolErrorResult(error: unknown) {
  if (error instanceof InsufficientScopeError) {
    return {
      content: [{ type: "text" as const, text: JSON.stringify(error.toMcpErrorJson(), null, 2) }],
      isError: true,
    };
  }
  if (error instanceof AppError) {
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          error: error.code,
          message: error.message,
          details: error.details ?? null,
        }, null, 2),
      }],
      isError: true,
    };
  }
  return {
    content: [{
      type: "text" as const,
      text: JSON.stringify({ error: "INTERNAL_ERROR", message: "An unexpected error occurred" }, null, 2),
    }],
    isError: true,
  };
}

export function toolSuccessResult(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}
