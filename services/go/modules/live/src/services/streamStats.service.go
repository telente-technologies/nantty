package services

import (
	"context"
	liveerrors "nantty/modules/live/src/errors"
	"nantty/modules/live/src/types"

	"github.com/google/uuid"

	"nantty/modules/live/src/generated/ent"
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
	newSubscribers, err := service.newSubscribersDuring(ctx, session)
	if err != nil {
		return types.StreamStatsView{}, err
	}
	return types.StreamStatsView{
		LiveId: liveId.String(), GiftCount: session.GiftCount, TotalCoins: session.TotalCoins, CreatorCoins: session.CreatorCoins, TopSupporters: board.Data, Battles: battles, NewSubscribers: newSubscribers,
	}, nil
}

func (service *LiveService) newSubscribersDuring(ctx context.Context, session *ent.LiveSession) (int, error) {
	if service.Subscribers == nil || session.StartedAt == nil {
		return 0, nil
	}
	endedAt := service.Now()
	if session.EndedAt != nil {
		endedAt = *session.EndedAt
	}
	return service.Subscribers.CountNewSubscribers(ctx, session.HostID, *session.StartedAt, endedAt)
}
