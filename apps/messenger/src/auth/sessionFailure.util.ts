import { ApiError } from "../api/apiError";

export function isTerminalSessionFailure(error: unknown): error is ApiError {
  return error instanceof ApiError && (error.status === 401 || error.status === 403);
}
