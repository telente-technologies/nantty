package services

import (
	"context"
	liveerrors "zudomart/modules/live/src/errors"
	"zudomart/modules/live/src/types"

	"github.com/google/uuid"

	"zudomart/modules/live/src/generated/ent"
)

func (service *LiveService) GetLiveGiftStreamStats(ctx context.Context, actor types.Actor, liveId uuid.UUID) (types.StreamStatsView, error) {
	session, err := service.Client.LiveSession.Get(ctx, liveId)
	if ent.IsNotFound(err) {
		return types.StreamStatsView{}, liveerrors.LiveNotFound
	}
	if err != nil {
		return types.StreamStatsView{}, err
	}
	if session.HostID != actor.UserId {
		return types.StreamStatsView{}, liveerrors.NotLiveHost
	}
	board, err := service.GetLiveLeaderboard(ctx, liveId, actor.UserId, nil, 5)
	if err != nil {
		return types.StreamStatsView{}, err
	}
	battles, err := service.hostBattleResults(ctx, liveId, session.HostID)
	if err != nil {
		return types.StreamStatsView{}, err
	}
	return types.StreamStatsView{
		LiveId: liveId.String(), GiftCount: session.GiftCount, TotalCoins: session.TotalCoins, CreatorCoins: session.CreatorCoins, TopSupporters: board.Data, Battles: battles,
	}, nil
}
