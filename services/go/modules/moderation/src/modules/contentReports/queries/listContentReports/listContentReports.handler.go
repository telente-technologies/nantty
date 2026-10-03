package listcontentreports

import (
	"context"
	"slices"
	"strconv"
	"strings"

	"github.com/google/uuid"

	"zudomart/modules/moderation/src/container"
	"zudomart/modules/moderation/src/generated/ent"
	"zudomart/modules/moderation/src/generated/ent/contentreport"
	"zudomart/modules/moderation/src/generated/ent/predicate"
	"zudomart/modules/moderation/src/modules/contentReports/services"
)

const pageSize = 25

type Query struct {
	Status     string
	TargetType string
	Reason     string
	Priority   string
	Search     string
	Source     string
	Cursor     int
}

type Result struct {
	Data       []services.Summary `json:"data"`
	NextCursor *string            `json:"nextCursor"`
}

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (Result, error) {
	var predicates []predicate.ContentReport
	switch status := strings.ToLower(query.Status); status {
	case "", "open":
		predicates = append(predicates, contentreport.StatusIn(contentreport.StatusOpen, contentreport.StatusInReview))
	case "all":
	default:
		predicates = append(predicates, contentreport.StatusEQ(contentreport.Status(status)))
	}
	if query.TargetType != "" {
		predicates = append(predicates, contentreport.TargetTypeEQ(contentreport.TargetType(strings.ToLower(query.TargetType))))
	}
	if query.Reason != "" {
		predicates = append(predicates, contentreport.PrimaryReason(strings.ToLower(query.Reason)))
	}
	if query.Priority != "" {
		predicates = append(predicates, contentreport.PriorityEQ(contentreport.Priority(strings.ToLower(query.Priority))))
	}
	if query.Source != "" {
		predicates = append(predicates, contentreport.SourceEQ(contentreport.Source(strings.ToLower(query.Source))))
	}
	if search := strings.TrimSpace(query.Search); search != "" {
		matches := []predicate.ContentReport{contentreport.TargetIDContainsFold(search)}
		if identifier, err := uuid.Parse(search); err == nil {
			matches = append(matches, contentreport.ID(identifier))
		}
		predicates = append(predicates, contentreport.Or(matches...))
	}
	rows, err := handler.Container.Client.ContentReport.Query().Where(predicates...).Order(ent.Asc(contentreport.FieldSLADueAt)).All(ctx)
	if err != nil {
		return Result{}, err
	}
	slices.SortStableFunc(rows, func(left, right *ent.ContentReport) int {
		if byPriority := services.PriorityRank(string(left.Priority)) - services.PriorityRank(string(right.Priority)); byPriority != 0 {
			return byPriority
		}
		return left.SLADueAt.Compare(right.SLADueAt)
	})
	start := min(query.Cursor, len(rows))
	end := min(start+pageSize, len(rows))
	result := Result{}
	if end < len(rows) {
		next := strconv.Itoa(end)
		result.NextCursor = &next
	}
	result.Data, err = services.BuildSummaries(ctx, handler.Container, rows[start:end])
	return result, err
}
