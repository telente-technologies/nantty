package services

import (
	"context"
	"database/sql"

	"github.com/google/uuid"

	"zudomart/modules/escrow/src/generated/ent"
	"zudomart/modules/escrow/src/generated/ent/escrow"
	ledgermodels "zudomart/modules/ledger/src/modules/journal/models"
	paymentmodels "zudomart/modules/payments/src/modules/gateway/models"
	paymentservices "zudomart/modules/payments/src/modules/gateway/services"
)

type EscrowMovementHandler struct {
	Service EscrowService
	Kind    string
}

func (service EscrowService) RegisterMovementHandlers(payments *paymentservices.PaymentGateway) {
	for _, kind := range []string{paymentmodels.MovementEscrowFundIn, paymentmodels.MovementEscrowRelease, paymentmodels.MovementEscrowCommission,
		paymentmodels.MovementClawback, paymentmodels.MovementClawbackTopUp, MovementDirectSale} {
		payments.RegisterMovementOutcomeHandler(kind, EscrowMovementHandler{Service: service, Kind: kind})
	}
}

func (handler EscrowMovementHandler) escrowOf(ctx context.Context, transaction *sql.Tx, movement paymentmodels.FinishedMovement) (*ent.Escrow, error) {
	id, err := uuid.Parse(movement.SubjectId)
	if err != nil {
		return nil, err
	}
	return handler.Service.Container.Client(transaction).Escrow.Query().Where(escrow.ID(id)).ForUpdate().Only(ctx)
}

func (handler EscrowMovementHandler) post(ctx context.Context, transaction *sql.Tx, held *ent.Escrow, movement paymentmodels.FinishedMovement, suffix string, lines []ledgermodels.JournalLineRequest) error {
	return handler.Service.postEscrowLines(ctx, transaction, held, "movement-"+suffix+":"+movement.Reference, "escrow.movement."+movement.Kind+"."+suffix,
		"Escrow wallet movement "+movement.Kind+" "+suffix, lines)
}

func (handler EscrowMovementHandler) HandleMovementSucceeded(ctx context.Context, transaction *sql.Tx, movement paymentmodels.FinishedMovement) error {
	held, err := handler.escrowOf(ctx, transaction, movement)
	if err != nil {
		return err
	}
	currency := held.Currency
	buyerOutgoing := ledgermodels.WalletOutgoingAccount(held.BuyerUserID, currency)
	switch handler.Kind {
	case paymentmodels.MovementEscrowFundIn:
		if err := handler.post(ctx, transaction, held, movement, "succeeded", moveLines(ledgermodels.WalletInboundEscrowAccount(held.BuyerUserID, held.ID.String(), currency),
			ledgermodels.WalletEscrowLockedAccount(held.BuyerUserID, held.ID.String(), currency), movement.AmountMinor)); err != nil {
			return err
		}
		return held.Update().SetWalletFundedAt(movement.FinishedAt).AddVersion(1).Exec(ctx)
	case paymentmodels.MovementEscrowRelease:
		if err := handler.post(ctx, transaction, held, movement, "succeeded", moveLines(buyerOutgoing, ledgermodels.WalletDepositHoldAccount(held.SellerUserID, currency), movement.AmountMinor)); err != nil {
			return err
		}
		if err := handler.Service.holdSaleInSellerWallet(ctx, transaction, held.SellerUserID, movement.Reference, movement.AmountMinor, currency); err != nil {
			return err
		}
		platform := movement.MetadataAmount("commissionMinor") + movement.MetadataAmount("processingFeeMinor")
		return handler.Service.enqueueCommissionMovement(ctx, transaction, held, platform, movement.Metadata)
	case paymentmodels.MovementEscrowCommission:
		fee := movement.MetadataAmount("processingFeeMinor")
		lines := paymentservices.AppendPositiveLine(nil, buyerOutgoing, ledgermodels.Debit, movement.AmountMinor)
		lines = paymentservices.AppendPositiveLine(lines, ledgermodels.PlatformEscrowFeeRevenueAccount(currency), ledgermodels.Credit, movement.AmountMinor-min(fee, movement.AmountMinor))
		lines = paymentservices.AppendPositiveLine(lines, ledgermodels.PaymentProcessingFeeExpenseAccount(currency), ledgermodels.Credit, min(fee, movement.AmountMinor))
		return handler.post(ctx, transaction, held, movement, "succeeded", lines)
	case paymentmodels.MovementClawback:
		return handler.post(ctx, transaction, held, movement, "succeeded", moveLines(ledgermodels.WalletOutgoingAccount(held.SellerUserID, currency), ledgermodels.WalletAvailableAccount(held.BuyerUserID, currency), movement.AmountMinor))
	case paymentmodels.MovementClawbackTopUp:
		return handler.post(ctx, transaction, held, movement, "succeeded", moveLines(ledgermodels.WalletInboundEscrowAccount(held.BuyerUserID, held.ID.String(), currency), ledgermodels.WalletAvailableAccount(held.BuyerUserID, currency), movement.AmountMinor))
	case MovementDirectSale:
		if err := handler.post(ctx, transaction, held, movement, "succeeded", moveLines(ledgermodels.DirectSellerPayableAccount(held.SellerUserID, currency), ledgermodels.WalletDepositHoldAccount(held.SellerUserID, currency), movement.AmountMinor)); err != nil {
			return err
		}
		return handler.Service.holdSaleInSellerWallet(ctx, transaction, held.SellerUserID, movement.Reference, movement.AmountMinor, currency)
	}
	return nil
}

func (handler EscrowMovementHandler) HandleMovementFailed(ctx context.Context, transaction *sql.Tx, movement paymentmodels.FinishedMovement) error {
	held, err := handler.escrowOf(ctx, transaction, movement)
	if err != nil {
		return err
	}
	currency := held.Currency
	locked := ledgermodels.WalletEscrowLockedAccount(held.BuyerUserID, held.ID.String(), currency)
	_ = handler.Service.recordEscrowEvent(ctx, handler.Service.Container.Client(transaction), held.ID, "walletMovementFailed", "system", movement.Reference, map[string]any{"kind": movement.Kind, "reason": movement.FailureReason})
	switch handler.Kind {
	case paymentmodels.MovementEscrowRelease:
		returned := movement.AmountMinor + movement.MetadataAmount("commissionMinor") + movement.MetadataAmount("processingFeeMinor")
		if err := handler.post(ctx, transaction, held, movement, "failed", moveLines(ledgermodels.WalletOutgoingAccount(held.BuyerUserID, currency), locked, returned)); err != nil {
			return err
		}
		if movement.MetadataString("stage") != "release" {
			return nil
		}
		return held.Update().SetStatus(escrow.StatusHeld).ClearReleasedAt().SetReleaseTrigger("releaseFailed").SetReleasedToSellerMinor(0).AddVersion(1).Exec(ctx)
	case paymentmodels.MovementEscrowCommission:
		return handler.post(ctx, transaction, held, movement, "failed", moveLines(ledgermodels.WalletOutgoingAccount(held.BuyerUserID, currency), locked, movement.AmountMinor))
	case paymentmodels.MovementClawback:
		lines := moveLines(ledgermodels.WalletOutgoingAccount(held.SellerUserID, currency), ledgermodels.WalletAvailableAccount(held.SellerUserID, currency), movement.AmountMinor)
		lines = append(lines, moveLines(ledgermodels.WalletDebtAccount(held.SellerUserID, currency), ledgermodels.WalletInboundEscrowAccount(held.BuyerUserID, held.ID.String(), currency), movement.AmountMinor)...)
		if err := handler.post(ctx, transaction, held, movement, "failed", lines); err != nil {
			return err
		}
		return handler.Service.enqueueClawbackTopUp(ctx, transaction, held, movement.AmountMinor, map[string]any{"escrowId": held.ID.String(), "reason": "clawback failed: " + movement.FailureReason})
	}
	handler.Service.Container.Payments.RecordPaymentAlertMetric(ctx, "escrowMovementFailed", "kind", movement.Kind, "escrowId", held.ID.String(), "reason", movement.FailureReason)
	return nil
}
