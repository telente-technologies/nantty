export interface CursorPage<Item> {
  readonly data: Item[];
  readonly nextCursor: string | null;
}

export interface ApiErrorBody {
  readonly message: string;
  readonly code: string;
  readonly issues?: { readonly path: string; readonly message: string }[];
  readonly details?: Readonly<Record<string, unknown>>;
}
