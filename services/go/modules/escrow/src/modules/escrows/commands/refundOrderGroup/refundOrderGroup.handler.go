package refundordergroup

import (
	"context"
	"database/sql"
	"net/http"

	"zudomart/modules/escrow/src/generated/ent/escrow"
	"zudomart/modules/escrow/src/modules/escrows"
	"zudomart/modules/escrow/src/modules/escrows/dtos"
	"zudomart/modules/escrow/src/modules/escrows/services"
	ledgerutils "zudomart/modules/ledger/src/utils"
	"zudomart/platform/httpserver"
)

var (
	ErrRefundDoesNotMatchOrder   = httpserver.NewApiError(http.StatusUnprocessableEntity, "REFUND_DOES_NOT_MATCH_ORDER", "The refund does not match this order.")
	ErrPartialRefundAfterRelease = httpserver.NewApiError(http.StatusConflict, "PARTIAL_REFUND_AFTER_RELEASE", "A released order can only be refunded in full.")
)

type Handler struct {
	Application *escrows.Application
}

func (handler Handler) Execute(ctx context.Context, command Command) (dtos.EscrowDetailDto, bool, error) {
	application := handler.Application
	var settlement services.EscrowSettlementResult
	detail, replayed, err := ledgerutils.RunIdempotentMoneyCommand(ctx, application.Container.Resources.Database, application.Container.Idempotency, ledgerutils.IdempotentCommand[dtos.EscrowDetailDto]{
		Scope: "commerce:orderGroup.refund", Key: ledgerutils.HashRequestFingerprint(command.OrderGroupId, command.Reason)[:64],
		RequestHash: ledgerutils.HashRequestFingerprint(command.OrderGroupId, command.AmountMinor, command.Currency, command.Reason),
		Execute: func(ctx context.Context, transaction *sql.Tx) (dtos.EscrowDetailDto, error) {
			held, err := application.Escrows.LockEscrowForOrder(ctx, application.Container.Client(transaction), command.OrderGroupId)
			if err != nil {
				return dtos.EscrowDetailDto{}, err
			}
			if held.BuyerUserID != command.BuyerAccountId || held.Currency != command.Currency || command.AmountMinor <= 0 || command.AmountMinor > held.AmountMinor {
				return dtos.EscrowDetailDto{}, ErrRefundDoesNotMatchOrder
			}
			actor := services.EscrowActor{Type: "commerce", Id: command.StoreId}
			switch {
			case command.AmountMinor == held.AmountMinor:
				settlement, err = application.Escrows.RefundEscrowInTransaction(ctx, transaction, command.OrderGroupId, command.Reason, actor)
			case held.Status == escrow.StatusReleased:
				return dtos.EscrowDetailDto{}, ErrPartialRefundAfterRelease
			default:
				settlement, err = application.Escrows.ResolveEscrowPartiallyInTransaction(ctx, transaction, command.OrderGroupId, command.AmountMinor, command.Reason, actor)
			}
			if err != nil {
				return dtos.EscrowDetailDto{}, err
			}
			return services.ConvertEscrowToDetail(settlement.Escrow, application.Container.Policy(ctx).AutoReleasePeriod, nil, nil), nil
		},
	})
	return detail, replayed, err
}
