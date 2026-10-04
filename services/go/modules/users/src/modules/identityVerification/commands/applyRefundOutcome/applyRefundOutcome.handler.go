package applyrefundoutcome

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/users/src/container"
	usersevents "zudomart/modules/users/src/events"
	"zudomart/modules/users/src/generated/ent"
	"zudomart/modules/users/src/generated/ent/verificationcase"
	verificationevents "zudomart/modules/users/src/modules/identityVerification/events"
	"zudomart/modules/users/src/modules/identityVerification/services"
)

var refundStatusByEvent = map[string]verificationcase.RefundStatus{
	"verificationRefund.succeeded":                 verificationcase.RefundStatusRefunded,
	"verificationRefund.notCharged":                verificationcase.RefundStatusNotCharged,
	"verificationRefund.failed":                    verificationcase.RefundStatusFailed,
	"verificationRefund.manualStoreRefundRequired": verificationcase.RefundStatusManualStoreRefund,
}

type Handler struct {
	Container *container.Container
}

// Execute records how the refund went. For a plan that keeps running the rejection email waits for this event,
// because only billing knows how much of the payment belonged to the checkmark.
func (handler Handler) Execute(ctx context.Context, command Command) error {
	status, known := refundStatusByEvent[command.EventType]
	caseId, err := uuid.Parse(command.CaseId)
	if !known || err != nil {
		return nil
	}
	return handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		row, err := tx.VerificationCase.Query().Where(verificationcase.ID(caseId)).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) || (err == nil && row.RefundStatus != verificationcase.RefundStatusRequested && row.RefundStatus != verificationcase.RefundStatusFailed) {
			return nil
		}
		if err != nil {
			return err
		}
		if err := row.Update().SetRefundStatus(status).Exec(ctx); err != nil {
			return err
		}
		if row.RefundStatus != verificationcase.RefundStatusRequested || services.RefundScopeFor(row.PlanCode) != services.RefundScopeCheckmarkShare {
			return nil
		}
		profile, err := tx.Profile.Get(ctx, row.ProfileID)
		if err != nil {
			return err
		}
		now := handler.Container.Now()
		notice := services.ShareRefundNotice(profile, row, command.EventType, command.RefundAmount, now)
		return usersevents.EnqueueOutboxEventInTransaction(ctx, tx, verificationevents.VerificationRejectedNoticeType, profile.AccountID.String(), now, notice)
	})
}
