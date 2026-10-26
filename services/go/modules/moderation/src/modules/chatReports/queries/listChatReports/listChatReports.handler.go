package listchatreports

import (
	"context"
	"slices"
	"strconv"
	"strings"

	"nantty/modules/moderation/src/container"
	"nantty/modules/moderation/src/generated/ent"
	"nantty/modules/moderation/src/generated/ent/chatreport"
	"nantty/modules/moderation/src/generated/ent/predicate"
	"nantty/modules/moderation/src/modules/chatReports/services"
)

const pageSize = 25

type Query struct {
	Status     string
	TargetType string
	Reason     string
	Priority   string
	Search     string
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
	var predicates []predicate.ChatReport
	switch status := strings.ToLower(query.Status); status {
	case "", "open":
		predicates = append(predicates, chatreport.StatusIn(chatreport.StatusOpen, chatreport.StatusInReview))
	case "all":
	default:
		predicates = append(predicates, chatreport.StatusEQ(chatreport.Status(status)))
	}
	if query.TargetType != "" {
		predicates = append(predicates, chatreport.TargetTypeEQ(chatreport.TargetType(strings.ToLower(query.TargetType))))
	}
	if query.Reason != "" {
		predicates = append(predicates, chatreport.Reason(strings.ToLower(query.Reason)))
	}
	if query.Priority != "" {
		predicates = append(predicates, chatreport.PriorityEQ(chatreport.Priority(strings.ToLower(query.Priority))))
	}
	if search := strings.TrimSpace(query.Search); search != "" {
		predicates = append(predicates, chatreport.Or(chatreport.TargetIDContainsFold(search), chatreport.ConversationIDContainsFold(search), chatreport.DetailsContainsFold(search)))
	}
	rows, err := handler.Container.Client.ChatReport.Query().Where(predicates...).Order(ent.Asc(chatreport.FieldSLADueAt)).All(ctx)
	if err != nil {
		return Result{}, err
	}
	slices.SortStableFunc(rows, func(left, right *ent.ChatReport) int {
		return compareReports(left, right)
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

func compareReports(left, right *ent.ChatReport) int {
	if leftChild, rightChild := left.Reason == "child_safety", right.Reason == "child_safety"; leftChild != rightChild {
		if leftChild {
			return -1
		}
		return 1
	}
	if byPriority := services.PriorityRank(string(left.Priority)) - services.PriorityRank(string(right.Priority)); byPriority != 0 {
		return byPriority
	}
	return left.SLADueAt.Compare(right.SLADueAt)
}
