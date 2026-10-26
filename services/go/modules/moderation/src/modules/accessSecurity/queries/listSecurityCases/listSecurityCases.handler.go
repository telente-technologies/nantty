package listsecuritycases

import (
	"context"
	"strconv"
	"strings"

	"nantty/modules/moderation/src/container"
	"nantty/modules/moderation/src/generated/ent"
	"nantty/modules/moderation/src/generated/ent/predicate"
	"nantty/modules/moderation/src/generated/ent/securitycase"
	"nantty/modules/moderation/src/modules/accessSecurity/services"
)

const pageSize = 25

type Filters struct {
	Status   string
	Trigger  string
	Severity string
	Cursor   string
}

type Result struct {
	Data       []services.CaseSummary `json:"data"`
	NextCursor *string                `json:"nextCursor"`
}

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, filters Filters) (Result, error) {
	predicates := []predicate.SecurityCase{}
	switch status := strings.ToLower(filters.Status); status {
	case "", "open":
		predicates = append(predicates, securitycase.StatusEQ(securitycase.StatusOpen))
	case "decided":
		predicates = append(predicates, securitycase.StatusNEQ(securitycase.StatusOpen))
	case "all":
	default:
		if securitycase.StatusValidator(securitycase.Status(status)) == nil {
			predicates = append(predicates, securitycase.StatusEQ(securitycase.Status(status)))
		}
	}
	if trigger := securitycase.Trigger(strings.ToLower(filters.Trigger)); trigger != "" && securitycase.TriggerValidator(trigger) == nil {
		predicates = append(predicates, securitycase.TriggerEQ(trigger))
	}
	if severity := securitycase.Severity(strings.ToLower(filters.Severity)); severity != "" && securitycase.SeverityValidator(severity) == nil {
		predicates = append(predicates, securitycase.SeverityEQ(severity))
	}
	offset, _ := strconv.Atoi(filters.Cursor)
	rows, err := handler.Container.Client.SecurityCase.Query().Where(predicates...).
		Order(ent.Desc(securitycase.FieldAutoSuspended), ent.Desc(securitycase.FieldLastActivityAt), ent.Asc(securitycase.FieldID)).
		Offset(max(offset, 0)).Limit(pageSize + 1).All(ctx)
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
