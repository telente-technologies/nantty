package grantlifetimecheckmark

import (
	"context"
	"strings"

	"nantty/modules/users/src/container"
	usersErrors "nantty/modules/users/src/errors"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/checkmarkgrant"
	"nantty/modules/users/src/generated/ent/profile"
	"nantty/modules/users/src/generated/ent/profilecheckmark"
	accountservices "nantty/modules/users/src/modules/accountEnforcement/services"
	"nantty/modules/users/src/modules/checkmarks/services"
	usersservices "nantty/modules/users/src/services"
	"nantty/platform/usernames"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (services.GrantView, error) {
	reason, err := accountservices.RequireReason(command.Reason)
	if err != nil {
		return services.GrantView{}, err
	}
	color := strings.ToLower(command.Color)
	if err := services.RequireSuperadminForBlack(command.Actor, color); err != nil {
		return services.GrantView{}, err
	}
	target, err := handler.Container.Client.Profile.Query().Where(profile.Handle(usernames.NormalizeRequestedUsername(command.Username))).Only(ctx)
	if ent.IsNotFound(err) {
		return services.GrantView{}, usersErrors.NotFound("That username was not found.")
	}
	if err != nil {
		return services.GrantView{}, err
	}
	if string(services.ColorForProfileType(target.ProfileType)) != color {
		return services.GrantView{}, usersErrors.ValidationFailedFor("color", "does not match the profile type")
	}
	var created *ent.CheckmarkGrant
	err = handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		if active, err := tx.CheckmarkGrant.Query().Where(checkmarkgrant.ProfileID(target.ID), checkmarkgrant.RevokedAtIsNil()).Exist(ctx); err != nil || active {
			return usersErrors.OrConflict(err, "ALREADY_GRANTED", "This profile already has a lifetime checkmark.")
		}
		if created, err = tx.CheckmarkGrant.Create().SetProfileID(target.ID).SetAccountID(target.AccountID).SetColor(checkmarkgrant.Color(color)).SetReason(reason).SetGrantedBy(command.Actor.Id).SetGrantedByName(command.Actor.Name).Save(ctx); err != nil {
			return err
		}
		if _, err = services.SetProfileCheckmarkInTransaction(ctx, tx, handler.Container.Now(), services.CheckmarkChange{
			Profile: target, Color: profilecheckmark.Color(color), Status: profilecheckmark.StatusVerified, Source: profilecheckmark.SourceLifetimeGrant, SourceId: &created.ID, ReserveHandle: color == "black",
		}); err != nil {
			return err
		}
		return usersservices.RecordStaffAuditEntry(ctx, command.Actor, usersservices.StaffAuditEntry{
			Action: "checkmark.lifetime_granted", SubjectType: "user", SubjectId: target.AccountID.String(), SubjectLabel: target.Handle, Reason: reason, After: map[string]any{"color": color, "grantId": created.ID},
		})
	})
	if err != nil {
		return services.GrantView{}, err
	}
	return services.BuildGrantView(ctx, handler.Container, created)
}
