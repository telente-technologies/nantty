package revokelifetimecheckmark

import (
	"context"

	"github.com/google/uuid"

	"nantty/modules/users/src/container"
	usersErrors "nantty/modules/users/src/errors"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/checkmarkgrant"
	"nantty/modules/users/src/generated/ent/profilecheckmark"
	"nantty/modules/users/src/generated/ent/verificationapplication"
	accountservices "nantty/modules/users/src/modules/accountEnforcement/services"
	"nantty/modules/users/src/modules/checkmarks/services"
	usersservices "nantty/modules/users/src/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (services.GrantView, error) {
	reason, err := accountservices.RequireReason(command.Reason)
	if err != nil {
		return services.GrantView{}, err
	}
	grantId, parseErr := uuid.Parse(command.GrantId)
	if parseErr != nil {
		return services.GrantView{}, usersErrors.NotFound("That grant was not found.")
	}
	var revoked *ent.CheckmarkGrant
	err = handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		grant, err := tx.CheckmarkGrant.Query().Where(checkmarkgrant.ID(grantId)).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			return usersErrors.NotFound("That grant was not found.")
		}
		if err != nil {
			return err
		}
		if err := services.RequireSuperadminForBlack(command.Actor, string(grant.Color)); err != nil {
			return err
		}
		if grant.RevokedAt != nil {
			return usersErrors.Conflict("ALREADY_REVOKED", "This grant was already revoked.")
		}
		now := handler.Container.Now()
		if revoked, err = grant.Update().SetRevokedAt(now).SetRevokedByName(command.Actor.Name).SetRevokedReason(reason).Save(ctx); err != nil {
			return err
		}
		if err := handler.restoreEarlierVerification(ctx, tx, grant); err != nil {
			return err
		}
		return usersservices.RecordStaffAuditEntry(ctx, command.Actor, usersservices.StaffAuditEntry{
			Action: "checkmark.lifetime_revoked", SubjectType: "user", SubjectId: grant.AccountID.String(), SubjectLabel: grant.AccountID.String(), Reason: reason, Before: map[string]any{"grantId": grant.ID, "color": grant.Color},
		})
	})
	if err != nil {
		return services.GrantView{}, err
	}
	return services.BuildGrantView(ctx, handler.Container, revoked)
}

func (handler Handler) restoreEarlierVerification(ctx context.Context, tx *ent.Tx, grant *ent.CheckmarkGrant) error {
	profile, err := tx.Profile.Get(ctx, grant.ProfileID)
	if err != nil {
		return err
	}
	status, source, sourceId := profilecheckmark.StatusRevoked, profilecheckmark.SourceLifetimeGrant, &grant.ID
	earlier, err := tx.VerificationApplication.Query().Where(verificationapplication.ProfileID(grant.ProfileID), verificationapplication.StatusEQ(verificationapplication.StatusApproved)).Order(ent.Desc(verificationapplication.FieldID)).First(ctx)
	if err == nil {
		status, source, sourceId = profilecheckmark.StatusVerified, profilecheckmark.SourceApplication, &earlier.ID
	} else if !ent.IsNotFound(err) {
		return err
	}
	_, err = services.SetProfileCheckmarkInTransaction(ctx, tx, handler.Container.Now(), services.CheckmarkChange{Profile: profile, Color: profilecheckmark.Color(grant.Color), Status: status, Source: source, SourceId: sourceId})
	return err
}
