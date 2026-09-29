import { createHttpError, type HttpError } from "@zudojs/errors";
import { schema, type Infer } from "@zudojs/schema";

export const ADMIN_MAX_PAGE_SIZE = 200;
export const ADMIN_DEFAULT_PAGE_SIZE = 25;

export const AdminPageQuerySchema = schema.object({
  page: schema.coerce.number().int().min(1).max(100_000).optional(),
  pageSize: schema.coerce.number().int().min(1).max(ADMIN_MAX_PAGE_SIZE).optional(),
});

export const AdminReasonSchema = schema.string().min(5).max(1000);

export const AdminReasonBodySchema = schema.object({ reason: AdminReasonSchema });

export interface NumberedPageRequest {
  readonly page: number;
  readonly pageSize: number;
}

export interface NumberedPage<T> {
  readonly items: readonly T[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}

export function readNumberedPageRequest(query: Infer<typeof AdminPageQuerySchema>): NumberedPageRequest {
  return { page: query.page ?? 1, pageSize: query.pageSize ?? ADMIN_DEFAULT_PAGE_SIZE };
}

export function sliceNumberedPage<T>(sorted: readonly T[], request: NumberedPageRequest): NumberedPage<T> {
  const start = (request.page - 1) * request.pageSize;
  return { items: sorted.slice(start, start + request.pageSize), page: request.page, pageSize: request.pageSize, total: sorted.length };
}

export function mapNumberedPage<T, U>(page: NumberedPage<T>, convert: (item: T) => U): NumberedPage<U> {
  return { ...page, items: page.items.map(convert) };
}

export function adminError(status: number, code: string, message: string, details?: Readonly<Record<string, unknown>>): HttpError {
  const error = createHttpError(message, status, { code, expose: true });
  if (details !== undefined) Object.assign(error, { responseDetails: details });
  return error;
}

export function textMatchesSearch(search: string | undefined, ...values: readonly (string | null | undefined)[]): boolean {
  if (search === undefined || search.trim() === "") return true;
  const needle = search.trim().toLowerCase();
  return values.some((value) => value !== null && value !== undefined && value.toLowerCase().includes(needle));
}
