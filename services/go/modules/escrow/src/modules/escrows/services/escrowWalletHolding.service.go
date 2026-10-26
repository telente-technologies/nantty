package services

import (
	"context"
	"database/sql"
	"fmt"
	"net/http"

	"nantty/modules/escrow/src/generated/ent"
	"nantty/modules/escrow/src/generated/ent/escrow"
	ledgermodels "nantty/modules/ledger/src/modules/journal/models"
	paymentconstants "nantty/modules/payments/src/constants"
	paymentmodels "nantty/modules/payments/src/modules/gateway/models"
	paymentservices "nantty/modules/payments/src/modules/gateway/services"
	"nantty/platform/httpserver"
)

var ErrEscrowFundsNotSettled = httpserver.NewApiError(http.StatusConflict, "ESCROW_FUNDS_NOT_SETTLED", "The card payment for this order has not reached the buyer's wallet yet. Try again later.")

func usesBuyerWallet(payment paymentmodels.SettledPayment) bool {
	return payment.Provider == paymentconstants.ProviderFlutterwave
}

func IsWalletLocked(held *ent.Escrow) bool {
	return held.Custody == escrow.CustodyBuyerWalletLock
}

func (service EscrowService) holdFundsInProviderWallets(ctx context.Context, transaction *sql.Tx, payment paymentmodels.SettledPayment, payable paymentmodels.OrderPayable) error {
	client := service.Container.Client(transaction)
	exists, err := client.Escrow.Query().Where(escrow.OrderID(payable.OrderId)).Exist(ctx)
	if err != nil || exists {
		return err
	}
	direct := payable.PaymentMode == "direct"
	commission := payment.PlatformFeeMinor
	if direct {
		commission = 0
	}
	sellerNet := payable.AmountMinor - commission - payment.ProviderFeeMinor
	if sellerNet < 0 {
		return fmt.Errorf("order %s fees exceed the amount paid", payable.OrderId)
	}
	now := service.Container.Now().UTC()
	create := client.Escrow.Create().
		SetOrderID(payable.OrderId).SetOrderReference(payable.OrderReference).SetCheckoutID(payable.CheckoutId).
		SetPaymentIntentID(payment.IntentId).SetPaymentReference(payment.Reference).SetProvider(payment.Provider).
		SetBuyerUserID(payable.BuyerUserId).SetStoreID(payable.StoreId).SetSellerUserID(payable.SellerUserId).
		SetProductSummary(payable.ProductSummary).SetAmountMinor(payable.AmountMinor).SetCurrency(payable.Currency).
		SetCommissionBps(escrowFeeBpsFor(commission, payable.AmountMinor)).SetCommissionMinor(commission).
		SetProcessingFeeMinor(payment.ProviderFeeMinor).SetSellerAmountMinor(sellerNet).SetCreatedAt(now)
	if direct {
		create.SetPaymentMode(escrow.PaymentModeDirect).SetStatus(escrow.StatusReleased).SetReleasedAt(now).SetReleaseTrigger("directPayment").SetReleasedToSellerMinor(sellerNet)
	} else {
		create.SetCustody(escrow.CustodyBuyerWalletLock).SetWalletHoldMinor(min(payment.WalletHoldMinor, payable.AmountMinor)).
			SetAutoReleaseAt(now.Add(service.Container.Settings.UndeliveredReleaseWindow()))
		if payment.PaidFromWallet {
			create.SetWalletFundedAt(now)
		}
	}
	held, err := create.Save(ctx)
	if err != nil {
		return fmt.Errorf("insert escrow for order %s: %w", payable.OrderId, err)
	}
	if direct {
		err = service.postDirectSaleInTransaction(ctx, transaction, held, payment)
	} else {
		err = service.lockInBuyerWalletInTransaction(ctx, transaction, held, payment)
	}
	if err != nil {
		return err
	}
	eventType, outboxType := "held", "escrow.held"
	if direct {
		eventType, outboxType = "paid_directly", "directPayment.received"
	}
	if err := service.recordEscrowEvent(ctx, client, held.ID, eventType, "system", "", map[string]any{"paymentReference": payment.Reference, "paidFromWallet": payment.PaidFromWallet}); err != nil {
		return err
	}
	return service.Container.Outbox.EnqueueInTransaction(ctx, transaction, outboxType, held.OrderID, now, escrowEventData(held))
}

func walletHoldingAccount(held *ent.Escrow) ledgermodels.AccountRef {
	if held.WalletFundedAt == nil {
		return ledgermodels.WalletInboundEscrowAccount(held.BuyerUserID, held.ID.String(), held.Currency)
	}
	return ledgermodels.WalletEscrowLockedAccount(held.BuyerUserID, held.ID.String(), held.Currency)
}

func (service EscrowService) lockInBuyerWalletInTransaction(ctx context.Context, transaction *sql.Tx, held *ent.Escrow, payment paymentmodels.SettledPayment) error {
	if _, err := service.Container.Ledger.PostBalancedJournalEntry(ctx, transaction, ledgermodels.JournalEntryRequest{
		Reference: "escrow-hold:" + held.OrderID, Kind: "escrow.lockedInBuyerWallet", Description: "Order " + held.OrderReference + " locked in the buyer's wallet",
		Metadata: map[string]any{"escrowId": held.ID.String(), "orderId": held.OrderID, "paymentReference": payment.Reference, "paidFromWallet": payment.PaidFromWallet},
		Lines: []ledgermodels.JournalLineRequest{
			{Account: ledgermodels.PaymentsAwaitingApplicationAccount(held.Currency), Direction: ledgermodels.Debit, AmountMinor: held.AmountMinor},
			{Account: walletHoldingAccount(held), Direction: ledgermodels.Credit, AmountMinor: held.AmountMinor},
		},
	}); err != nil {
		return err
	}
	if payment.PaidFromWallet {
		return nil
	}
	_, err := service.Container.Payments.EnqueueMovementInTransaction(ctx, transaction, paymentmodels.MovementRequest{
		Kind: paymentmodels.MovementEscrowFundIn, SubjectId: held.ID.String(), UserId: held.BuyerUserID, ToUserId: held.BuyerUserID,
		AmountMinor: held.AmountMinor, Currency: held.Currency, BlockedOn: "settlement:" + payment.Reference, Metadata: map[string]any{"escrowId": held.ID.String()},
	})
	return err
}

func (service EscrowService) postDirectSaleInTransaction(ctx context.Context, transaction *sql.Tx, held *ent.Escrow, payment paymentmodels.SettledPayment) error {
	lines := []ledgermodels.JournalLineRequest{{Account: ledgermodels.PaymentsAwaitingApplicationAccount(held.Currency), Direction: ledgermodels.Debit, AmountMinor: held.AmountMinor}}
	lines = appendPositiveCredit(lines, ledgermodels.DirectSellerPayableAccount(held.SellerUserID, held.Currency), held.SellerAmountMinor)
	lines = appendPositiveCredit(lines, ledgermodels.PaymentProcessingFeeExpenseAccount(held.Currency), held.ProcessingFeeMinor)
	if _, err := service.Container.Ledger.PostBalancedJournalEntry(ctx, transaction, ledgermodels.JournalEntryRequest{
		Reference: "direct-payment:" + held.OrderID, Kind: "directPayment.owedToSeller", Description: "Order " + held.OrderReference + " paid directly; the seller is paid after settlement",
		Metadata: map[string]any{"escrowId": held.ID.String(), "orderId": held.OrderID, "paymentReference": payment.Reference}, Lines: lines,
	}); err != nil {
		return err
	}
	if held.Currency != "NGN" || held.SellerAmountMinor <= 0 {
		return nil
	}
	_, err := service.Container.Payments.EnqueueMovementInTransaction(ctx, transaction, paymentmodels.MovementRequest{
		Kind: MovementDirectSale, SubjectId: held.ID.String(), UserId: held.SellerUserID, ToUserId: held.SellerUserID,
		AmountMinor: held.SellerAmountMinor, Currency: held.Currency, BlockedOn: "settlement:" + payment.Reference, Metadata: map[string]any{"escrowId": held.ID.String()},
	})
	return err
}

const MovementDirectSale = "directSale"

func moveLines(from, to ledgermodels.AccountRef, amountMinor int64) []ledgermodels.JournalLineRequest {
	return paymentservices.AppendPositiveLine(paymentservices.AppendPositiveLine(nil, from, ledgermodels.Debit, amountMinor), to, ledgermodels.Credit, amountMinor)
}
