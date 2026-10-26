package reclaimwithheldusername

import (
	"context"

	"nantty/modules/users/src/container"
	usersErrors "nantty/modules/users/src/errors"
	usersevents "nantty/modules/users/src/events"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/profilecheckmark"
	"nantty/modules/users/src/generated/ent/usernamechange"
	"nantty/modules/users/src/generated/ent/usernamehold"
	accountevents "nantty/modules/users/src/modules/accountEnforcement/events"
	"nantty/modules/users/src/modules/accountEnforcement/services"
	usersservices "nantty/modules/users/src/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (services.UserDetail, error) {
	reason, err := services.RequireReason(command.Reason)
	if err != nil {
		return services.UserDetail{}, err
	}
	if command.Mode != ModeRestoreToOwner && command.Mode != ModeAssignToClaimant {
		return services.UserDetail{}, usersErrors.ValidationFailedFor("mode", "must be RESTORE_TO_OWNER or ASSIGN_TO_CLAIMANT")
	}
	owner, err := services.LoadTarget(ctx, handler.Container, command.TargetId)
	if err != nil {
		return services.UserDetail{}, err
	}
	hold, err := handler.Container.Client.UsernameHold.Query().Where(usernamehold.HeldForAccountID(owner.Account.ID), usernamehold.KindEQ(usernamehold.KindWithheld)).First(ctx)
	if ent.IsNotFound(err) {
		return services.UserDetail{}, usersErrors.Conflict("NOT_WITHHELD", "No username is withheld from this account.")
	}
	if err != nil {
		return services.UserDetail{}, err
	}
	recipient := owner
	reasonForRecipient := usernamechange.ReasonAdminRestored
	if command.Mode == ModeAssignToClaimant {
		if recipient, err = handler.loadVerifiedClaimant(ctx, owner, command.ClaimantUserId); err != nil {
			return services.UserDetail{}, err
		}
		reasonForRecipient = usernamechange.ReasonAdminReclaimedTo
	}
	previous := recipient.Account.Username
	if err := services.MoveUsername(ctx, handler.Container, recipient.Account.ID, previous, hold.Username, reasonForRecipient, recipient.Account.ID != owner.Account.ID); err != nil {
		return services.UserDetail{}, err
	}
	err = handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		if err := tx.UsernameHold.DeleteOneID(hold.ID).Exec(ctx); err != nil {
			return err
		}
		if recipient.Account.ID == owner.Account.ID {
			return nil
		}
		return usersevents.EnqueueOutboxEventInTransaction(ctx, tx, accountevents.UsernameReassignedType, hold.Username, handler.Container.Now(), accountevents.UsernameReassignedData{
			Username: hold.Username, FromAccountId: owner.Account.ID.String(), FromNewUsername: owner.Account.Username, ToAccountId: recipient.Account.ID.String(), ToPreviousUserna: previous, Reason: reason,
		})
	})
	if err != nil {
		return services.UserDetail{}, err
	}
	if err := usersservices.RecordStaffAuditEntry(ctx, command.Actor, usersservices.StaffAuditEntry{
		Action: "username.reclaimed", SubjectType: "user", SubjectId: owner.Account.ID.String(), SubjectLabel: hold.Username, Reason: reason,
		Before: map[string]any{"withheldUsername": hold.Username}, After: map[string]any{"mode": command.Mode, "recipientUserId": recipient.Account.ID.String()},
	}); err != nil {
		return services.UserDetail{}, err
	}
	refreshed, err := services.LoadTarget(ctx, handler.Container, owner.Account.ID.String())
	if err != nil {
		return services.UserDetail{}, err
	}
	return services.BuildUserDetail(ctx, handler.Container, refreshed)
}

func (handler Handler) loadVerifiedClaimant(ctx context.Context, owner services.Target, claimantId string) (services.Target, error) {
	claimant, err := services.LoadTarget(ctx, handler.Container, claimantId)
	if err != nil || claimant.Account.ID == owner.Account.ID || claimant.Account.Status != "active" || claimant.Profile == nil {
		return services.Target{}, usersErrors.ValidationFailedFor("claimantUserId", "must be a different, active account")
	}
	verified, err := handler.Container.Client.ProfileCheckmark.Query().Where(profilecheckmark.ProfileID(claimant.Profile.ID),
		profilecheckmark.StatusIn(profilecheckmark.StatusVerified, profilecheckmark.StatusGrace)).Exist(ctx)
	if err != nil {
		return services.Target{}, err
	}
	if !verified {
		return services.Target{}, usersErrors.UnprocessableWithCode("CLAIMANT_NOT_VERIFIED", "Only a verified claimant can receive a withheld username.")
	}
	return claimant, nil
}
