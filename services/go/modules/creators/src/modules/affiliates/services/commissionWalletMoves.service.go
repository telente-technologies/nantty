package services

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"

	"nantty/modules/creators/src/generated/ent"
	"nantty/modules/creators/src/generated/ent/affiliatecommission"
	"nantty/modules/creators/src/generated/ent/affiliatecommissionreversal"
	ledgermodels "nantty/modules/ledger/src/modules/journal/models"
	paymentmodels "nantty/modules/payments/src/modules/gateway/models"
	paymentservices "nantty/modules/payments/src/modules/gateway/services"
)

const (
	MovementAffiliateCommission = "affiliateCommission"
	MovementAffiliateClawback   = "affiliateClawback"
)

var errPaymentsNotWired = errors.New("affiliate commissions need the payments gateway")

type walletTake struct {
	fromHold, fromAvailable int64
}

func (take walletTake) total() int64 { return take.fromHold + take.fromAvailable }

func (affiliates Affiliates) payments() (*paymentservices.PaymentGateway, error) {
	if affiliates.Container.Payments == nil {
		return nil, errPaymentsNotWired
	}
	return affiliates.Container.Payments, nil
}

func (affiliates Affiliates) takeFromWallet(ctx context.Context, transaction *sql.Tx, userId, currency string, wanted int64) (walletTake, error) {
	payments, err := affiliates.payments()
	if err != nil {
		return walletTake{}, err
	}
	if err := paymentservices.LockUserWalletMoney(ctx, transaction, userId); err != nil {
		return walletTake{}, err
	}
	if _, err := payments.FindProviderWallet(ctx, transaction, userId); err != nil {
		if errors.Is(err, paymentservices.ErrProviderWalletMissing) {
			return walletTake{}, nil
		}
		return walletTake{}, err
	}
	hold, available := ledgermodels.WalletDepositHoldAccount(userId, currency), ledgermodels.WalletAvailableAccount(userId, currency)
	balances, err := affiliates.Container.Ledger.ReadAccountBalances(ctx, transaction, []ledgermodels.AccountRef{hold, available})
	if err != nil {
		return walletTake{}, err
	}
	take := walletTake{fromAvailable: min(wanted, max(balances[available.Key()], 0))}
	take.fromHold = min(wanted-take.fromAvailable, max(balances[hold.Key()], 0))
	return take, nil
}

func walletDebitLines(userId, currency string, take walletTake) []ledgermodels.JournalLineRequest {
	lines := paymentservices.AppendPositiveLine(nil, ledgermodels.WalletDepositHoldAccount(userId, currency), ledgermodels.Debit, take.fromHold)
	lines = paymentservices.AppendPositiveLine(lines, ledgermodels.WalletAvailableAccount(userId, currency), ledgermodels.Debit, take.fromAvailable)
	return paymentservices.AppendPositiveLine(lines, ledgermodels.WalletOutgoingAccount(userId, currency), ledgermodels.Credit, take.total())
}

func movementReference(prefix string, id uuid.UUID, suffix string) string {
	return prefix + strings.ReplaceAll(id.String(), "-", "") + suffix
}

// settleCommissionInTransaction moves an owed commission from the seller's wallet towards the creator's wallet.
// It leaves the commission pending when the seller's wallet cannot cover it yet (for example while the sale is still being released).
func (affiliates Affiliates) settleCommissionInTransaction(ctx context.Context, transaction *sql.Tx, client *ent.Client, commission *ent.AffiliateCommission) (bool, error) {
	owed := commission.CommissionMinor - commission.ReversedMinor
	if commission.Status != affiliatecommission.StatusPending || owed <= 0 {
		return false, nil
	}
	payments := affiliates.Container.Payments
	if payments == nil {
		return false, nil
	}
	readiness, err := affiliates.commissionTransferAttempt(ctx, transaction, commission)
	if err != nil {
		return false, err
	}
	if !readiness.ready {
		return false, rememberReadiness(ctx, client, commission, readiness)
	}
	take, err := affiliates.takeFromWallet(ctx, transaction, commission.SellerUserID, commission.Currency, owed)
	if err != nil || take.total() < owed {
		return false, err
	}
	attempts := readiness.attempts
	journalReference, movementSuffix := "affiliate-commission-paid:"+commission.ID.String(), ""
	if attempts > 0 {
		journalReference, movementSuffix = fmt.Sprintf("%s:r%d", journalReference, attempts), fmt.Sprintf("-r%d", attempts)
	}
	if _, err := affiliates.Container.Ledger.PostBalancedJournalEntry(ctx, transaction, ledgermodels.JournalEntryRequest{
		Reference: journalReference, Kind: "affiliateCommission.sent", Description: SellerCommissionDebitDescription(commission),
		Metadata: map[string]any{"commissionId": commission.ID.String(), "orderId": commission.OrderID, "creatorId": commission.CreatorID}, Lines: walletDebitLines(commission.SellerUserID, commission.Currency, take),
	}); err != nil {
		return false, err
	}
	if _, err := payments.EnqueueMovementInTransaction(ctx, transaction, paymentmodels.MovementRequest{
		Reference: movementReference("aff-", commission.ID, movementSuffix), Kind: MovementAffiliateCommission, SubjectId: commission.ID.String(), UserId: commission.CreatorID,
		FromUserId: commission.SellerUserID, ToUserId: commission.CreatorID, AmountMinor: owed, Currency: commission.Currency,
	}); err != nil {
		return false, err
	}
	return true, client.AffiliateCommission.UpdateOne(commission).SetStatus(affiliatecommission.StatusProcessing).SetTransferAttempts(attempts + 1).ClearRetryAfter().Exec(ctx)
}

// clawBackInTransaction returns a reversed commission from the creator's wallet to the seller's.
// Whatever the creator's wallet cannot cover becomes the creator's wallet debt, and the platform tops the seller up, as for escrow clawbacks.
func (affiliates Affiliates) clawBackInTransaction(ctx context.Context, transaction *sql.Tx, commission *ent.AffiliateCommission, amount int64, refundKey string) (int64, int64, error) {
	payments, err := affiliates.payments()
	if err != nil {
		return 0, 0, err
	}
	take, err := affiliates.takeFromWallet(ctx, transaction, commission.CreatorID, commission.Currency, amount)
	if err != nil {
		return 0, 0, err
	}
	recovered, shortfall := take.total(), amount-take.total()
	key := commission.ID.String() + ":" + refundKey
	if recovered > 0 {
		if _, err := affiliates.Container.Ledger.PostBalancedJournalEntry(ctx, transaction, ledgermodels.JournalEntryRequest{
			Reference: "affiliate-commission-clawback:" + key, Kind: "affiliateCommission.clawedBack", Description: CreatorCommissionReversalDescription(commission),
			Metadata: map[string]any{"commissionId": commission.ID.String(), "orderId": commission.OrderID}, Lines: walletDebitLines(commission.CreatorID, commission.Currency, take),
		}); err != nil {
			return 0, 0, err
		}
		if _, err := payments.EnqueueMovementInTransaction(ctx, transaction, paymentmodels.MovementRequest{
			Kind: MovementAffiliateClawback, SubjectId: commission.ID.String(), UserId: commission.SellerUserID, FromUserId: commission.CreatorID, ToUserId: commission.SellerUserID,
			AmountMinor: recovered, Currency: commission.Currency, Metadata: map[string]any{"refundKey": refundKey},
		}); err != nil {
			return 0, 0, err
		}
	}
	if shortfall > 0 {
		if err := affiliates.recordCreatorShortfall(ctx, transaction, commission, shortfall, key); err != nil {
			return 0, 0, err
		}
	}
	return recovered, shortfall, nil
}

func (affiliates Affiliates) recordCreatorShortfall(ctx context.Context, transaction *sql.Tx, commission *ent.AffiliateCommission, shortfall int64, key string) error {
	payments, err := affiliates.payments()
	if err != nil {
		return err
	}
	digest := sha256.Sum256([]byte(key))
	subject := "aff-short:" + hex.EncodeToString(digest[:16])
	if err := payments.CreditWalletFromPlatformInTransaction(ctx, transaction, commission.SellerUserID, commission.Currency, subject, subject, shortfall,
		ledgermodels.WalletDebtAccount(commission.CreatorID, commission.Currency), SellerCommissionShortfallDescription(commission)); err != nil {
		return err
	}
	payments.RecordPaymentAlertMetric(ctx, "walletDebt", "userId", commission.CreatorID, "debtMinor", shortfall, "commissionId", commission.ID.String())
	return affiliates.Container.Outbox.EnqueueInTransaction(ctx, transaction, "wallet.debtRecorded", commission.ID.String(), affiliates.Container.Now().UTC(), map[string]any{
		"userId": commission.CreatorID, "commissionId": commission.ID.String(), "debt": Money{shortfall, commission.Currency},
	})
}

type CommissionMovementHandler struct {
	Affiliates Affiliates
	Kind       string
}

func (handler CommissionMovementHandler) commissionOf(ctx context.Context, client *ent.Client, movement paymentmodels.FinishedMovement) (*ent.AffiliateCommission, error) {
	id, err := uuid.Parse(movement.SubjectId)
	if err != nil {
		return nil, err
	}
	return client.AffiliateCommission.Query().Where(affiliatecommission.IDEQ(id)).ForUpdate().Only(ctx)
}

func (handler CommissionMovementHandler) post(ctx context.Context, transaction *sql.Tx, movement paymentmodels.FinishedMovement, outcome, description string, lines []ledgermodels.JournalLineRequest) error {
	_, err := handler.Affiliates.Container.Ledger.PostBalancedJournalEntry(ctx, transaction, ledgermodels.JournalEntryRequest{
		Reference: "affiliate-movement-" + outcome + ":" + movement.Reference, Kind: "affiliateCommission.movement." + movement.Kind + "." + outcome,
		Description: description, Metadata: map[string]any{"commissionId": movement.SubjectId}, Lines: lines,
	})
	return err
}

func moveBetween(from, to ledgermodels.AccountRef, amount int64) []ledgermodels.JournalLineRequest {
	return []ledgermodels.JournalLineRequest{{Account: from, Direction: ledgermodels.Debit, AmountMinor: amount}, {Account: to, Direction: ledgermodels.Credit, AmountMinor: amount}}
}

func (handler CommissionMovementHandler) HandleMovementSucceeded(ctx context.Context, transaction *sql.Tx, movement paymentmodels.FinishedMovement) error {
	client := handler.Affiliates.Container.Client(transaction)
	commission, err := handler.commissionOf(ctx, client, movement)
	if err != nil {
		return err
	}
	currency := commission.Currency
	if handler.Kind == MovementAffiliateClawback {
		return handler.post(ctx, transaction, movement, "succeeded", SellerCommissionReversalCreditDescription(commission), moveBetween(ledgermodels.WalletOutgoingAccount(commission.CreatorID, currency), ledgermodels.WalletAvailableAccount(commission.SellerUserID, currency), movement.AmountMinor))
	}
	if err := handler.post(ctx, transaction, movement, "succeeded", CreatorCommissionCreditDescription(commission), moveBetween(ledgermodels.WalletOutgoingAccount(commission.SellerUserID, currency), ledgermodels.WalletAvailableAccount(commission.CreatorID, currency), movement.AmountMinor)); err != nil {
		return err
	}
	if err := client.AffiliateCommission.UpdateOne(commission).SetStatus(affiliatecommission.StatusPaid).SetPaidAt(handler.Affiliates.Container.Now().UTC()).Exec(ctx); err != nil {
		return err
	}
	return handler.applyDeferredClawbacks(ctx, transaction, client, commission.ID)
}

func (handler CommissionMovementHandler) applyDeferredClawbacks(ctx context.Context, transaction *sql.Tx, client *ent.Client, id uuid.UUID) error {
	deferred, err := client.AffiliateCommissionReversal.Query().Where(affiliatecommissionreversal.CommissionID(id.String()), affiliatecommissionreversal.Applied(false)).All(ctx)
	if err != nil {
		return err
	}
	for _, reversal := range deferred {
		commission, err := client.AffiliateCommission.Get(ctx, id)
		if err != nil {
			return err
		}
		recovered, shortfall, err := handler.Affiliates.clawBackInTransaction(ctx, transaction, commission, reversal.AmountMinor, reversal.RefundKey)
		if err != nil {
			return err
		}
		if err := reversal.Update().SetApplied(true).SetRecoveredMinor(recovered).SetShortfallMinor(shortfall).Exec(ctx); err != nil {
			return err
		}
	}
	commission, err := client.AffiliateCommission.Get(ctx, id)
	if err != nil || commission.ReversedMinor < commission.CommissionMinor {
		return err
	}
	return client.AffiliateCommission.UpdateOne(commission).SetStatus(affiliatecommission.StatusReversed).Exec(ctx)
}

func (handler CommissionMovementHandler) HandleMovementFailed(ctx context.Context, transaction *sql.Tx, movement paymentmodels.FinishedMovement) error {
	client := handler.Affiliates.Container.Client(transaction)
	commission, err := handler.commissionOf(ctx, client, movement)
	if err != nil {
		return err
	}
	currency := commission.Currency
	if handler.Kind == MovementAffiliateClawback {
		creatorOutgoing := ledgermodels.WalletOutgoingAccount(commission.CreatorID, currency)
		if err := handler.post(ctx, transaction, movement, "failed", CreatorCommissionReversalFailedDescription(commission), moveBetween(creatorOutgoing, ledgermodels.WalletAvailableAccount(commission.CreatorID, currency), movement.AmountMinor)); err != nil {
			return err
		}
		return handler.Affiliates.recordCreatorShortfall(ctx, transaction, commission, movement.AmountMinor, "failed:"+movement.Reference)
	}
	if err := handler.post(ctx, transaction, movement, "failed", SellerCommissionTransferFailedDescription(commission), moveBetween(ledgermodels.WalletOutgoingAccount(commission.SellerUserID, currency), ledgermodels.WalletAvailableAccount(commission.SellerUserID, currency), movement.AmountMinor)); err != nil {
		return err
	}
	return handler.Affiliates.recordFailedCommissionTransfer(ctx, transaction, client, commission, movement.FailureReason)
}

func (affiliates Affiliates) RegisterMovementHandlers() error {
	payments, err := affiliates.payments()
	if err != nil {
		return err
	}
	payments.RegisterMovementOutcomeHandler(MovementAffiliateCommission, CommissionMovementHandler{Affiliates: affiliates, Kind: MovementAffiliateCommission})
	payments.RegisterMovementOutcomeHandler(MovementAffiliateClawback, CommissionMovementHandler{Affiliates: affiliates, Kind: MovementAffiliateClawback})
	return nil
}
