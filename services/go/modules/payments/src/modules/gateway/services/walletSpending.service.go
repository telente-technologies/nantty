package services

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"net/http"

	ledgermodels "zudomart/modules/ledger/src/modules/journal/models"
	"zudomart/modules/payments/src/modules/gateway/models"
	"zudomart/platform/httpserver"
)

const (
	MovementWalletCredit   = "walletCredit"
	walletSpendJournalKind = "wallet.spentOnPlatform"
)

type WalletSpend struct {
	UserId      string
	Currency    string
	AmountMinor int64
	Reference   string
	Subject     string
	Description string
	Credit      ledgermodels.AccountRef
	NetDebts    bool
}

var ErrWalletDebtBlocksSpend = httpserver.NewApiError(http.StatusConflict, "WALLET_DEBT_OUTSTANDING", "Clear the amount you owe first. It is taken from your balance before you can spend it.")

func (gateway *PaymentGateway) SpendWalletToPlatformInTransaction(ctx context.Context, transaction *sql.Tx, spend WalletSpend) (string, error) {
	if _, err := gateway.FindActiveProviderWallet(ctx, transaction, spend.UserId); err != nil {
		return "", err
	}
	if err := LockUserWalletMoney(ctx, transaction, spend.UserId); err != nil {
		return "", err
	}
	if err := gateway.requireWithinWalletDailyLimit(ctx, transaction, spend.UserId, spend.Currency, spend.AmountMinor); err != nil {
		return "", err
	}
	if spend.NetDebts {
		if err := gateway.requireSpendLeavesDebtsCovered(ctx, transaction, spend.UserId, spend.Currency, spend.AmountMinor); err != nil {
			return "", err
		}
	}
	fromHold, fromAvailable, err := gateway.splitWalletSpend(ctx, transaction, spend.UserId, spend.Currency, spend.AmountMinor)
	if err != nil {
		return "", err
	}
	outgoing, awaiting := ledgermodels.WalletOutgoingAccount(spend.UserId, spend.Currency), ledgermodels.PaymentsAwaitingApplicationAccount(spend.Currency)
	lines := AppendPositiveLine(nil, ledgermodels.WalletDepositHoldAccount(spend.UserId, spend.Currency), ledgermodels.Debit, fromHold)
	lines = AppendPositiveLine(lines, ledgermodels.WalletAvailableAccount(spend.UserId, spend.Currency), ledgermodels.Debit, fromAvailable)
	lines = append(lines, moveLinesCredit(outgoing, spend.AmountMinor), ledgermodels.JournalLineRequest{Account: awaiting, Direction: ledgermodels.Debit, AmountMinor: spend.AmountMinor},
		ledgermodels.JournalLineRequest{Account: spend.Credit, Direction: ledgermodels.Credit, AmountMinor: spend.AmountMinor})
	if _, err := gateway.Container.Ledger.PostBalancedJournalEntry(ctx, transaction, ledgermodels.JournalEntryRequest{
		Reference: "wallet-spend:" + spend.Reference, Kind: walletSpendJournalKind, Description: spend.Description, Lines: lines,
	}); err != nil {
		return "", convertInsufficientWalletBalance(err)
	}
	movementReference := models.NewMovementReference(models.MovementWalletPayment)
	_, err = gateway.EnqueueMovementInTransaction(ctx, transaction, models.MovementRequest{
		Reference: movementReference, Kind: models.MovementWalletPayment, SubjectId: spend.Subject, UserId: spend.UserId, FromUserId: spend.UserId,
		ToPlatform: true, AmountMinor: spend.AmountMinor, Currency: spend.Currency,
	})
	return movementReference, err
}

func moveLinesCredit(account ledgermodels.AccountRef, amountMinor int64) ledgermodels.JournalLineRequest {
	return ledgermodels.JournalLineRequest{Account: account, Direction: ledgermodels.Credit, AmountMinor: amountMinor}
}

// movementSubject keeps a credit's subject within the movement's 120-character column, so the inbound account the
// movement settles is always the one the credit was booked to.
func movementSubject(subject string) string {
	if len(subject) <= 100 {
		return subject
	}
	digest := sha256.Sum256([]byte(subject))
	return "h:" + hex.EncodeToString(digest[:16])
}

func (gateway *PaymentGateway) CreditWalletFromPlatformInTransaction(ctx context.Context, transaction *sql.Tx, userId, currency, subject, reference string, amountMinor int64, debit ledgermodels.AccountRef, description string) error {
	subject = movementSubject(subject)
	inbound := ledgermodels.WalletInboundAccount(userId, subject, currency)
	if _, err := gateway.Container.Ledger.PostBalancedJournalEntry(ctx, transaction, ledgermodels.JournalEntryRequest{
		Reference: "wallet-credit:" + reference, Kind: "wallet.creditPending", Description: description, Lines: moveLines(debit, inbound, amountMinor),
	}); err != nil {
		return err
	}
	_, err := gateway.EnqueueMovementInTransaction(ctx, transaction, models.MovementRequest{
		Kind: MovementWalletCredit, SubjectId: subject, UserId: userId, ToUserId: userId, AmountMinor: amountMinor, Currency: currency,
	})
	return err
}

func (gateway *PaymentGateway) requireSpendLeavesDebtsCovered(ctx context.Context, transaction *sql.Tx, userId, currency string, amountMinor int64) error {
	accounts := []ledgermodels.AccountRef{
		ledgermodels.WalletAvailableAccount(userId, currency), ledgermodels.WalletDepositHoldAccount(userId, currency),
		ledgermodels.WalletDebtAccount(userId, currency), ledgermodels.SellerDebtAccount(userId, currency), ledgermodels.CreatorEarningsDebtAccount(userId, currency),
	}
	balances, err := gateway.Container.Ledger.ReadAccountBalances(ctx, transaction, accounts)
	if err != nil {
		return err
	}
	debts := max(balances[accounts[2].Key()], 0) + max(balances[accounts[3].Key()], 0) + max(balances[accounts[4].Key()], 0)
	if debts == 0 {
		return nil
	}
	spendable := max(balances[accounts[0].Key()], 0) + max(balances[accounts[1].Key()], 0)
	if amountMinor > spendable-debts {
		return ErrWalletDebtBlocksSpend.WithDetails(map[string]any{"owed": moneyDetail(debts, currency), "spendable": moneyDetail(max(spendable-debts, 0), currency)})
	}
	return nil
}
