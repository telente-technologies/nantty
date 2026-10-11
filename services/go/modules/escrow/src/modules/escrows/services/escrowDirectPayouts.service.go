package services

import (
	"context"
	"database/sql"
	"strings"

	"github.com/google/uuid"

	"zudomart/modules/escrow/src/generated/ent"
	"zudomart/modules/escrow/src/generated/ent/escrow"
	"zudomart/modules/ledger/src/databases"
	ledgermodels "zudomart/modules/ledger/src/modules/journal/models"
	paymentconstants "zudomart/modules/payments/src/constants"
	paymentmodels "zudomart/modules/payments/src/modules/gateway/models"
)

const PurposeDirectSale = "direct_sale"

func (service EscrowService) PayDirectSellersAfterSettlement(ctx context.Context, limit int) int {
	client := service.Container.Client(service.Container.Resources.Database)
	due, err := client.Escrow.Query().Where(escrow.PaymentModeEQ(escrow.PaymentModeDirect), escrow.Provider(paymentconstants.ProviderFlutterwave),
		escrow.CurrencyNEQ("NGN"), escrow.DirectPayoutReference(""), escrow.StatusEQ(escrow.StatusReleased), escrow.SellerAmountMinorGT(0)).Limit(limit).All(ctx)
	if err != nil {
		return 0
	}
	sent := 0
	for _, held := range due {
		if settled, err := service.Container.Payments.IsPaymentSettled(ctx, service.Container.Resources.Database, held.PaymentIntentID); err != nil || !settled {
			continue
		}
		reference, err := service.prepareDirectPayout(ctx, held)
		if err != nil {
			service.Container.Resources.Logger.WarnContext(ctx, "direct seller payout could not be prepared; it is retried", "escrowId", held.ID.String(), "error", err)
			continue
		}
		if _, err := service.Container.Payments.SendPreparedSellerPayout(ctx, reference); err != nil {
			service.Container.Resources.Logger.WarnContext(ctx, "direct seller payout send failed; the reconciler resolves it", "reference", reference, "error", err)
		}
		sent++
	}
	return sent
}

func (service EscrowService) prepareDirectPayout(ctx context.Context, held *ent.Escrow) (string, error) {
	fee, err := service.Container.Payments.QuotePayoutFee(held.Currency, held.SellerAmountMinor)
	if err != nil {
		return "", err
	}
	reference := "dsp_" + strings.ReplaceAll(uuid.Must(uuid.NewV7()).String(), "-", "")
	err = databases.RunInMoneyTransaction(ctx, service.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		locked, err := service.Container.Client(transaction).Escrow.Query().Where(escrow.ID(held.ID)).ForUpdate().Only(ctx)
		if err != nil || locked.DirectPayoutReference != "" {
			return err
		}
		if _, err := service.Container.Payments.PrepareDirectSellerPayoutInTransaction(ctx, transaction, paymentmodels.SellerPayoutInstruction{
			Purpose: PurposeDirectSale, SubjectId: held.ID.String(), BeneficiaryUserId: held.SellerUserID, Reference: reference,
			AmountMinor: held.SellerAmountMinor - fee, FeeMinor: fee, Currency: held.Currency,
		}); err != nil {
			return err
		}
		return locked.Update().SetDirectPayoutReference(reference).AddVersion(1).Exec(ctx)
	})
	return reference, err
}

type DirectSalePayouts struct {
	Service EscrowService
}

func (payouts DirectSalePayouts) HandleTransferSucceeded(ctx context.Context, transaction *sql.Tx, transfer paymentmodels.FinishedTransfer) error {
	held, err := payouts.Service.Container.Client(transaction).Escrow.Query().Where(escrow.ID(uuid.MustParse(transfer.SubjectId))).ForUpdate().Only(ctx)
	if err != nil || held.DirectPaidOutAt != nil {
		return err
	}
	if err := payouts.Service.postEscrowLines(ctx, transaction, held, "direct-payout:"+held.ID.String(), "directPayment.paidOut", "Order "+held.OrderReference+" paid out to the seller",
		moveLines(ledgermodels.DirectSellerPayableAccount(held.SellerUserID, held.Currency), ledgermodels.PlatformProviderBalanceAccount(transfer.Provider, held.Currency), held.SellerAmountMinor)); err != nil {
		return err
	}
	return held.Update().SetDirectPaidOutAt(transfer.FinishedAt).AddVersion(1).Exec(ctx)
}

func (payouts DirectSalePayouts) HandleTransferFailed(ctx context.Context, transaction *sql.Tx, transfer paymentmodels.FinishedTransfer) error {
	payouts.Service.Container.Payments.RecordPaymentAlertMetric(ctx, "directPayoutFailed", "escrowId", transfer.SubjectId, "reason", transfer.FailureReason)
	return payouts.Service.Container.Client(transaction).Escrow.Update().Where(escrow.ID(uuid.MustParse(transfer.SubjectId)), escrow.DirectPaidOutAtIsNil()).
		SetDirectPayoutReference("").AddVersion(1).Exec(ctx)
}
