export class SupportError extends Error {
  public constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "SupportError";
  }
}

export const unauthorized = () => new SupportError(401, "UNAUTHORIZED", "Sign in to continue.");
export const forbidden = (message = "You do not have permission to do this.") => new SupportError(403, "FORBIDDEN", message);
export const badRequest = (code: string, message: string) => new SupportError(400, code, message);
export const notFound = (what: string) => new SupportError(404, "NOT_FOUND", `${what} not found.`);
export const conflict = (code: string, message: string) => new SupportError(409, code, message);

export class PoisonEventError extends Error {}
