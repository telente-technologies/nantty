package banuser

import (
	"context"
	"time"

	"nantty/modules/users/src/container"
	usersErrors "nantty/modules/users/src/errors"
	usersevents "nantty/modules/users/src/events"
	"nantty/modules/users/src/generated/ent"
	accountevents "nantty/modules/users/src/modules/accountEnforcement/events"
	"nantty/modules/users/src/modules/accountEnforcement/services"
	usersservices "nantty/modules/users/src/services"
	"nantty/platform/identityports"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (services.UserDetail, error) {
	reason, err := services.RequireReason(command.Reason)
	if err != nil {
		return services.UserDetail{}, err
	}
	if command.DurationDays != nil && (*command.DurationDays < 1 || *command.DurationDays > 3650) {
		return services.UserDetail{}, usersErrors.ValidationFailedFor("durationDays", "must be 1 to 3650 or null for a permanent ban")
	}
	target, err := services.LoadTarget(ctx, handler.Container, command.TargetId)
	if err != nil {
		return services.UserDetail{}, err
	}
	switch target.Account.Status {
	case "banned":
		return services.UserDetail{}, usersErrors.Conflict("ALREADY_BANNED", "This account is already banned.")
	case "deleted":
		return services.UserDetail{}, usersErrors.Conflict("INVALID_STATUS", "This account has been deleted.")
	}
	enforcement, err := identityports.Default.AccountEnforcement()
	if err != nil {
		return services.UserDetail{}, err
	}
	permanent := command.DurationDays == nil
	if err := enforcement.BanAccountAndRevokeSessions(ctx, target.Account.ID, identityports.BanDetails{Reason: reason, BlockedBy: command.Actor.Id, BlockFutureSignup: permanent}); err != nil {
		return services.UserDetail{}, err
	}
	now := handler.Container.Now()
	err = handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		create := tx.AccountBan.Create().SetAccountID(target.Account.ID).SetReason(reason).SetBannedBy(command.Actor.Id).SetBannedByName(command.Actor.Name)
		var endsAt *time.Time
		if !permanent {
			ends := now.Add(time.Duration(*command.DurationDays) * 24 * time.Hour)
			create.SetEndsAt(ends)
			endsAt = &ends
		}
		ban, err := create.Save(ctx)
		if err != nil {
			return err
		}
		var until *string
		if endsAt != nil {
			text := endsAt.UTC().Format(time.RFC3339)
			until = &text
		}
		if err := usersevents.EnqueueOutboxEventInTransaction(ctx, tx, accountevents.AccountBannedType, target.Account.ID.String(), now, accountevents.AccountBannedData{
			AccountId: target.Account.ID.String(), CaseId: ban.ID.String(), Reason: reason, Policy: "Community Guidelines", PolicyUrl: accountevents.CommunityGuidelinesUrl, AppealUrl: accountevents.AppealUrl, Until: until, Permanent: permanent,
		}); err != nil {
			return err
		}
		return usersservices.RecordStaffAuditEntry(ctx, command.Actor, usersservices.StaffAuditEntry{
			Action: "user.banned", SubjectType: "user", SubjectId: target.Account.ID.String(), SubjectLabel: target.Label(), Reason: reason,
			Before: map[string]any{"status": target.Account.Status}, After: map[string]any{"status": "banned", "endsAt": endsAt, "blocksReSignup": permanent},
		})
	})
	if err != nil {
		_ = enforcement.LiftBan(ctx, target.Account.ID)
		return services.UserDetail{}, err
	}
	target.Account.Status = "banned"
	return services.BuildUserDetail(ctx, handler.Container, target)
}
