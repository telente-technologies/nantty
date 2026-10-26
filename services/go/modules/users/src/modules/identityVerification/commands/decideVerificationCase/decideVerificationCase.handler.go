package decideverificationcase

import (
	"context"

	"github.com/google/uuid"

	"nantty/modules/users/src/container"
	usersErrors "nantty/modules/users/src/errors"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/verificationcase"
	accountservices "nantty/modules/users/src/modules/accountEnforcement/services"
	"nantty/modules/users/src/modules/identityVerification/services"
	usersservices "nantty/modules/users/src/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (services.CaseView, error) {
	reason, err := accountservices.RequireReason(command.Reason)
	if err != nil {
		return services.CaseView{}, err
	}
	caseId, parseErr := uuid.Parse(command.CaseId)
	if parseErr != nil || (command.Action != ActionApprove && command.Action != ActionReject) {
		return services.CaseView{}, usersErrors.NotFound("That verification was not found.")
	}
	var decided *ent.VerificationCase
	err = handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		row, err := tx.VerificationCase.Query().Where(verificationcase.ID(caseId)).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			return usersErrors.NotFound("That verification was not found.")
		}
		if err != nil {
			return err
		}
		if !services.IsCaseOpen(row.Status) {
			return usersErrors.Conflict("ALREADY_DECIDED", "This verification has already been decided.")
		}
		now := handler.Container.Now()
		if command.Action == ActionApprove {
			decided, err = services.ApproveCaseInTransaction(ctx, tx, now, row, command.Actor.Name, reason, false)
		} else {
			decided, err = services.RejectCaseInTransaction(ctx, tx, now, row, command.Actor.Name, reason)
		}
		if err != nil {
			return err
		}
		return usersservices.RecordStaffAuditEntry(ctx, command.Actor, usersservices.StaffAuditEntry{
			Action: "identityVerification." + command.Action + "d", SubjectType: "verification_case", SubjectId: row.ID.String(), SubjectLabel: row.AccountID.String(), Reason: reason,
			Before: map[string]any{"status": row.Status}, After: map[string]any{"status": decided.Status, "refundStatus": decided.RefundStatus, "color": row.Color},
		})
	})
	if err != nil {
		return services.CaseView{}, err
	}
	return services.ConvertCaseToView(decided, true), nil
}
