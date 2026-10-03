export interface Page<T> {
  readonly data: readonly T[];
  readonly nextCursor: string | null;
}
