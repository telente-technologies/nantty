import type { Page } from "@/types";

import { sendRequestToWebappServer } from "./clientApi.service";

export type RankingBoard = "streamer" | "supporter" | "creator";
export type RankingScope = "global" | "country" | "category";

export interface RankingEntry {
  readonly rank: number;
  readonly user: import("@/types").UserSummary;
  readonly points: number;
}

export interface RankingQuery {
  readonly board: RankingBoard;
  readonly scope: RankingScope;
  readonly countryCode?: string;
  readonly categoryId?: string;
  readonly period?: "day" | "week" | "month" | "all";
}

export const rankingsService = {
  fetchRankings: (query: RankingQuery, cursor?: string) =>
    sendRequestToWebappServer<Page<RankingEntry>>("/api/v1/rankings", {
      query: { board: query.board, scope: query.scope, countryCode: query.countryCode, categoryId: query.categoryId, period: query.period ?? "week", cursor },
    }),
};
