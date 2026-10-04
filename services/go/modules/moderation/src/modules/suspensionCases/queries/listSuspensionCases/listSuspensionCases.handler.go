package listsuspensioncases

import (
	"context"
	"strconv"
	"strings"

	"zudomart/modules/moderation/src/container"
	"zudomart/modules/moderation/src/generated/ent"
	"zudomart/modules/moderation/src/generated/ent/predicate"
	"zudomart/modules/moderation/src/generated/ent/suspensioncase"
	"zudomart/modules/moderation/src/modules/suspensionCases/services"
)

const pageSize = 25

type Result struct {
	Data       []services.CaseSummary `json:"data"`
	NextCursor *string                `json:"nextCursor"`
}

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, status, source, modelVersion, cursor string) (Result, error) {
	var predicates []predicate.SuspensionCase
	switch normalized := strings.ToLower(status); normalized {
	case "", "open":
		predicates = append(predicates, suspensioncase.StatusIn(suspensioncase.StatusPending, suspensioncase.StatusEscalated))
	case "decided":
		predicates = append(predicates, suspensioncase.StatusIn(suspensioncase.StatusSuspended, suspensioncase.StatusDismissed))
	case "all":
	default:
		predicates = append(predicates, suspensioncase.StatusEQ(suspensioncase.Status(normalized)))
	}
	if source != "" {
		predicates = append(predicates, suspensioncase.SourceEQ(suspensioncase.Source(strings.ToLower(source))))
	}
	if modelVersion != "" {
		predicates = append(predicates, suspensioncase.ModelVersion(modelVersion))
	}
	offset, _ := strconv.Atoi(cursor)
	rows, err := handler.Container.Client.SuspensionCase.Query().Where(predicates...).Order(ent.Desc(suspensioncase.FieldRiskScore), ent.Asc(suspensioncase.FieldID)).Offset(offset).Limit(pageSize + 1).All(ctx)
	if err != nil {
		return Result{}, err
	}
	result := Result{}
	if len(rows) > pageSize {
		rows = rows[:pageSize]
		next := strconv.Itoa(offset + pageSize)
		result.NextCursor = &next
	}
	result.Data, err = services.BuildCaseSummaries(ctx, handler.Container, rows)
	return result, err
}
