export type ContentLoadFailure = "gone" | "denied" | "failed";

export function classifyContentLoadFailure(error: unknown): ContentLoadFailure {
  const status = (error as { status?: unknown } | null)?.status;
  if (status === 404 || status === 410) return "gone";
  if (status === 401 || status === 403) return "denied";
  return "failed";
}

export const contentLoadFailureCopy: Readonly<Record<"post" | "reply", Readonly<Record<ContentLoadFailure, { readonly title: string; readonly description: string }>>>> = {
  post: {
    gone: { title: "This post is no longer available.", description: "The original post may have been deleted." },
    denied: { title: "You can't view this post.", description: "You don't have permission to see it." },
    failed: { title: "Couldn't load this post.", description: "Check your connection, then try again." },
  },
  reply: {
    gone: { title: "This reply is no longer available.", description: "It may have been deleted." },
    denied: { title: "You can't view this reply.", description: "You don't have permission to see it." },
    failed: { title: "Couldn't load this reply.", description: "Check your connection, then try again." },
  },
};
