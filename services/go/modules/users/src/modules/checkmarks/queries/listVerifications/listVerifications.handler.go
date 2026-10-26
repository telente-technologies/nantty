package listverifications

import (
	"context"
	"strings"

	"github.com/google/uuid"

	"nantty/modules/users/src/container"
	usersErrors "nantty/modules/users/src/errors"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/predicate"
	"nantty/modules/users/src/generated/ent/verificationapplication"
	"nantty/modules/users/src/modules/checkmarks/services"
)

const pageSize = 25

type Result struct {
	Data       []services.VerificationView `json:"data"`
	NextCursor *string                     `json:"nextCursor"`
}

type Handler struct {
	Container *container.Container
}

var statusByLabel = map[string]verificationapplication.Status{
	"PENDING": verificationapplication.StatusPending, "VERIFIED": verificationapplication.StatusApproved, "UNVERIFIED": verificationapplication.StatusRejected,
	"SUSPENDED": verificationapplication.StatusSuspended, "REVOKED": verificationapplication.StatusRevoked,
}

func (handler Handler) Execute(ctx context.Context, status, color, cursor string) (Result, error) {
	var predicates []predicate.VerificationApplication
	if status == "" {
		status = "PENDING"
	}
	if mapped, known := statusByLabel[strings.ToUpper(status)]; known {
		predicates = append(predicates, verificationapplication.StatusEQ(mapped))
	}
	if color != "" {
		predicates = append(predicates, verificationapplication.ColorEQ(verificationapplication.Color(strings.ToLower(color))))
	}
	if cursor != "" {
		cursorId, err := uuid.Parse(cursor)
		if err != nil {
			return Result{}, usersErrors.Unprocessable("The cursor is invalid.")
		}
		predicates = append(predicates, verificationapplication.IDGT(cursorId))
	}
	rows, err := handler.Container.Client.VerificationApplication.Query().Where(predicates...).Order(ent.Asc(verificationapplication.FieldID)).Limit(pageSize + 1).All(ctx)
	if err != nil {
		return Result{}, err
	}
	result := Result{Data: []services.VerificationView{}}
	if len(rows) > pageSize {
		rows = rows[:pageSize]
		next := rows[len(rows)-1].ID.String()
		result.NextCursor = &next
	}
	for _, row := range rows {
		view, err := services.BuildVerificationView(ctx, handler.Container, row)
		if err != nil {
			return result, err
		}
		result.Data = append(result.Data, view)
	}
	return result, nil
}
