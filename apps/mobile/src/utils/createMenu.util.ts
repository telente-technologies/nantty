import type { CreateMode } from "@/types";

const everyoneModes: readonly CreateMode[] = ["story", "post", "clip"];

export function listCreateModesForViewer(isApprovedSeller: boolean, isApprovedCreator: boolean): readonly CreateMode[] {
  return [...everyoneModes, ...(isApprovedSeller ? (["product"] as const) : []), ...(isApprovedCreator ? (["live", "space"] as const) : [])];
}
