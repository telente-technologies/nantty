import { act, renderHook } from "@testing-library/react-native";

import { ApiError } from "@/errors/api.error";

import {
  isCommentsCursorExpiredError,
  keepOnlyFirstCommentsPage,
  retryCommentsPageUnlessCursorExpired,
  useRestartCommentsOnExpiredCursor,
} from "../useRestartCommentsOnExpiredCursor.hook";

const mockShowToast = jest.fn();
const mockClient = {
  getQueryData: jest.fn(),
  setQueryData: jest.fn(),
  refetchQueries: jest.fn(async () => undefined),
  resetQueries: jest.fn(async () => undefined),
};
jest.mock("@/store/toast.store", () => ({ showToast: (message: string) => mockShowToast(message) }));
jest.mock("@tanstack/react-query", () => ({ useQueryClient: () => mockClient }));

const expired = () => new ApiError(400, "This list changed. Refresh to see the latest comments.", "CURSOR_EXPIRED");
const queryKey = ["post-thread", "post-1", "relevant"];

describe("useRestartCommentsOnExpiredCursor", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockClient.getQueryData.mockReturnValue({ pages: ["page-1", "page-2"], pageParams: [undefined, "cursor-a"] });
  });

  it("recognises only a 400 CURSOR_EXPIRED as an expired comments cursor", () => {
    expect(isCommentsCursorExpiredError(expired())).toBe(true);
    expect(isCommentsCursorExpiredError(new ApiError(400, "Bad", "VALIDATION_FAILED"))).toBe(false);
    expect(isCommentsCursorExpiredError(new ApiError(500, "Down", "CURSOR_EXPIRED"))).toBe(false);
    expect(isCommentsCursorExpiredError(new Error("CURSOR_EXPIRED"))).toBe(false);
  });

  it("never retries an expired cursor but still retries other failures once", () => {
    expect(retryCommentsPageUnlessCursorExpired(0, expired())).toBe(false);
    expect(retryCommentsPageUnlessCursorExpired(0, new ApiError(503, "Down"))).toBe(true);
    expect(retryCommentsPageUnlessCursorExpired(1, new ApiError(503, "Down"))).toBe(false);
  });

  it("keeps only the first page so a refetch starts from the top", () => {
    expect(keepOnlyFirstCommentsPage({ pages: [1, 2, 3], pageParams: [undefined, "a", "b"] })).toEqual({ pages: [1], pageParams: [undefined] });
    expect(keepOnlyFirstCommentsPage(undefined)).toBeUndefined();
  });

  it("does nothing for other errors", async () => {
    const onRestarted = jest.fn();
    const { result } = await renderHook(() => useRestartCommentsOnExpiredCursor(queryKey, new ApiError(503, "Down"), onRestarted));
    expect(result.current.isRestartingFromTop).toBe(false);
    expect(mockClient.refetchQueries).not.toHaveBeenCalled();
    expect(onRestarted).not.toHaveBeenCalled();
  });

  it("refetches from the first page once, scrolls to the top and says the comments were updated", async () => {
    const onRestarted = jest.fn();
    const { result, rerender } = await renderHook(({ error }: { error: unknown }) => useRestartCommentsOnExpiredCursor(queryKey, error, onRestarted), {
      initialProps: { error: expired() as unknown },
    });
    await act(async () => undefined);
    expect(mockClient.setQueryData).toHaveBeenCalledWith(queryKey, { pages: ["page-1"], pageParams: [undefined] });
    expect(mockClient.refetchQueries).toHaveBeenCalledWith({ queryKey, exact: true }, { throwOnError: true });
    expect(onRestarted).toHaveBeenCalledTimes(1);
    expect(mockShowToast).toHaveBeenCalledWith("Comments updated");
    expect(result.current.isRestartingFromTop).toBe(false);

    await rerender({ error: null });
    await rerender({ error: expired() });
    await act(async () => undefined);
    expect(mockClient.refetchQueries).toHaveBeenCalledTimes(1);
    expect(onRestarted).toHaveBeenCalledTimes(1);
    expect(mockShowToast).toHaveBeenCalledTimes(1);
  });

  it("stays quiet when the restart itself fails so the normal error shows", async () => {
    mockClient.refetchQueries.mockRejectedValueOnce(new ApiError(503, "Down"));
    await renderHook(() => useRestartCommentsOnExpiredCursor(queryKey, expired()));
    await act(async () => undefined);
    expect(mockShowToast).not.toHaveBeenCalled();
  });

  it("resets the query when nothing was cached yet", async () => {
    mockClient.getQueryData.mockReturnValue(undefined);
    await renderHook(() => useRestartCommentsOnExpiredCursor(queryKey, expired()));
    await act(async () => undefined);
    expect(mockClient.resetQueries).toHaveBeenCalledWith({ queryKey, exact: true }, { throwOnError: true });
  });
});
