export class SocialError extends Error {
  public constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
    this.name = "SocialError";
  }
}

export const notFound = (code: string, message: string) => new SocialError(404, code, message);
export const forbidden = (code: string, message: string) => new SocialError(403, code, message);
export const conflict = (code: string, message: string) => new SocialError(409, code, message);
export const unprocessable = (code: string, message: string, details?: Readonly<Record<string, unknown>>) => new SocialError(422, code, message, details);
export const gone = (code: string, message: string) => new SocialError(410, code, message);
export const badRequest = (code: string, message: string) => new SocialError(400, code, message);
export const unauthorized = () => new SocialError(401, "UNAUTHORIZED", "Sign in to continue.");
export const tooManyRequests = (code: string, message: string) => new SocialError(429, code, message);
export class PoisonEventError extends Error {}
