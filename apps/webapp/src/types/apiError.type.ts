export interface ApiErrorBody {
  readonly message: string;
  readonly code?: string;
  readonly suggestions?: readonly string[];
  readonly details?: Readonly<Record<string, unknown>>;
  readonly issues?: readonly { readonly path?: readonly string[]; readonly message: string }[];
}
