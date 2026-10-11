export interface ApiResponse<T> {
  readonly data: T;
  readonly status: number;
  readonly message?: string;
}

export interface PaginatedResponse<T> {
  readonly data: readonly T[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
}
export * from "./posts.contract";
export * from "./feeds.contract";
export * from "./follows.contract";
export * from "./widgets.contract";
