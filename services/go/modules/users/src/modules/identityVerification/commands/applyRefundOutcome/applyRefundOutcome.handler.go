package applyrefundoutcome

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/users/src/container"
	"zudomart/modules/users/src/generated/ent/verificationcase"
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

func (handler Handler) Execute(ctx context.Context, command Command) error {
	status, known := refundStatusByEvent[command.EventType]
	caseId, err := uuid.Parse(command.CaseId)
	if !known || err != nil {
		return nil
	}
	return handler.Container.Client.VerificationCase.Update().
		Where(verificationcase.ID(caseId), verificationcase.RefundStatusIn(verificationcase.RefundStatusRequested, verificationcase.RefundStatusFailed)).
		SetRefundStatus(status).Exec(ctx)
}
