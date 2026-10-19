import type { FollowRequest, Page } from "@/types";

export const removeFollowRequestFromPage = (page: Page<FollowRequest> | undefined, requestId: string): Page<FollowRequest> | undefined =>
  page ? { ...page, data: page.data.filter((request) => request.id !== requestId) } : page;

export function followRequestQueriesToRefresh(notification: { readonly kind?: string; readonly actor?: { readonly id: string } | null }): readonly (readonly unknown[])[] {
  if (notification.kind === "followRequest") return [["followRequests"]];
  if (notification.kind !== "followRequestAccepted" || !notification.actor) return [];
  const ownerId = notification.actor.id;
  return [["followStatus", ownerId], ["profile", ownerId], ["profile", "posts", ownerId], ["profile", "clips", ownerId], ["users", ownerId]];
}
