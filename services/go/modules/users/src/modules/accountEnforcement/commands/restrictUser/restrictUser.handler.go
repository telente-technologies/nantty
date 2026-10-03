package restrictuser

import (
	"context"
	"slices"
	"time"

	"zudomart/modules/users/src/container"
	usersErrors "zudomart/modules/users/src/errors"
	usersevents "zudomart/modules/users/src/events"
	"zudomart/modules/users/src/generated/ent"
	"zudomart/modules/users/src/generated/ent/accountrestriction"
	accountevents "zudomart/modules/users/src/modules/accountEnforcement/events"
	"zudomart/modules/users/src/modules/accountEnforcement/services"
	usersservices "zudomart/modules/users/src/services"
)

var AllowedFeatures = []string{"POSTING", "COMMENTING", "MESSAGING", "SELLING", "GOING_LIVE"}

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (services.UserDetail, error) {
	reason, err := services.RequireReason(command.Reason)
	if err != nil {
		return services.UserDetail{}, err
	}
	if len(command.Features) == 0 || command.DurationDays < 1 || command.DurationDays > 90 {
		return services.UserDetail{}, usersErrors.ValidationFailedFor("features", "pick at least one feature and a duration of 1 to 90 days")
	}
	for _, feature := range command.Features {
		if !slices.Contains(AllowedFeatures, feature) {
			return services.UserDetail{}, usersErrors.ValidationFailedFor("features", "contains an unknown feature")
		}
	}
	target, err := services.LoadTarget(ctx, handler.Container, command.TargetId)
	if err != nil {
		return services.UserDetail{}, err
	}
	if target.Account.Status == "deleted" {
		return services.UserDetail{}, usersErrors.Conflict("INVALID_STATUS", "This account has been deleted.")
	}
	now := handler.Container.Now()
	endsAt := now.Add(time.Duration(command.DurationDays) * 24 * time.Hour)
	features := slices.Compact(slices.Sorted(slices.Values(command.Features)))
	err = handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		previous, err := tx.AccountRestriction.Query().Where(accountrestriction.AccountID(target.Account.ID), accountrestriction.LiftedAtIsNil(), accountrestriction.EndsAtGT(now)).All(ctx)
		if err != nil {
			return err
		}
		restriction, err := tx.AccountRestriction.Create().SetAccountID(target.Account.ID).SetFeatures(features).SetReason(reason).SetEndsAt(endsAt).SetCreatedBy(command.Actor.Id).SetCreatedByName(command.Actor.Name).Save(ctx)
		if err != nil {
			return err
		}
		if err := usersevents.EnqueueOutboxEventInTransaction(ctx, tx, accountevents.AccountRestrictedType, target.Account.ID.String(), now, accountevents.AccountRestrictedData{
			AccountId: target.Account.ID.String(), CaseId: restriction.ID.String(), Reason: reason, Policy: "Community Guidelines", PolicyUrl: accountevents.CommunityGuidelinesUrl, AppealUrl: accountevents.AppealUrl,
			Restrictions: features, Until: endsAt.UTC().Format(time.RFC3339),
		}); err != nil {
			return err
		}
		return usersservices.RecordStaffAuditEntry(ctx, command.Actor, usersservices.StaffAuditEntry{
			Action: "user.restricted", SubjectType: "user", SubjectId: target.Account.ID.String(), SubjectLabel: target.Label(), Reason: reason,
			Before: map[string]any{"activeRestrictions": len(previous)}, After: map[string]any{"features": features, "endsAt": endsAt.UTC().Format(time.RFC3339)},
		})
	})
	if err != nil {
		return services.UserDetail{}, err
	}
	return services.BuildUserDetail(ctx, handler.Container, target)
}
