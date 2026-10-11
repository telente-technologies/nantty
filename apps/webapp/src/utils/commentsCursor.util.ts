import type { InfiniteData, QueryClient, QueryKey } from "@tanstack/react-query";

export const COMMENTS_UPDATED_TOAST = "Comments updated";

export const isCommentsCursorExpiredError = (error: unknown): boolean =>
  typeof error === "object" && error !== null && (error as { status?: unknown }).status === 400 && (error as { code?: unknown }).code === "CURSOR_EXPIRED";

export const keepOnlyFirstCommentsPage = <TPage, TParam>(data: InfiniteData<TPage, TParam> | undefined): InfiniteData<TPage, TParam> | undefined =>
  data && data.pages.length > 0 ? { pages: data.pages.slice(0, 1), pageParams: data.pageParams.slice(0, 1) } : data;

export async function restartCommentsListFromTop(queryClient: QueryClient, queryKey: QueryKey): Promise<void> {
  const existing = queryClient.getQueryData<InfiniteData<unknown, unknown>>(queryKey);
  if (!existing) {
    await queryClient.resetQueries({ queryKey, exact: true }, { throwOnError: true });
    return;
  }
  queryClient.setQueryData(queryKey, keepOnlyFirstCommentsPage(existing));
  await queryClient.refetchQueries({ queryKey, exact: true }, { throwOnError: true });
}
