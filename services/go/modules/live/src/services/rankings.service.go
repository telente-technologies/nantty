package services

import (
	"context"
	"strconv"
	"time"
	"zudomart/modules/live/src/types"

	"github.com/google/uuid"

	"zudomart/modules/live/src/generated/ent"
	"zudomart/modules/live/src/generated/ent/pointsentry"
	"zudomart/modules/live/src/generated/ent/predicate"
)

func rankingPredicates(query types.RankingQuery, now time.Time) []predicate.PointsEntry {
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

type rankedTotal = struct {
	UserID uuid.UUID `json:"user_id"`
	Total  int64     `json:"total"`
}

func (service *LiveService) rankedTotals(ctx context.Context, query types.RankingQuery) ([]rankedTotal, error) {
	var totals []rankedTotal
	err := service.Client.PointsEntry.Query().Where(rankingPredicates(query, service.Now())...).GroupBy(pointsentry.FieldUserID).
		Aggregate(ent.As(ent.Sum(pointsentry.FieldAmount), "total")).Scan(ctx, &totals)
	if err != nil {
		return nil, err
	}
	sortTotalsDescending(totals)
	return totals, nil
}

func (service *LiveService) GetRankings(ctx context.Context, query types.RankingQuery) (types.RankingsView, error) {
	totals, err := service.rankedTotals(ctx, query)
	if err != nil {
		return types.RankingsView{}, err
	}
	view := types.RankingsView{Data: []types.RankingEntryView{}}
	if query.Cursor >= len(totals) {
		return view, nil
	}
	end := min(query.Cursor+query.Limit, len(totals))
	page := totals[query.Cursor:end]
	identifiers := make([]uuid.UUID, 0, len(page))
	for _, row := range page {
		identifiers = append(identifiers, row.UserID)
	}
	participants, err := service.lookupParticipants(ctx, identifiers...)
	if err != nil {
		return types.RankingsView{}, err
	}
	for index, row := range page {
		view.Data = append(view.Data, types.RankingEntryView{Rank: query.Cursor + index + 1, User: summarise(participants[row.UserID]), Points: row.Total})
	}
	if end < len(totals) {
		next := strconv.Itoa(end)
		view.NextCursor = &next
	}
	return view, nil
}
