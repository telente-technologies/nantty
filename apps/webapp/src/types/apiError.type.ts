export interface ApiErrorBody {
  readonly message: string;
  readonly code?: string;
  readonly issues?: readonly { readonly path?: readonly string[]; readonly message: string }[];
}
