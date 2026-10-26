package services

import (
	"context"
	"database/sql"

	ledgermodels "nantty/modules/ledger/src/modules/journal/models"
	"nantty/modules/payments/src/modules/gateway/models"
)

type ledgerMovementHandler struct {
	gateway   *PaymentGateway
	succeeded func(movement models.FinishedMovement) []ledgermodels.JournalLineRequest
	failed    func(movement models.FinishedMovement) []ledgermodels.JournalLineRequest
}

func (handler ledgerMovementHandler) post(ctx context.Context, transaction *sql.Tx, movement models.FinishedMovement, suffix string, lines []ledgermodels.JournalLineRequest) error {
	if len(lines) == 0 {
		return nil
	}
	_, err := handler.gateway.Container.Ledger.PostBalancedJournalEntry(ctx, transaction, ledgermodels.JournalEntryRequest{
		Reference: "movement-" + suffix + ":" + movement.Reference, Kind: "providerMovement." + movement.Kind + "." + suffix, ExternalReference: movement.Reference,
		Description: "Wallet movement " + movement.Kind + " " + suffix, Metadata: map[string]any{"movementId": movement.MovementId.String(), "subjectId": movement.SubjectId}, Lines: lines,
	})
	return err
}

func (handler ledgerMovementHandler) HandleMovementSucceeded(ctx context.Context, transaction *sql.Tx, movement models.FinishedMovement) error {
	return handler.post(ctx, transaction, movement, "succeeded", handler.succeeded(movement))
}

func (handler ledgerMovementHandler) HandleMovementFailed(ctx context.Context, transaction *sql.Tx, movement models.FinishedMovement) error {
	return handler.post(ctx, transaction, movement, "failed", handler.failed(movement))
}

func outgoingOf(movement models.FinishedMovement) ledgermodels.AccountRef {
	return ledgermodels.WalletOutgoingAccount(movement.FromUserId, movement.Currency)
}

func moveLines(from, to ledgermodels.AccountRef, amountMinor int64) []ledgermodels.JournalLineRequest {
	return []ledgermodels.JournalLineRequest{{Account: from, Direction: ledgermodels.Debit, AmountMinor: amountMinor}, {Account: to, Direction: ledgermodels.Credit, AmountMinor: amountMinor}}
}

func (gateway *PaymentGateway) registerWalletMovementHandlers() {
	gateway.RegisterMovementOutcomeHandler(models.MovementFeeSweep, ledgerMovementHandler{gateway: gateway,
		succeeded: func(movement models.FinishedMovement) []ledgermodels.JournalLineRequest {
			return moveLines(outgoingOf(movement), ledgermodels.PlatformDepositFeeRevenueAccount(movement.Currency), movement.AmountMinor)
		},
		failed: func(movement models.FinishedMovement) []ledgermodels.JournalLineRequest {
			return moveLines(outgoingOf(movement), ledgermodels.WalletDepositHoldAccount(movement.FromUserId, movement.Currency), movement.AmountMinor)
		},
	})
	gateway.RegisterMovementOutcomeHandler(models.MovementWalletPayment, ledgerMovementHandler{gateway: gateway,
		succeeded: func(movement models.FinishedMovement) []ledgermodels.JournalLineRequest {
			return moveLines(outgoingOf(movement), ledgermodels.PaymentsAwaitingApplicationAccount(movement.Currency), movement.AmountMinor)
		},
		failed: func(movement models.FinishedMovement) []ledgermodels.JournalLineRequest {
			lines := moveLines(outgoingOf(movement), ledgermodels.WalletAvailableAccount(movement.FromUserId, movement.Currency), movement.AmountMinor)
			return append(lines, moveLines(ledgermodels.WalletDebtAccount(movement.FromUserId, movement.Currency), ledgermodels.PaymentsAwaitingApplicationAccount(movement.Currency), movement.AmountMinor)...)
		},
	})
	gateway.RegisterMovementOutcomeHandler(models.MovementChargebackRecovery, ledgerMovementHandler{gateway: gateway,
		succeeded: func(movement models.FinishedMovement) []ledgermodels.JournalLineRequest {
			return moveLines(outgoingOf(movement), ledgermodels.PlatformChargebackReceivableAccount(gateway.walletProviderName(), movement.Currency), movement.AmountMinor)
		},
		failed: func(movement models.FinishedMovement) []ledgermodels.JournalLineRequest {
			lines := moveLines(outgoingOf(movement), ledgermodels.WalletAvailableAccount(movement.FromUserId, movement.Currency), movement.AmountMinor)
			return append(lines, moveLines(ledgermodels.WalletDebtAccount(movement.FromUserId, movement.Currency), ledgermodels.PlatformChargebackReceivableAccount(gateway.walletProviderName(), movement.Currency), movement.AmountMinor)...)
		},
	})
	gateway.RegisterMovementOutcomeHandler(MovementWalletCredit, ledgerMovementHandler{gateway: gateway,
		succeeded: func(movement models.FinishedMovement) []ledgermodels.JournalLineRequest {
			return moveLines(ledgermodels.WalletInboundAccount(movement.ToUserId, movement.SubjectId, movement.Currency), ledgermodels.WalletAvailableAccount(movement.ToUserId, movement.Currency), movement.AmountMinor)
		},
		failed: func(models.FinishedMovement) []ledgermodels.JournalLineRequest { return nil },
	})
	gateway.RegisterMovementOutcomeHandler(models.MovementCreatorPayout, ledgerMovementHandler{gateway: gateway,
		succeeded: func(movement models.FinishedMovement) []ledgermodels.JournalLineRequest {
			return moveLines(ledgermodels.CreatorEarningsPayableAccount(movement.ToUserId, movement.Currency), ledgermodels.WalletAvailableAccount(movement.ToUserId, movement.Currency), movement.AmountMinor)
		},
		failed: func(models.FinishedMovement) []ledgermodels.JournalLineRequest { return nil },
	})
}
