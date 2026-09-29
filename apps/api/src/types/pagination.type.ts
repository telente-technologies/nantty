export interface PageRequest {
  readonly limit: number;
  readonly cursor?: string;
}

export interface Page<T> {
  readonly data: readonly T[];
  readonly nextCursor: string | null;
}
