package listblackapplications

import (
	"context"
	"strings"

	"github.com/google/uuid"

	"nantty/modules/users/src/container"
	usersErrors "nantty/modules/users/src/errors"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/blackapplication"
	"nantty/modules/users/src/generated/ent/predicate"
	"nantty/modules/users/src/modules/checkmarks/services"
)

const pageSize = 25

type Result struct {
	Data       []services.BlackApplicationView `json:"data"`
	NextCursor *string                         `json:"nextCursor"`
}

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, status, search, cursor string) (Result, error) {
	var predicates []predicate.BlackApplication
	switch normalized := strings.ToUpper(status); normalized {
	case "", "OPEN":
		predicates = append(predicates, blackapplication.StatusIn(blackapplication.StatusInReview, blackapplication.StatusAwaitingSecondApproval))
	case "REVERIFY":
		predicates = append(predicates, blackapplication.StatusEQ(blackapplication.StatusApproved), blackapplication.ReverificationDueAtLTE(handler.Container.Now().AddDate(0, 0, 30)))
	case "ALL":
	default:
		predicates = append(predicates, blackapplication.StatusEQ(blackapplication.Status(strings.ToLower(normalized))))
	}
	if cursor != "" {
		cursorId, err := uuid.Parse(cursor)
		if err != nil {
			return Result{}, usersErrors.Unprocessable("The cursor is invalid.")
		}
		predicates = append(predicates, blackapplication.IDGT(cursorId))
	}
	if search != "" {
		predicates = append(predicates, blackapplication.Or(blackapplication.AgencyNameContainsFold(search), blackapplication.HandleContainsFold(search)))
	}
	rows, err := handler.Container.Client.BlackApplication.Query().Where(predicates...).Order(ent.Asc(blackapplication.FieldID)).Limit(pageSize + 1).All(ctx)
	if err != nil {
		return Result{}, err
	}
	result := Result{Data: []services.BlackApplicationView{}}
	if len(rows) > pageSize {
		rows = rows[:pageSize]
		next := rows[len(rows)-1].ID.String()
		result.NextCursor = &next
	}
	for _, row := range rows {
		view, err := services.BuildBlackApplicationView(ctx, handler.Container, row)
		if err != nil {
			return result, err
		}
		result.Data = append(result.Data, view)
	}
	return result, nil
}
