export interface ApiValidationIssue {
  readonly path: string;
  readonly message: string;
}

export interface ApiErrorBody {
  readonly message: string;
  readonly code: string;
  readonly issues?: readonly ApiValidationIssue[];
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface Page<Item> {
  readonly items: readonly Item[];
  readonly nextCursor: string | null;
  readonly total: number;
}
