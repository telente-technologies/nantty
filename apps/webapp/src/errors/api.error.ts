export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
    readonly suggestions?: readonly string[],
    readonly details?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
  }
}
