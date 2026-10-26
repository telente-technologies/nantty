package transitionlegalversion

import (
	"context"

	"nantty/modules/users/src/container"
	usersErrors "nantty/modules/users/src/errors"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/legalversion"
	accountservices "nantty/modules/users/src/modules/accountEnforcement/services"
	"nantty/modules/users/src/modules/legal/services"
	usersservices "nantty/modules/users/src/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (services.VersionView, error) {
	reason := ""
	if command.Action == ActionReturn {
		var err error
		if reason, err = accountservices.RequireReason(command.Reason); err != nil {
			return services.VersionView{}, err
		}
	}
	var updated *ent.LegalVersion
	err := handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		version, err := services.LoadVersionInTransaction(ctx, tx, command.VersionId, true)
		if err != nil {
			return err
		}
		now := handler.Container.Now()
		action := ""
		switch command.Action {
		case ActionSubmit:
			if version.Status != legalversion.StatusDraft {
				return usersErrors.Conflict("NOT_DRAFT", "Only a draft can be submitted.")
			}
			updated, err = version.Update().SetStatus(legalversion.StatusInReview).SetSubmittedBy(command.Actor.Id).SetSubmittedByName(command.Actor.Name).SetSubmittedAt(now).SetReturnedReason("").Save(ctx)
			action = "legal_version.submitted_for_review"
		case ActionReturn:
			if version.Status != legalversion.StatusInReview {
				return usersErrors.Conflict("NOT_IN_REVIEW", "Only a version in review can be returned.")
			}
			updated, err = version.Update().SetStatus(legalversion.StatusDraft).SetReturnedReason(reason).Save(ctx)
			action = "legal_version.returned_to_draft"
		default:
			return usersErrors.NotFound("That action does not exist.")
		}
		if err != nil {
			return err
		}
		return usersservices.RecordStaffAuditEntry(ctx, command.Actor, usersservices.StaffAuditEntry{
			Action: action, SubjectType: "legal_version", SubjectId: version.ID.String(), SubjectLabel: version.DocumentKey, Reason: reason,
			Before: map[string]any{"status": version.Status}, After: map[string]any{"status": updated.Status},
		})
	})
	if err != nil {
		return services.VersionView{}, err
	}
	return services.ConvertVersionToView(updated), nil
}
