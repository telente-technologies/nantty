package createlegalversion

import (
	"context"

	"nantty/modules/users/src/container"
	usersErrors "nantty/modules/users/src/errors"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/legalversion"
	"nantty/modules/users/src/modules/legal/services"
	usersservices "nantty/modules/users/src/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (services.VersionView, error) {
	if _, known := services.DefinitionOf(command.DocumentKey); !known {
		return services.VersionView{}, usersErrors.NotFound("That document does not exist.")
	}
	if err := services.ValidateVersionBody(command.BodyMarkdown, command.ChangeSummary); err != nil {
		return services.VersionView{}, err
	}
	now := handler.Container.Now()
	effectiveAt, err := services.ResolveEffectiveAt(command.EffectiveAt, command.IsMaterialChange, now)
	if err != nil {
		return services.VersionView{}, err
	}
	var created *ent.LegalVersion
	err = handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		if open, err := tx.LegalVersion.Query().Where(legalversion.DocumentKey(command.DocumentKey), legalversion.StatusIn(legalversion.StatusDraft, legalversion.StatusInReview)).Exist(ctx); err != nil || open {
			return usersErrors.OrConflict(err, "OPEN_VERSION_EXISTS", "This document already has a draft or a version in review.")
		}
		latest, err := tx.LegalVersion.Query().Where(legalversion.DocumentKey(command.DocumentKey)).Order(ent.Desc(legalversion.FieldVersionNumber)).First(ctx)
		next := 1
		if err == nil {
			next = latest.VersionNumber + 1
		} else if !ent.IsNotFound(err) {
			return err
		}
		create := tx.LegalVersion.Create().SetDocumentKey(command.DocumentKey).SetVersionNumber(next).SetBodyMarkdown(command.BodyMarkdown).SetChangeSummary(command.ChangeSummary).
			SetEffectiveAt(effectiveAt).SetEffectiveAtIsDefault(command.EffectiveAt == "").SetIsMaterialChange(command.IsMaterialChange).SetIsFlaggedForLegalReview(command.IsMaterialChange).SetCreatedBy(command.Actor.Id).SetCreatedByName(command.Actor.Name)
		if command.RolledBackFrom != nil {
			create.SetRolledBackFromVersionNumber(*command.RolledBackFrom)
		}
		if created, err = create.Save(ctx); err != nil {
			return err
		}
		action := "legal_version.created"
		if command.RolledBackFrom != nil {
			action = "legal_version.rolled_back"
		}
		return usersservices.RecordStaffAuditEntry(ctx, command.Actor, usersservices.StaffAuditEntry{
			Action: action, SubjectType: "legal_version", SubjectId: created.ID.String(), SubjectLabel: command.DocumentKey, Reason: command.ChangeSummary,
			After: map[string]any{"versionNumber": next, "isMaterialChange": command.IsMaterialChange, "effectiveAt": effectiveAt},
		})
	})
	if ent.IsConstraintError(err) {
		return services.VersionView{}, usersErrors.Conflict("OPEN_VERSION_EXISTS", "This document already has a draft or a version in review.")
	}
	if err != nil {
		return services.VersionView{}, err
	}
	return services.ConvertVersionToView(created), nil
}
