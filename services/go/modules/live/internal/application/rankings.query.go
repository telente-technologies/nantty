package application

import (
	"context"
	"strconv"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/live/internal/ent"
	"zudomart/modules/live/internal/ent/pointsentry"
	"zudomart/modules/live/internal/ent/predicate"
)

type RankingQuery struct {
	Board       string
	Scope       string
	CountryCode string
	CategoryId  string
	Period      string
	Cursor      int
	Limit       int
}

type RankingEntryView struct {
	Rank   int         `json:"rank"`
	User   UserSummary `json:"user"`
	Points int64       `json:"points"`
}

type RankingsView struct {
	Data       []RankingEntryView `json:"data"`
	NextCursor *string            `json:"nextCursor"`
}

func rankingPredicates(query RankingQuery, now time.Time) []predicate.PointsEntry {
	var conditions []predicate.PointsEntry
	switch query.Board {
	case "supporter":
		conditions = append(conditions, pointsentry.TypeEQ(pointsentry.TypeSupport))
	case "engagement":
		conditions = append(conditions, pointsentry.TypeEQ(pointsentry.TypeEngagement))
	case "streamer":
		conditions = append(conditions, pointsentry.TypeEQ(pointsentry.TypeStream))
	case "creator":
		conditions = append(conditions, pointsentry.TypeEQ(pointsentry.TypeStream), pointsentry.HostIsCreator(true))
	}
	switch query.Scope {
	case "country":
		conditions = append(conditions, pointsentry.CountryCode(query.CountryCode))
	case "category":
		conditions = append(conditions, pointsentry.CategoryID(query.CategoryId))
	}
	periods := map[string]time.Duration{"day": 24 * time.Hour, "week": 7 * 24 * time.Hour, "month": 30 * 24 * time.Hour}
	if window, bounded := periods[query.Period]; bounded {
		conditions = append(conditions, pointsentry.CreatedAtGT(now.Add(-window)))
	}
	return conditions
}

func (application *LiveApplication) GetRankings(ctx context.Context, query RankingQuery) (RankingsView, error) {
	var totals []struct {
		UserID uuid.UUID `json:"user_id"`
		Total  int64     `json:"total"`
	}
	err := application.Client.PointsEntry.Query().Where(rankingPredicates(query, application.Now())...).GroupBy(pointsentry.FieldUserID).
		Aggregate(ent.As(ent.Sum(pointsentry.FieldAmount), "total")).Scan(ctx, &totals)
	if err != nil {
		return RankingsView{}, err
	}
	sortTotalsDescending(totals)
	view := RankingsView{Data: []RankingEntryView{}}
	if query.Cursor >= len(totals) {
		return view, nil
	}
	end := min(query.Cursor+query.Limit, len(totals))
	page := totals[query.Cursor:end]
	identifiers := make([]uuid.UUID, 0, len(page))
	for _, row := range page {
		identifiers = append(identifiers, row.UserID)
	}
	participants, err := application.lookupParticipants(ctx, identifiers...)
	if err != nil {
		return RankingsView{}, err
	}
	for index, row := range page {
		view.Data = append(view.Data, RankingEntryView{Rank: query.Cursor + index + 1, User: summarise(participants[row.UserID]), Points: row.Total})
	}
	if end < len(totals) {
		next := strconv.Itoa(end)
		view.NextCursor = &next
	}
	return view, nil
}
