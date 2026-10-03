export class SearchError extends Error {
  public constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "SearchError";
  }
}

export const unauthorized = () => new SearchError(401, "UNAUTHORIZED", "Sign in to continue.");
export const badRequest = (code: string, message: string) => new SearchError(400, code, message);
export const notFound = (code: string, message: string) => new SearchError(404, code, message);

export class PoisonEventError extends Error {}
