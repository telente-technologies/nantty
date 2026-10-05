package services

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"
	"net/http"
	"strings"

	"zudomart/modules/ledger/src/databases"
	"zudomart/modules/payments/src/generated/ent"
	"zudomart/modules/payments/src/generated/ent/connectedaccount"
	"zudomart/modules/payments/src/generated/ent/providerpayoutdestination"
	"zudomart/modules/payments/src/interfaces"
	"zudomart/platform/httpserver"
)

const (
	DuplicateBankAccountEventType = "payoutAccount.duplicateBankAccount"
	duplicateBankAccountCode      = "BANK_ACCOUNT_ALREADY_LINKED"
	duplicateBankAccountSignal    = "bank_account_shared_with_another_store"
)

var ErrBankAccountAlreadyLinked = httpserver.NewApiError(http.StatusConflict, duplicateBankAccountCode, "This bank account is already linked to another store.")

func (gateway *PaymentGateway) settlementAccountFingerprint(bankCode, accountNumber string) string {
	mac := hmac.New(sha256.New, []byte(gateway.Container.Settings.SavedCardFingerprintKey))
	mac.Write([]byte("settlement-account:" + strings.TrimSpace(bankCode) + ":" + strings.TrimSpace(accountNumber)))
	return hex.EncodeToString(mac.Sum(nil))
}

func (gateway *PaymentGateway) ClaimSettlementAccount(ctx context.Context, userId string, bank interfaces.PayeeBankAccount) error {
	linked := false
	err := databases.RunInMoneyTransaction(ctx, gateway.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		account, err := gateway.FindConnectedAccountRowForUser(ctx, transaction, userId)
		if err != nil {
			return err
		}
		linked, err = gateway.claimSettlementAccountInTransaction(ctx, transaction, account, bank)
		return err
	})
	if err != nil {
		return err
	}
	if linked {
		return ErrBankAccountAlreadyLinked
	}
	return nil
}

func (gateway *PaymentGateway) claimSettlementAccountInTransaction(ctx context.Context, transaction *sql.Tx, account *ent.ConnectedAccount, bank interfaces.PayeeBankAccount) (bool, error) {
	client := gateway.Container.Client(transaction)
	fingerprint := gateway.settlementAccountFingerprint(bank.BankCode, bank.AccountNumber)
	currency := firstNonEmpty(bank.Currency, "NGN")
	if _, err := transaction.ExecContext(ctx, "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", "settlement-account:"+fingerprint); err != nil {
		return false, err
	}
	other, err := client.ProviderPayoutDestination.Query().Where(providerpayoutdestination.AccountFingerprint(fingerprint), providerpayoutdestination.Currency(currency),
		providerpayoutdestination.ConnectedAccountIDNEQ(account.ID)).First(ctx)
	if err == nil {
		return true, gateway.raiseDuplicateBankAccountAdvisory(ctx, transaction, account, other, fingerprint, bank)
	}
	if !ent.IsNotFound(err) {
		return false, err
	}
	if _, err := client.ProviderPayoutDestination.Delete().Where(providerpayoutdestination.ConnectedAccountID(account.ID), providerpayoutdestination.Currency(currency),
		providerpayoutdestination.AccountFingerprintNEQ(fingerprint)).Exec(ctx); err != nil {
		return false, err
	}
	err = client.ProviderPayoutDestination.Create().SetConnectedAccountID(account.ID).SetAccountFingerprint(fingerprint).SetCurrency(currency).
		SetBankCode(bank.BankCode).SetAccountLast4(lastFour(bank.AccountNumber)).SetProviderDestinationID(account.Provider).SetCreatedAt(gateway.Container.Now()).
		OnConflictColumns(providerpayoutdestination.FieldConnectedAccountID, providerpayoutdestination.FieldAccountFingerprint, providerpayoutdestination.FieldCurrency).
		DoNothing().Exec(ctx)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return false, err
	}
	return false, nil
}

func (gateway *PaymentGateway) raiseDuplicateBankAccountAdvisory(ctx context.Context, transaction *sql.Tx, account *ent.ConnectedAccount, other *ent.ProviderPayoutDestination, fingerprint string, bank interfaces.PayeeBankAccount) error {
	linkedUserId := ""
	if owner, err := gateway.Container.Client(transaction).ConnectedAccount.Query().Where(connectedaccount.ID(other.ConnectedAccountID)).Only(ctx); err == nil {
		linkedUserId = owner.UserID
	}
	gateway.Container.Resources.Logger.WarnContext(ctx, "payout bank account already linked to another store", "userId", account.UserID, "linkedUserId", linkedUserId)
	return gateway.Container.Outbox.EnqueueInTransaction(ctx, transaction, DuplicateBankAccountEventType, account.UserID, gateway.Container.Now().UTC(), map[string]any{
		"userId": account.UserID, "linkedUserId": linkedUserId, "accountLast4": lastFour(bank.AccountNumber), "bankCode": bank.BankCode,
		"suggestionId": "duplicate-bank:" + account.UserID + ":" + fingerprint[:16], "signals": []string{duplicateBankAccountSignal}, "riskScore": 40, "advisoryOnly": true,
	})
}

func IsDuplicateBankAccountJobError(lastError string) bool {
	return strings.HasPrefix(lastError, duplicateBankAccountCode)
}
