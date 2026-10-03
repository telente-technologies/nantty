export class ApiError extends Error {
  public constructor(public readonly status: number, public readonly code: string, message: string, public readonly issues?: readonly { readonly path: string; readonly message: string }[]) {
    super(message);
  }
}

export class MissingEventFieldError extends Error {
  public constructor(public readonly fieldPath: string) {
    super(`Event data is missing ${fieldPath}.`);
  }
}

export const notFoundError = (message = "Not found.") => new ApiError(404, "NOT_FOUND", message);
export const unauthorizedError = () => new ApiError(401, "UNAUTHORIZED", "Sign in to continue.");
export const forbiddenError = () => new ApiError(403, "FORBIDDEN", "You do not have permission to do this.");
export const validationError = (message: string, issues?: readonly { readonly path: string; readonly message: string }[]) => new ApiError(400, "VALIDATION_FAILED", message, issues);
