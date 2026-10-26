package getmysuspension

import (
	"context"

	"github.com/google/uuid"

	"nantty/modules/users/src/container"
	usersErrors "nantty/modules/users/src/errors"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/accountsuspension"
)

type Handler struct {
	Container *container.Container
}

type Result struct {
	Reason               string  `json:"reason"`
	SuspendedAt          string  `json:"suspendedAt"`
	DeletionScheduledFor string  `json:"deletionScheduledFor"`
	RetentionDays        int     `json:"retentionDays"`
	AppealStatus         string  `json:"appealStatus"`
	EndsAt               *string `json:"endsAt"`
}

func (handler Handler) Execute(ctx context.Context, accountId string) (Result, error) {
	owner, err := uuid.Parse(accountId)
	if err != nil {
		return Result{}, usersErrors.ErrAccountUnavailable
	}
	row, err := handler.Container.Client.AccountSuspension.Query().Where(accountsuspension.AccountID(owner), accountsuspension.StatusEQ(accountsuspension.StatusActive)).Order(ent.Desc(accountsuspension.FieldID)).First(ctx)
	if ent.IsNotFound(err) {
		return Result{}, usersErrors.NotFound("This account is not suspended.")
	}
	if err != nil {
		return Result{}, err
	}
	result := Result{Reason: row.Note, SuspendedAt: row.CreatedAt.UTC().Format("2006-01-02T15:04:05Z07:00"), DeletionScheduledFor: row.DeletionDueAt.UTC().Format("2006-01-02T15:04:05Z07:00"), RetentionDays: 120, AppealStatus: string(row.AppealStatus)}
	if row.EndsAt != nil {
		ends := row.EndsAt.UTC().Format("2006-01-02T15:04:05Z07:00")
		result.EndsAt = &ends
	}
	return result, nil
}
