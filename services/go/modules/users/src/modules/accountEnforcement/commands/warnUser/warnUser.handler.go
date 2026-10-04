package warnuser

import (
	"context"

	"zudomart/modules/users/src/container"
	usersErrors "zudomart/modules/users/src/errors"
	usersevents "zudomart/modules/users/src/events"
	"zudomart/modules/users/src/generated/ent"
	accountevents "zudomart/modules/users/src/modules/accountEnforcement/events"
	"zudomart/modules/users/src/modules/accountEnforcement/services"
	usersservices "zudomart/modules/users/src/services"
)

type Handler struct {
	Container *container.Container
}

type Result struct {
	AccountId string `json:"accountId"`
	Warned    bool   `json:"warned"`
}

func (handler Handler) Execute(ctx context.Context, command Command) (Result, error) {
	reason, err := services.RequireReason(command.Reason)
	if err != nil {
		return Result{}, err
	}
	target, err := services.LoadTarget(ctx, handler.Container, command.TargetId)
	if err != nil {
		return Result{}, err
	}
	if target.Account.Status == "deleted" {
		return Result{}, usersErrors.Conflict("INVALID_STATUS", "This account has been deleted.")
	}
	now := handler.Container.Now()
	err = handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		if err := usersevents.EnqueueOutboxEventInTransaction(ctx, tx, accountevents.AccountWarnedType, target.Account.ID.String(), now, accountevents.AccountWarnedData{
			AccountId: target.Account.ID.String(), CaseId: command.CaseId, Reason: reason, Policy: "Community Guidelines", PolicyUrl: accountevents.CommunityGuidelinesUrl,
			AppealUrl: accountevents.AppealUrl, Source: command.Source,
		}); err != nil {
			return err
		}
		return usersservices.RecordStaffAuditEntry(ctx, command.Actor, usersservices.StaffAuditEntry{
			Action: "user.warned", SubjectType: "user", SubjectId: target.Account.ID.String(), SubjectLabel: target.Label(), Reason: reason,
			After: map[string]any{"source": command.Source, "caseId": command.CaseId},
		})
	})
	if err != nil {
		return Result{}, err
	}
	return Result{AccountId: target.Account.ID.String(), Warned: true}, nil
}
