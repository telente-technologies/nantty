package application

import (
	"context"
	"sort"

	"github.com/google/uuid"

	"zudomart/modules/live/internal/ent"
	"zudomart/modules/live/internal/ent/giftcontribution"
	"zudomart/modules/live/internal/ent/liveleaderboardentry"
	"zudomart/modules/live/internal/ent/pointsentry"
)

type LeaderboardUser struct {
	Id        string  `json:"id"`
	Name      string  `json:"name"`
	Username  string  `json:"username"`
	AvatarUrl *string `json:"avatarUrl"`
}

type LeaderboardEntryView struct {
	Rank   int             `json:"rank"`
	User   LeaderboardUser `json:"user"`
	Coins  int64           `json:"coins"`
	Points int64           `json:"points"`
}

type LeaderboardView struct {
	Data         []LeaderboardEntryView `json:"data"`
	NextCursor   *string                `json:"nextCursor"`
	ViewerRank   *int                   `json:"viewerRank"`
	ViewerPoints int64                  `json:"viewerPoints"`
}

const liveScopeKey = "live"

type rawStanding struct {
	UserId uuid.UUID
	Coins  int64
	Points int64
}

func (application *LiveApplication) computeLiveStandings(ctx context.Context, db *ent.Client, liveId uuid.UUID, receiver *uuid.UUID) ([]rawStanding, error) {
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

func (application *LiveApplication) GetLiveLeaderboard(ctx context.Context, liveId uuid.UUID, viewer uuid.UUID, receiver *uuid.UUID, limit int) (LeaderboardView, error) {
	if _, err := application.Client.LiveSession.Get(ctx, liveId); err != nil {
		if ent.IsNotFound(err) {
			return LeaderboardView{}, errLiveNotFound
		}
		return LeaderboardView{}, err
	}
	standings, err := application.loadStoredOrComputedStandings(ctx, liveId, receiver)
	if err != nil {
		return LeaderboardView{}, err
	}
	view := LeaderboardView{Data: []LeaderboardEntryView{}}
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
	participants, err := application.lookupParticipants(ctx, identifiers...)
	if err != nil {
		return LeaderboardView{}, err
	}
	for index, row := range standings {
		user := participants[row.UserId]
		view.Data = append(view.Data, LeaderboardEntryView{
			Rank: index + 1, Coins: row.Coins, Points: row.Points,
			User: LeaderboardUser{Id: user.Id.String(), Name: user.Name, Username: user.Username, AvatarUrl: user.AvatarUrl},
		})
	}
	return view, nil
}

func (application *LiveApplication) loadStoredOrComputedStandings(ctx context.Context, liveId uuid.UUID, receiver *uuid.UUID) ([]rawStanding, error) {
	session, err := application.Client.LiveSession.Get(ctx, liveId)
	if err != nil {
		return nil, err
	}
	if session.State == "ended" && receiver == nil {
		stored, err := application.Client.LiveLeaderboardEntry.Query().Where(liveleaderboardentry.LiveID(liveId)).Order(ent.Asc(liveleaderboardentry.FieldRank)).All(ctx)
		if err != nil || len(stored) > 0 {
			standings := make([]rawStanding, 0, len(stored))
			for _, row := range stored {
				standings = append(standings, rawStanding{UserId: row.UserID, Coins: row.Coins, Points: row.Points})
			}
			return standings, err
		}
	}
	return application.computeLiveStandings(ctx, application.Client, liveId, receiver)
}
