package services

import (
	"context"
	"zudomart/modules/live/src/types"

	"github.com/google/uuid"

	"zudomart/modules/live/src/generated/ent"
)

const hostRankingPeriod = "week"

func rankPosition(totals []rankedTotal, userId uuid.UUID) int {
	for index, row := range totals {
		if row.UserID == userId {
			return index + 1
		}
	}
	return 0
}

func (service *LiveService) streamerRankOf(ctx context.Context, userId uuid.UUID, scope string, categoryId string) (int, error) {
	totals, err := service.rankedTotals(ctx, types.RankingQuery{Board: "streamer", Scope: scope, CategoryId: categoryId, Period: hostRankingPeriod})
	if err != nil {
		return 0, err
	}
	return rankPosition(totals, userId), nil
}

func (service *LiveService) hostRankingFor(ctx context.Context, session *ent.LiveSession) *types.HostRankingView {
	globalRank, err := service.streamerRankOf(ctx, session.HostID, "global", "")
	if err != nil {
		service.Logger.WarnContext(ctx, "host ranking unavailable", "error", err)
		return nil
	}
	if globalRank == 0 {
		return nil
	}
	view := &types.HostRankingView{GlobalRank: globalRank, Period: hostRankingPeriod}
	category := string(session.Category)
	if category == "" {
		return view
	}
	categoryRank, err := service.streamerRankOf(ctx, session.HostID, "category", category)
	if err != nil {
		service.Logger.WarnContext(ctx, "host category ranking unavailable", "error", err)
		return view
	}
	if categoryRank > 0 {
		view.CategoryRank = &categoryRank
		view.Category = &category
	}
	return view
}
