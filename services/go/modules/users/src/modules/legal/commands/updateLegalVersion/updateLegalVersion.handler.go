package updatelegalversion

import (
	"context"

	"zudomart/modules/users/src/container"
	usersErrors "zudomart/modules/users/src/errors"
	"zudomart/modules/users/src/generated/ent"
	"zudomart/modules/users/src/generated/ent/legalversion"
	"zudomart/modules/users/src/modules/legal/services"
	usersservices "zudomart/modules/users/src/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (services.VersionView, error) {
	if err := services.ValidateVersionBody(command.BodyMarkdown, command.ChangeSummary); err != nil {
		return services.VersionView{}, err
	}
	effectiveAt, err := services.ResolveEffectiveAt(command.EffectiveAt, command.IsMaterialChange, handler.Container.Now())
	if err != nil {
		return services.VersionView{}, err
	}
	var updated *ent.LegalVersion
	err = handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		version, err := services.LoadVersionInTransaction(ctx, tx, command.VersionId, true)
		if err != nil {
			return err
		}
		if version.Status != legalversion.StatusDraft {
			return usersErrors.Conflict("NOT_DRAFT", "Only a draft can be edited.")
		}
		if updated, err = version.Update().SetBodyMarkdown(command.BodyMarkdown).SetChangeSummary(command.ChangeSummary).SetEffectiveAt(effectiveAt).SetEffectiveAtIsDefault(command.EffectiveAt == "").SetIsMaterialChange(command.IsMaterialChange).SetIsFlaggedForLegalReview(command.IsMaterialChange).Save(ctx); err != nil {
			return err
		}
		return usersservices.RecordStaffAuditEntry(ctx, command.Actor, usersservices.StaffAuditEntry{
			Action: "legal_version.updated", SubjectType: "legal_version", SubjectId: version.ID.String(), SubjectLabel: version.DocumentKey, Reason: command.ChangeSummary,
			Before: map[string]any{"effectiveAt": version.EffectiveAt, "isMaterialChange": version.IsMaterialChange}, After: map[string]any{"effectiveAt": effectiveAt, "isMaterialChange": command.IsMaterialChange},
		})
	})
	if err != nil {
		return services.VersionView{}, err
	}
	return services.ConvertVersionToView(updated), nil
}
