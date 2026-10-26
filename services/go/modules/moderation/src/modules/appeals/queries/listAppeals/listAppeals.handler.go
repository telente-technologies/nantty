package listappeals

import (
	"context"
	"strconv"
	"strings"

	"github.com/google/uuid"

	"nantty/modules/moderation/src/container"
	"nantty/modules/moderation/src/generated/ent"
	"nantty/modules/moderation/src/generated/ent/appeal"
	"nantty/modules/moderation/src/generated/ent/predicate"
	"nantty/modules/moderation/src/integrations"
	"nantty/modules/moderation/src/modules/appeals/services"
	"nantty/platform/httpserver"
)

const pageSize = 25

type Query struct {
	Status       string
	DecisionType string
	Search       string
	Cursor       string
}

type Result struct {
	Data       []services.Summary `json:"data"`
	NextCursor *string            `json:"nextCursor"`
}

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (Result, error) {
	predicates := []predicate.Appeal{}
	switch status := strings.ToLower(query.Status); status {
	case "", "pending":
		predicates = append(predicates, appeal.StatusEQ(appeal.StatusPending))
	case "all":
	case "upheld", "overturned":
		predicates = append(predicates, appeal.StatusEQ(appeal.Status(status)))
	default:
		return Result{}, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "status", Message: "must be PENDING, UPHELD, OVERTURNED or ALL"}})
	}
	if query.DecisionType != "" {
		decisionType := appeal.DecisionType(strings.ToLower(query.DecisionType))
		if appeal.DecisionTypeValidator(decisionType) != nil {
			return Result{}, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "decisionType", Message: "is not a known decision type"}})
		}
		predicates = append(predicates, appeal.DecisionTypeEQ(decisionType))
	}
	if search := strings.TrimSpace(query.Search); search != "" {
		predicates = append(predicates, handler.searchPredicate(ctx, search))
	}
	offset, _ := strconv.Atoi(query.Cursor)
	rows, err := handler.Container.Client.Appeal.Query().Where(predicates...).Order(ent.Asc(appeal.FieldSLADueAt), ent.Asc(appeal.FieldID)).Offset(max(offset, 0)).Limit(pageSize + 1).All(ctx)
	if err != nil {
		return Result{}, err
	}
	result := Result{}
	if len(rows) > pageSize {
		rows = rows[:pageSize]
		next := strconv.Itoa(max(offset, 0) + pageSize)
		result.NextCursor = &next
	}
	result.Data, err = services.BuildSummaries(ctx, handler.Container, rows)
	return result, err
}

func (handler Handler) searchPredicate(ctx context.Context, search string) predicate.Appeal {
	matches := []predicate.Appeal{appeal.TargetIDContainsFold(search), appeal.StatementContainsFold(search)}
	if identifier, err := uuid.Parse(search); err == nil {
		matches = append(matches, appeal.ID(identifier), appeal.AppellantID(identifier), appeal.ReportID(identifier), appeal.StrikeID(identifier))
	}
	if accountId, found := integrations.ResolveUsername(ctx, handler.Container.Users, search); found {
		matches = append(matches, appeal.AppellantID(accountId))
	}
	return appeal.Or(matches...)
}

func (handler Handler) Detail(ctx context.Context, appealId string) (services.Detail, error) {
	identifier, err := uuid.Parse(appealId)
	if err != nil {
		return services.Detail{}, httpserver.ErrNotFound
	}
	row, err := handler.Container.Client.Appeal.Get(ctx, identifier)
	if ent.IsNotFound(err) {
		return services.Detail{}, httpserver.ErrNotFound
	}
	if err != nil {
		return services.Detail{}, err
	}
	return services.BuildDetail(ctx, handler.Container, row)
}
