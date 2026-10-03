package application

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/live/internal/ent"
)

type MoneyView struct {
	AmountMinor int64  `json:"amountMinor"`
	Currency    string `json:"currency"`
}

type StreamStatsView struct {
	LiveId            string                 `json:"liveId"`
	GiftCount         int64                  `json:"giftCount"`
	TotalCoins        int64                  `json:"totalCoins"`
	CreatorCoins      int64                  `json:"creatorCoins"`
	EstimatedEarnings *MoneyView             `json:"estimatedEarnings"`
	TopSupporters     []LeaderboardEntryView `json:"topSupporters"`
}

func (application *LiveApplication) GetLiveGiftStreamStats(ctx context.Context, actor Actor, liveId uuid.UUID) (StreamStatsView, error) {
	session, err := application.Client.LiveSession.Get(ctx, liveId)
	if ent.IsNotFound(err) {
		return StreamStatsView{}, errLiveNotFound
	}
	if err != nil {
		return StreamStatsView{}, err
	}
	if session.HostID != actor.UserId {
		return StreamStatsView{}, errNotLiveHost
	}
	board, err := application.GetLiveLeaderboard(ctx, liveId, actor.UserId, nil, 5)
	if err != nil {
		return StreamStatsView{}, err
	}
	return StreamStatsView{
		LiveId: liveId.String(), GiftCount: session.GiftCount, TotalCoins: session.TotalCoins, CreatorCoins: session.CreatorCoins, TopSupporters: board.Data,
	}, nil
}
