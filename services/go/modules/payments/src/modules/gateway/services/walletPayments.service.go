package services

import (
	"context"
	"database/sql"
	"errors"
	"net/http"

	ledgermodels "zudomart/modules/ledger/src/modules/journal/models"
	ledgerutils "zudomart/modules/ledger/src/utils"
	"zudomart/modules/payments/src/constants"
	"zudomart/modules/payments/src/generated/ent"
	"zudomart/modules/payments/src/generated/ent/paymentintent"
	"zudomart/modules/payments/src/modules/gateway/models"
	"zudomart/platform/httpserver"
)

var (
	ErrInsufficientWalletFunds = httpserver.NewApiError(http.StatusUnprocessableEntity, "INSUFFICIENT_WALLET_FUNDS", "Your wallet balance is too low for this payment.")
	ErrWalletPaymentNotAllowed = httpserver.NewApiError(http.StatusUnprocessableEntity, "WALLET_PAYMENT_NOT_ALLOWED", "This payment cannot be paid from your wallet.")
)

type walletPaymentResult struct {
	Payment           models.PaymentIntentView `json:"payment"`
	MovementReference string                   `json:"-"`
}

func LockUserWalletMoney(ctx context.Context, transaction *sql.Tx, userId string) error {
	_, err := transaction.ExecContext(ctx, "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", "wallet-withdraw:"+userId)
	return err
}

func (gateway *PaymentGateway) PayIntentFromWallet(ctx context.Context, request models.WalletPaymentRequest) (models.PaymentIntentView, error) {
	result, _, err := ledgerutils.RunIdempotentMoneyCommand(ctx, gateway.Container.Resources.Database, gateway.Container.Idempotency, ledgerutils.IdempotentCommand[walletPaymentResult]{
		Scope: request.UserId + ":payments.payFromWallet", Key: request.IdempotencyKey, RequestHash: ledgerutils.HashRequestFingerprint(request.Reference),
		Execute: func(ctx context.Context, transaction *sql.Tx) (walletPaymentResult, error) {
			return gateway.payIntentFromWalletInTransaction(ctx, transaction, request)
		},
	})
	if err != nil {
		return models.PaymentIntentView{}, err
	}
	if result.MovementReference != "" {
		if err := gateway.SendMovement(ctx, result.MovementReference); err != nil {
			gateway.Container.Resources.Logger.WarnContext(ctx, "wallet payment transfer will be retried by the worker", "reference", result.MovementReference, "error", err)
		}
	}
	return result.Payment, nil
}

func (gateway *PaymentGateway) payIntentFromWalletInTransaction(ctx context.Context, transaction *sql.Tx, request models.WalletPaymentRequest) (walletPaymentResult, error) {
	client := gateway.Container.Client(transaction)
	subject, err := client.PaymentIntent.Query().Where(paymentintent.Reference(request.Reference), paymentintent.OwnerUserID(request.UserId)).Only(ctx)
	if ent.IsNotFound(err) {
		return walletPaymentResult{}, ErrPaymentNotFound
	}
	if err != nil {
		return walletPaymentResult{}, err
	}
	if err := lockPaymentSubject(ctx, transaction, string(subject.Purpose), subject.SubjectID); err != nil {
		return walletPaymentResult{}, err
	}
	intent, err := client.PaymentIntent.Query().Where(paymentintent.ID(subject.ID)).ForUpdate().Only(ctx)
	if err != nil {
		return walletPaymentResult{}, err
	}
	if intent.Status != paymentintent.StatusPending {
		return walletPaymentResult{}, ErrAlreadyPaid
	}
	if intent.Provider != gateway.walletProviderName() || intent.Currency != walletCurrency || intent.Purpose == constants.PurposeCardVerification || intent.ConnectedAccountID != "" {
		return walletPaymentResult{}, ErrWalletPaymentNotAllowed
	}
	if _, err := gateway.FindActiveProviderWallet(ctx, transaction, request.UserId); err != nil {
		return walletPaymentResult{}, err
	}
	if err := LockUserWalletMoney(ctx, transaction, request.UserId); err != nil {
		return walletPaymentResult{}, err
	}
	if err := gateway.requireWithinWalletDailyLimit(ctx, transaction, request.UserId, intent.Currency, intent.AmountMinor); err != nil {
		return walletPaymentResult{}, err
	}
	fromHold, fromAvailable, err := gateway.splitWalletSpend(ctx, transaction, request.UserId, intent.Currency, intent.AmountMinor)
	if err != nil {
		return walletPaymentResult{}, err
	}
	escrowPurchase := string(intent.Purpose) == constants.PurposeOrderCheckout
	destination := ledgermodels.PaymentsAwaitingApplicationAccount(intent.Currency)
	movementReference := ""
	if !escrowPurchase {
		destination = ledgermodels.WalletOutgoingAccount(request.UserId, intent.Currency)
		movementReference = models.NewMovementReference(models.MovementWalletPayment)
	}
	lines := AppendPositiveLine(nil, ledgermodels.WalletDepositHoldAccount(request.UserId, intent.Currency), ledgermodels.Debit, fromHold)
	lines = AppendPositiveLine(lines, ledgermodels.WalletAvailableAccount(request.UserId, intent.Currency), ledgermodels.Debit, fromAvailable)
	lines = append(lines, ledgermodels.JournalLineRequest{Account: destination, Direction: ledgermodels.Credit, AmountMinor: intent.AmountMinor})
	if _, err := gateway.Container.Ledger.PostBalancedJournalEntry(ctx, transaction, ledgermodels.JournalEntryRequest{
		Reference: "wallet-payment:" + intent.Reference, Kind: "payment.paidFromWallet", ExternalReference: intent.Reference, Description: "Paid from your wallet",
		Metadata: map[string]any{"paymentIntentId": intent.ID.String(), "purpose": string(intent.Purpose), "fromHoldMinor": fromHold}, Lines: lines,
	}); err != nil {
		return walletPaymentResult{}, convertInsufficientWalletBalance(err)
	}
	if movementReference != "" {
		if _, err := gateway.EnqueueMovementInTransaction(ctx, transaction, models.MovementRequest{
			Reference: movementReference, Kind: models.MovementWalletPayment, SubjectId: intent.Reference, UserId: request.UserId, FromUserId: request.UserId,
			ToPlatform: true, AmountMinor: intent.AmountMinor, Currency: intent.Currency,
		}); err != nil {
			return walletPaymentResult{}, err
		}
	}
	now := gateway.Container.Now().UTC()
	succeeded, err := intent.Update().Where(paymentintent.Version(intent.Version)).AddVersion(1).SetStatus(paymentintent.StatusSucceeded).SetPaidAt(now).
		SetProviderTransactionID("wallet:" + intent.Reference).SetProviderSettledAt(now).SetFailureReason("").Save(ctx)
	if err != nil {
		return walletPaymentResult{}, err
	}
	handler, err := gateway.purposeHandler(string(succeeded.Purpose))
	if err != nil {
		return walletPaymentResult{}, err
	}
	settled, err := gateway.buildSettledPayment(ctx, client, succeeded)
	if err != nil {
		return walletPaymentResult{}, err
	}
	settled.PaidFromWallet, settled.WalletHoldMinor = true, fromHold
	if err := handler.HandleSucceededPayment(ctx, transaction, settled); err != nil {
		return walletPaymentResult{}, err
	}
	if err := gateway.Container.Outbox.EnqueueInTransaction(ctx, transaction, "payment.succeeded", succeeded.ID.String(), now, paymentEventData(succeeded)); err != nil {
		return walletPaymentResult{}, err
	}
	return walletPaymentResult{Payment: ConvertPaymentIntentToView(succeeded), MovementReference: movementReference}, nil
}

func (gateway *PaymentGateway) splitWalletSpend(ctx context.Context, transaction *sql.Tx, userId, currency string, amountMinor int64) (int64, int64, error) {
	hold, available := ledgermodels.WalletDepositHoldAccount(userId, currency), ledgermodels.WalletAvailableAccount(userId, currency)
	balances, err := gateway.Container.Ledger.ReadAccountBalances(ctx, transaction, []ledgermodels.AccountRef{hold, available})
	if err != nil {
		return 0, 0, err
	}
	fromHold := min(max(balances[hold.Key()], 0), amountMinor)
	fromAvailable := amountMinor - fromHold
	if fromAvailable > max(balances[available.Key()], 0) {
		return 0, 0, ErrInsufficientWalletFunds
	}
	return fromHold, fromAvailable, nil
}

func convertInsufficientWalletBalance(err error) error {
	if err != nil && errors.Is(err, ledgermodels.ErrInsufficientBalance) {
		return ErrInsufficientWalletFunds
	}
	return err
}
