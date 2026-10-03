export class MediaError extends Error {
  public constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
    this.name = "MediaError";
  }
}

export const notFound = (code: string, message: string) => new MediaError(404, code, message);
export const forbidden = (code: string, message: string) => new MediaError(403, code, message);
export const conflict = (code: string, message: string) => new MediaError(409, code, message);
export const unprocessable = (code: string, message: string, details?: Readonly<Record<string, unknown>>) => new MediaError(422, code, message, details);
export const badRequest = (code: string, message: string) => new MediaError(400, code, message);
export const unauthorized = () => new MediaError(401, "UNAUTHORIZED", "Sign in to continue.");
export const unsupportedMediaType = (message: string) => new MediaError(415, "UNSUPPORTED_MEDIA_TYPE", message);
export const payloadTooLarge = (message: string, maximumBytes: number) => new MediaError(413, "FILE_TOO_LARGE", message, { maximumBytes });
export const tooManyRequests = (code: string, message: string) => new MediaError(429, code, message);

export class ProcessorUnavailableError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ProcessorUnavailableError";
  }
}

export class MediaRejectedError extends Error {
  public constructor(public readonly reason: string, message: string = reason) {
    super(message);
    this.name = "MediaRejectedError";
  }
}
