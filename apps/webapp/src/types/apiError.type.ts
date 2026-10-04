export interface ApiErrorBody {
  readonly message: string;
  readonly code?: string;
  readonly suggestions?: readonly string[];
  readonly issues?: readonly { readonly path?: readonly string[]; readonly message: string }[];
}
