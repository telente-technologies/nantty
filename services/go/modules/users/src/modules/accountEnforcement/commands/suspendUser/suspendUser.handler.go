package suspenduser

import (
	"context"
	"time"

	"zudomart/modules/users/src/container"
	usersErrors "zudomart/modules/users/src/errors"
	usersevents "zudomart/modules/users/src/events"
	"zudomart/modules/users/src/generated/ent"
	"zudomart/modules/users/src/generated/ent/accountsuspension"
	accountevents "zudomart/modules/users/src/modules/accountEnforcement/events"
	"zudomart/modules/users/src/modules/accountEnforcement/services"
	usersservices "zudomart/modules/users/src/services"
	"zudomart/platform/identityports"
)

const DeletionCountdown = 120 * 24 * time.Hour

var ReasonCodes = map[string]bool{"FRAUD": true, "SCAM": true, "COUNTERFEIT": true, "HARASSMENT": true, "IMPERSONATION": true, "SPAM_NETWORK": true, "OTHER": true}

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (services.UserDetail, error) {
	reason, err := services.RequireReason(command.Reason)
	if err != nil {
		return services.UserDetail{}, err
	}
	reasonCode := command.ReasonCode
	if reasonCode == "" {
		reasonCode = "OTHER"
	}
	if !ReasonCodes[reasonCode] || command.DurationDays < 0 || command.DurationDays > 365 {
		return services.UserDetail{}, usersErrors.ValidationFailedFor("durationDays", "must be 1 to 365 with a known reason code")
	}
	target, err := services.LoadTarget(ctx, handler.Container, command.TargetId)
	if err != nil {
		return services.UserDetail{}, err
	}
	switch target.Account.Status {
	case "suspended":
		return services.UserDetail{}, usersErrors.Conflict("ALREADY_SUSPENDED", "This account is already suspended.")
	case "banned":
		return services.UserDetail{}, usersErrors.Conflict("USER_BANNED", "This account is banned.")
	case "deleted", "deactivated":
		return services.UserDetail{}, usersErrors.Conflict("INVALID_STATUS", "This account cannot be suspended.")
	}
	enforcement, err := identityports.Default.AccountEnforcement()
	if err != nil {
		return services.UserDetail{}, err
	}
	if err := enforcement.SuspendAccountAndRevokeSessions(ctx, target.Account.ID); err != nil {
		return services.UserDetail{}, err
	}
	if err := handler.recordSuspension(ctx, command, target, reasonCode, reason); err != nil {
		_ = enforcement.ReinstateAccount(ctx, target.Account.ID)
		return services.UserDetail{}, err
	}
	target.Account.Status = "suspended"
	return services.BuildUserDetail(ctx, handler.Container, target)
}

func (handler Handler) recordSuspension(ctx context.Context, command Command, target services.Target, reasonCode, reason string) error {
	now := handler.Container.Now()
	source := command.Source
	if source == "" {
		source = "staff"
	}
	return handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		create := tx.AccountSuspension.Create().SetAccountID(target.Account.ID).SetSource(accountsuspension.Source(source)).SetReasonCode(reasonCode).SetNote(reason).
			SetSuspendedBy(command.Actor.Id).SetSuspendedByName(command.Actor.Name).SetDeletionDueAt(now.Add(DeletionCountdown))
		if command.CaseId != nil {
			create.SetID(*command.CaseId)
		}
		var endsAt *string
		if command.DurationDays > 0 {
			ends := now.Add(time.Duration(command.DurationDays) * 24 * time.Hour)
			create.SetEndsAt(ends)
			formatted := ends.UTC().Format(time.RFC3339)
			endsAt = &formatted
		}
		created, err := create.Save(ctx)
		if err != nil {
			return err
		}
		if err := usersevents.EnqueueOutboxEventInTransaction(ctx, tx, accountevents.AccountSuspendedType, target.Account.ID.String(), now, accountevents.AccountSuspendedData{
			AccountId: target.Account.ID.String(), CaseId: created.ID.String(), Reason: reason, ReasonCode: reasonCode, Policy: "Community Guidelines", PolicyUrl: accountevents.CommunityGuidelinesUrl, AppealUrl: accountevents.AppealUrl,
			AppealBy: created.DeletionDueAt.UTC().Format(time.RFC3339), DeletionAt: created.DeletionDueAt.UTC().Format(time.RFC3339), Until: endsAt,
		}); err != nil {
			return err
		}
		return usersservices.RecordStaffAuditEntry(ctx, command.Actor, usersservices.StaffAuditEntry{
			Action: "user.suspended", SubjectType: "user", SubjectId: target.Account.ID.String(), SubjectLabel: target.Label(), Reason: reason,
			Before: map[string]any{"status": target.Account.Status}, After: map[string]any{"status": "suspended", "endsAt": endsAt, "deletionDueAt": created.DeletionDueAt, "caseId": created.ID},
		})
	})
}
