package issueadminrefund

import (
	"context"

	"nantty/modules/orders/src/container"
	ordererrors "nantty/modules/orders/src/errors"
	"nantty/modules/orders/src/generated/ent"
	"nantty/modules/orders/src/modules/adminOrders/dtos"
	"nantty/modules/orders/src/modules/adminOrders/services"
	"nantty/platform/staffaudit"
)

type Handler struct {
	Container *container.Container
}

type auditState struct {
	OrderStatus   string `json:"orderStatus"`
	PaymentStatus string `json:"paymentStatus"`
	EscrowStatus  string `json:"escrowStatus"`
	RefundedMinor int64  `json:"refundedMinor"`
}

func (handler Handler) Execute(ctx context.Context, command Command) (dtos.RefundRecord, bool, error) {
	refund := command.Refund
	if replayed, err := services.FindReplayedRefund(ctx, handler.Container, refund); err != nil || replayed != nil {
		return handler.view(ctx, replayed), replayed != nil, err
	}
	group, err := handler.Container.Client.OrderGroup.Get(ctx, refund.OrderId)
	if ent.IsNotFound(err) {
		return dtos.RefundRecord{}, false, ordererrors.OrderNotFound
	}
	if err != nil {
		return dtos.RefundRecord{}, false, err
	}
	escrowStatus := ""
	if group.PaymentStatus == "paid" && handler.Container.Money != nil {
		escrow, err := handler.Container.Money.GetOrderEscrow(ctx, group.ID.String())
		if err != nil {
			return dtos.RefundRecord{}, false, ordererrors.EscrowUnavailable
		}
		escrowStatus = escrow.Status
	}
	if err := services.CheckAdminRefund(group, escrowStatus, refund.AmountMinor, refund.Currency); err != nil {
		return dtos.RefundRecord{}, false, err
	}
	if handler.Container.Audit != nil {
		before := auditState{OrderStatus: group.Status, PaymentStatus: group.PaymentStatus, EscrowStatus: escrowStatus, RefundedMinor: group.RefundedMinor}
		after := map[string]any{"refund": map[string]any{"amountMinor": refund.AmountMinor, "currency": refund.Currency, "source": "manual"}, "refundRequested": true}
		if err := staffaudit.RecordStaffChange(command.Request, handler.Container.Audit, refund.Staff, "refund.issued", "order", group.ID.String(), refund.Reason, before, after); err != nil {
			return dtos.RefundRecord{}, false, ordererrors.AuditUnavailable
		}
	}
	created, err := services.IssueAdminRefund(ctx, handler.Container, refund, escrowStatus)
	if err != nil {
		return dtos.RefundRecord{}, false, err
	}
	return handler.view(ctx, created), false, nil
}

func (handler Handler) view(ctx context.Context, record *ent.RefundRecord) dtos.RefundRecord {
	if record == nil {
		return dtos.RefundRecord{}
	}
	return services.RefundViews(ctx, handler.Container, []*ent.RefundRecord{record})[0]
}
