package revokeaccountcheckmarks

import (
	"context"

	"zudomart/modules/users/src/container"
	"zudomart/modules/users/src/generated/ent"
	"zudomart/modules/users/src/generated/ent/profilecheckmark"
	"zudomart/modules/users/src/generated/ent/verificationapplication"
	accountservices "zudomart/modules/users/src/modules/accountEnforcement/services"
	transitionverification "zudomart/modules/users/src/modules/checkmarks/commands/transitionVerification"
	"zudomart/modules/users/src/modules/checkmarks/services"
	usersservices "zudomart/modules/users/src/services"
	"zudomart/modules/users/src/types"
)

type Command struct {
	Actor    types.StaffActor
	TargetId string
	Reason   string
	Source   string
	CaseId   string
}

type Result struct {
	AccountId      string `json:"accountId"`
	Revoked        int    `json:"revoked"`
	AlreadyApplied bool   `json:"alreadyApplied"`
}

var liveStatuses = []profilecheckmark.Status{profilecheckmark.StatusVerified, profilecheckmark.StatusGrace, profilecheckmark.StatusSuspended}

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (Result, error) {
	reason, err := accountservices.RequireReason(command.Reason)
	if err != nil {
		return Result{}, err
	}
	target, err := accountservices.LoadTarget(ctx, handler.Container, command.TargetId)
	if err != nil {
		return Result{}, err
	}
	result := Result{AccountId: target.Account.ID.String()}
	live, err := handler.Container.Client.ProfileCheckmark.Query().Where(profilecheckmark.AccountID(target.Account.ID), profilecheckmark.StatusIn(liveStatuses...)).All(ctx)
	if err != nil {
		return result, err
	}
	for _, checkmark := range live {
		if err := handler.revoke(ctx, command, checkmark, reason); err != nil {
			return result, err
		}
		result.Revoked++
	}
	result.AlreadyApplied = result.Revoked == 0
	return result, nil
}

func (handler Handler) revoke(ctx context.Context, command Command, checkmark *ent.ProfileCheckmark, reason string) error {
	if checkmark.Source == profilecheckmark.SourceApplication && checkmark.SourceID != nil {
		revocable, err := handler.Container.Client.VerificationApplication.Query().Where(verificationapplication.ID(*checkmark.SourceID),
			verificationapplication.StatusIn(verificationapplication.StatusApproved, verificationapplication.StatusSuspended)).Exist(ctx)
		if err != nil {
			return err
		}
		if revocable {
			return transitionverification.Handler{Container: handler.Container}.Execute(ctx, transitionverification.Command{
				Actor: command.Actor, ApplicationId: checkmark.SourceID.String(), Action: transitionverification.ActionRevoke, Reason: reason,
			})
		}
	}
	return handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		profile, err := tx.Profile.Get(ctx, checkmark.ProfileID)
		if err != nil {
			return err
		}
		if _, err := services.SetProfileCheckmarkInTransaction(ctx, tx, handler.Container.Now(), services.CheckmarkChange{
			Profile: profile, Color: checkmark.Color, Status: profilecheckmark.StatusRevoked, Source: checkmark.Source, SourceId: checkmark.SourceID,
		}); err != nil {
			return err
		}
		return usersservices.RecordStaffAuditEntry(ctx, command.Actor, usersservices.StaffAuditEntry{
			Action: "checkmark.revoked_by_enforcement", SubjectType: "user", SubjectId: checkmark.AccountID.String(), SubjectLabel: profile.Handle, Reason: reason,
			Before: map[string]any{"status": checkmark.Status, "color": checkmark.Color, "source": checkmark.Source}, After: map[string]any{"status": "revoked", "caseId": command.CaseId, "enforcementSource": command.Source},
		})
	})
}
