package services

import (
	"context"
	liveerrors "nantty/modules/live/src/errors"
	"nantty/modules/live/src/types"
	"sort"

	"github.com/google/uuid"

	"nantty/modules/live/src/generated/ent"
	"nantty/modules/live/src/generated/ent/giftcontribution"
	"nantty/modules/live/src/generated/ent/liveleaderboardentry"
	"nantty/modules/live/src/generated/ent/pointsentry"
)

const liveScopeKey = "live"

type rawStanding struct {
	UserId uuid.UUID
	Coins  int64
	Points int64
}

func (service *LiveService) computeLiveStandings(ctx context.Context, db *ent.Client, liveId uuid.UUID, receiver *uuid.UUID) ([]rawStanding, error) {
	merged := map[uuid.UUID]*rawStanding{}
	standing := func(userId uuid.UUID) *rawStanding {
		if merged[userId] == nil {
			merged[userId] = &rawStanding{UserId: userId}
		}
		return merged[userId]
	}
	contributionQuery := db.GiftContribution.Query().Where(giftcontribution.LiveID(liveId), giftcontribution.ScopeKey(liveScopeKey))
	if receiver != nil {
		contributionQuery = contributionQuery.Where(giftcontribution.ReceiverID(*receiver))
	}
	var coins []struct {
		SenderID uuid.UUID `json:"sender_id"`
		Total    int64     `json:"total"`
	}
	if err := contributionQuery.GroupBy(giftcontribution.FieldSenderID).Aggregate(ent.As(ent.Sum(giftcontribution.FieldCoins), "total")).Scan(ctx, &coins); err != nil {
		return nil, err
	}
	for _, row := range coins {
		standing(row.SenderID).Coins = row.Total
	}
	if receiver != nil {
		for _, row := range merged {
			row.Points = row.Coins
		}
	} else {
		var points []struct {
			UserID uuid.UUID `json:"user_id"`
			Total  int64     `json:"total"`
		}
		err := db.PointsEntry.Query().Where(pointsentry.LiveID(liveId), pointsentry.TypeIn(pointsentry.TypeSupport, pointsentry.TypeEngagement)).
			GroupBy(pointsentry.FieldUserID).Aggregate(ent.As(ent.Sum(pointsentry.FieldAmount), "total")).Scan(ctx, &points)
		if err != nil {
			return nil, err
		}
		for _, row := range points {
			standing(row.UserID).Points = row.Total
		}
	}
	standings := make([]rawStanding, 0, len(merged))
	for _, row := range merged {
		standings = append(standings, *row)
	}
	sort.Slice(standings, func(left, right int) bool {
		if standings[left].Points != standings[right].Points {
			return standings[left].Points > standings[right].Points
		}
		if standings[left].Coins != standings[right].Coins {
			return standings[left].Coins > standings[right].Coins
		}
		return standings[left].UserId.String() < standings[right].UserId.String()
	})
	return standings, nil
}

func (service *LiveService) GetLiveLeaderboard(ctx context.Context, liveId uuid.UUID, viewer uuid.UUID, receiver *uuid.UUID, limit int) (types.LeaderboardView, error) {
	if _, err := service.Client.LiveSession.Get(ctx, liveId); err != nil {
		if ent.IsNotFound(err) {
			return types.LeaderboardView{}, liveerrors.LiveNotFound
		}
		return types.LeaderboardView{}, err
	}
	standings, err := service.loadStoredOrComputedStandings(ctx, liveId, receiver)
	if err != nil {
		return types.LeaderboardView{}, err
	}
	view := types.LeaderboardView{Data: []types.LeaderboardEntryView{}}
	for index, row := range standings {
		if row.UserId == viewer {
			rank := index + 1
			view.ViewerRank, view.ViewerPoints = &rank, row.Points
		}
	}
	if len(standings) > limit {
		standings = standings[:limit]
	}
	identifiers := make([]uuid.UUID, 0, len(standings))
	for _, row := range standings {
		identifiers = append(identifiers, row.UserId)
	}
	participants, err := service.lookupParticipants(ctx, identifiers...)
	if err != nil {
		return types.LeaderboardView{}, err
	}
	for index, row := range standings {
		user := participants[row.UserId]
		view.Data = append(view.Data, types.LeaderboardEntryView{
			Rank: index + 1, Coins: row.Coins, Points: row.Points,
			User: types.LeaderboardUser{Id: user.Id.String(), Name: user.Name, Username: user.Username, AvatarUrl: user.AvatarUrl},
		})
	}
	return view, nil
}

func (service *LiveService) loadStoredOrComputedStandings(ctx context.Context, liveId uuid.UUID, receiver *uuid.UUID) ([]rawStanding, error) {
	session, err := service.Client.LiveSession.Get(ctx, liveId)
	if err != nil {
		return nil, err
	}
	if session.State == "ended" && receiver == nil {
		stored, err := service.Client.LiveLeaderboardEntry.Query().Where(liveleaderboardentry.LiveID(liveId)).Order(ent.Asc(liveleaderboardentry.FieldRank)).All(ctx)
		if err != nil || len(stored) > 0 {
			standings := make([]rawStanding, 0, len(stored))
			for _, row := range stored {
				standings = append(standings, rawStanding{UserId: row.UserID, Coins: row.Coins, Points: row.Points})
			}
			return standings, err
		}
	}
	return service.computeLiveStandings(ctx, service.Client, liveId, receiver)
}
