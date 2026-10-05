import type { ConnectionEntry } from "@/types/account.type";

export type ConnectionSort = "recent" | "name" | "mutual";
export type ConnectionFilter = "all" | "following" | "followers" | "mutual";

export const CONNECTION_SORT_OPTIONS: readonly { readonly value: ConnectionSort; readonly label: string }[] = [
  { value: "recent", label: "Default (most recent)" },
  { value: "name", label: "Name A–Z" },
  { value: "mutual", label: "Most mutual" },
];

export const CONNECTION_FILTER_OPTIONS: readonly { readonly value: ConnectionFilter; readonly label: string }[] = [
  { value: "all", label: "Everyone" },
  { value: "following", label: "People you follow" },
  { value: "followers", label: "People who follow you" },
  { value: "mutual", label: "Mutual" },
];

const iFollow = (entry: ConnectionEntry) => entry.isFollowing || entry.followState === "accepted";

const keepForFilter = (entry: ConnectionEntry, filter: ConnectionFilter) => {
  if (filter === "following") return iFollow(entry);
  if (filter === "followers") return !!entry.followsYou;
  if (filter === "mutual") return iFollow(entry) && !!entry.followsYou;
  return true;
};

export function sortAndFilterConnections(entries: readonly ConnectionEntry[], sort: ConnectionSort, filter: ConnectionFilter): ConnectionEntry[] {
  const kept = entries.filter((entry) => keepForFilter(entry, filter));
  if (sort === "name") return [...kept].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  if (sort === "mutual") return [...kept].sort((a, b) => (b.mutualConnections ?? 0) - (a.mutualConnections ?? 0));
  return kept;
}

export const connectionSortLabel = (sort: ConnectionSort) => CONNECTION_SORT_OPTIONS.find((option) => option.value === sort)?.label ?? "Default";
