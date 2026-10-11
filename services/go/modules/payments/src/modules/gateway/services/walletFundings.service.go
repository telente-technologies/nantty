package services

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"zudomart/modules/ledger/src/databases"
	ledgermodels "zudomart/modules/ledger/src/modules/journal/models"
	"zudomart/modules/payments/src/generated/ent"
	"zudomart/modules/payments/src/generated/ent/providerwallet"
	"zudomart/modules/payments/src/generated/ent/walletfunding"
	"zudomart/modules/payments/src/interfaces"
	"zudomart/modules/payments/src/modules/gateway/models"
)

var errFundingNotYetInStatement = errors.New("the funding is not in the wallet statement yet; it is checked again")

type verifiedFunding struct {
	grossMinor, providerFeeMinor int64
}

func (gateway *PaymentGateway) HandleWalletFundingNotification(ctx context.Context, notification interfaces.WebhookNotification) error {
	if notification.Reference == "" || notification.AccountNumber == "" {
		return nil
	}
	database := gateway.Container.Resources.Database
	if exists, err := gateway.Container.Client(database).WalletFunding.Query().Where(walletfunding.Provider(gateway.walletProviderName()), walletfunding.ProviderReference(notification.Reference)).Exist(ctx); err != nil || exists {
		return err
	}
	wallet, err := gateway.FindProviderWalletByAccountNumber(ctx, database, notification.AccountNumber)
	if errors.Is(err, ErrProviderWalletMissing) {
		gateway.OpenReconciliationCase(ctx, "fundingToUnknownAccount", "account ••••"+lastFour(notification.AccountNumber), notification.Reference, 0, notification.AmountMinor, "NGN", "a wallet funding arrived for an account number we do not know")
		return nil
	}
	if err != nil {
		return err
	}
	provider, err := gateway.Container.Wallets(wallet.Provider)
	if err != nil {
		return err
	}
	if owner, found, err := provider.FindWalletByAccountNumber(ctx, notification.AccountNumber); err == nil && found && owner.AccountRef != wallet.AccountRef {
		gateway.OpenReconciliationCase(ctx, "fundingAccountOwnerMismatch", wallet.AccountRef, notification.Reference, 0, 0, wallet.Currency, "the provider maps this account number to another wallet")
		return nil
	}
	verified, err := gateway.verifyFundingInStatement(ctx, provider, wallet, notification.Reference)
	if err != nil {
		return err
	}
	if notification.AmountMinor > 0 && notification.AmountMinor != verified.grossMinor {
		gateway.OpenReconciliationCase(ctx, "fundingHintDiffers", wallet.AccountRef, notification.Reference, verified.grossMinor, notification.AmountMinor, wallet.Currency, "the webhook amount differs from the wallet statement; the statement amount was credited")
	}
	var sweepReference string
	err = databases.RunInMoneyTransaction(ctx, database, func(ctx context.Context, transaction *sql.Tx) error {
		sweepReference, err = gateway.creditWalletFundingInTransaction(ctx, transaction, wallet.ID.String(), notification, verified)
		return err
	})
	if err != nil || sweepReference == "" {
		return err
	}
	if err := gateway.SendMovement(ctx, sweepReference); err != nil {
		gateway.Container.Resources.Logger.WarnContext(ctx, "deposit fee sweep did not go out yet; the movement worker retries it", "reference", sweepReference, "error", err)
	}
	return nil
}

func (gateway *PaymentGateway) verifyFundingInStatement(ctx context.Context, provider interfaces.WalletProvider, wallet *ent.ProviderWallet, reference string) (verifiedFunding, error) {
	now := gateway.Container.Now().UTC()
	lines, err := provider.ListWalletTransactions(ctx, wallet.AccountRef, now.AddDate(0, 0, -3), now.AddDate(0, 0, 1))
	if err != nil {
		return verifiedFunding{}, convertProviderError(err)
	}
	var verified verifiedFunding
	for _, line := range lines {
		if line.Currency != "" && line.Currency != wallet.Currency {
			continue
		}
		switch {
		case line.Direction == "credit" && line.Reference == reference:
			verified.grossMinor += line.AmountMinor
		case line.Direction == "debit" && line.Reference != reference && strings.HasPrefix(line.Reference, reference) && strings.Contains(strings.ToUpper(line.Narration), "FEE"):
			verified.providerFeeMinor += line.AmountMinor
		}
	}
	if verified.grossMinor <= 0 {
		return verifiedFunding{}, errFundingNotYetInStatement
	}
	if verified.providerFeeMinor > verified.grossMinor {
		return verifiedFunding{}, fmt.Errorf("funding %s has a fee above its amount", reference)
	}
	return verified, nil
}

func (gateway *PaymentGateway) creditWalletFundingInTransaction(ctx context.Context, transaction *sql.Tx, walletId string, notification interfaces.WebhookNotification, verified verifiedFunding) (string, error) {
	client := gateway.Container.Client(transaction)
	wallet, err := client.ProviderWallet.Query().Where(providerwallet.AccountRefNEQ(""), providerwallet.IDEQ(mustUuid(walletId))).ForUpdate().Only(ctx)
	if err != nil {
		return "", err
	}
	if exists, err := client.WalletFunding.Query().Where(walletfunding.Provider(wallet.Provider), walletfunding.ProviderReference(notification.Reference)).Exist(ctx); err != nil || exists {
		return "", err
	}
	settings := gateway.Container.Settings.Wallets
	net := verified.grossMinor - verified.providerFeeMinor
	depositFee := settings.DepositFee(wallet.Currency, net)
	now := gateway.Container.Now().UTC()
	hold := settings.DepositHold
	if wallet.FirstFundedAt == nil {
		hold = max(settings.FirstDepositHold, hold)
		if err := wallet.Update().SetFirstFundedAt(now).AddVersion(1).Exec(ctx); err != nil {
			return "", err
		}
	}
	mirror := ledgermodels.ProviderWalletMirrorAccount(wallet.Provider, wallet.AccountRef, wallet.Currency)
	depositHold := ledgermodels.WalletDepositHoldAccount(wallet.UserID, wallet.Currency)
	lines := []ledgermodels.JournalLineRequest{
		{Account: mirror, Direction: ledgermodels.Debit, AmountMinor: net},
		{Account: depositHold, Direction: ledgermodels.Credit, AmountMinor: net},
	}
	if _, err := gateway.Container.Ledger.PostBalancedJournalEntry(ctx, transaction, ledgermodels.JournalEntryRequest{
		Reference: "fund:" + notification.Reference, Kind: "wallet.funded", ExternalReference: notification.Reference, Description: "Money added to your wallet",
		Metadata: map[string]any{"walletId": walletId, "grossMinor": verified.grossMinor, "providerFeeMinor": verified.providerFeeMinor}, Lines: lines,
	}); err != nil {
		return "", err
	}
	sweepReference := ""
	if depositFee > 0 {
		sweepReference = models.NewMovementReference(models.MovementFeeSweep)
		if err := gateway.reserveWalletMoneyInTransaction(ctx, transaction, wallet.UserID, wallet.Currency, depositHold, depositFee, "sweep-reserve:"+notification.Reference, "Deposit fee"); err != nil {
			return "", err
		}
		if _, err := gateway.EnqueueMovementInTransaction(ctx, transaction, models.MovementRequest{
			Reference: sweepReference, Kind: models.MovementFeeSweep, SubjectId: notification.Reference, UserId: wallet.UserID, FromUserId: wallet.UserID,
			ToPlatform: true, AmountMinor: depositFee, Currency: wallet.Currency,
		}); err != nil {
			return "", err
		}
	}
	funding, err := client.WalletFunding.Create().SetWalletID(wallet.ID).SetUserID(wallet.UserID).SetProvider(wallet.Provider).SetProviderReference(notification.Reference).
		SetAccountNumber(notification.AccountNumber).SetGrossMinor(verified.grossMinor).SetProviderFeeMinor(verified.providerFeeMinor).SetDepositFeeMinor(depositFee).
		SetHintedMinor(max(notification.AmountMinor, 0)).SetCurrency(wallet.Currency).SetHoldReleaseAt(now.Add(hold)).SetSweepReference(sweepReference).SetCreatedAt(now).Save(ctx)
	if err != nil {
		return "", err
	}
	return sweepReference, gateway.Container.Outbox.EnqueueInTransaction(ctx, transaction, "wallet.funded", funding.ID.String(), now, map[string]any{
		"fundingId": funding.ID.String(), "userId": wallet.UserID, "holdReleaseAt": funding.HoldReleaseAt.Format(time.RFC3339),
		"amount": map[string]any{"amountMinor": verified.grossMinor, "currency": wallet.Currency}, "providerFee": map[string]any{"amountMinor": verified.providerFeeMinor, "currency": wallet.Currency},
		"depositFee": map[string]any{"amountMinor": depositFee, "currency": wallet.Currency},
	})
}

func (gateway *PaymentGateway) reserveWalletMoneyInTransaction(ctx context.Context, transaction *sql.Tx, userId, currency string, source ledgermodels.AccountRef, amountMinor int64, reference, description string) error {
	_, err := gateway.Container.Ledger.PostBalancedJournalEntry(ctx, transaction, ledgermodels.JournalEntryRequest{
		Reference: reference, Kind: "wallet.reservedForMovement", Description: description,
		Lines: []ledgermodels.JournalLineRequest{
			{Account: source, Direction: ledgermodels.Debit, AmountMinor: amountMinor},
			{Account: ledgermodels.WalletOutgoingAccount(userId, currency), Direction: ledgermodels.Credit, AmountMinor: amountMinor},
		},
	})
	return err
}

func (gateway *PaymentGateway) ReleaseDueWalletHolds(ctx context.Context, limit int) int {
	client := gateway.Container.Client(gateway.Container.Resources.Database)
	due, err := client.WalletFunding.Query().Where(walletfunding.StatusEQ(walletfunding.StatusHeld), walletfunding.HoldReleaseAtLTE(gateway.Container.Now().UTC())).
		Order(ent.Asc(walletfunding.FieldHoldReleaseAt)).Limit(limit).All(ctx)
	if err != nil {
		return 0
	}
	released := 0
	for _, funding := range due {
		err := databases.RunInMoneyTransaction(ctx, gateway.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
			return gateway.releaseWalletHoldInTransaction(ctx, transaction, funding.ID.String())
		})
		if err != nil {
			gateway.Container.Resources.Logger.WarnContext(ctx, "wallet hold release failed; it is retried", "fundingId", funding.ID.String(), "error", err)
			continue
		}
		released++
	}
	return released
}

func (gateway *PaymentGateway) releaseWalletHoldInTransaction(ctx context.Context, transaction *sql.Tx, fundingId string) error {
	client := gateway.Container.Client(transaction)
	funding, err := client.WalletFunding.Query().Where(walletfunding.ID(mustUuid(fundingId))).ForUpdate().Only(ctx)
	if err != nil || funding.Status != walletfunding.StatusHeld {
		return err
	}
	depositHold := ledgermodels.WalletDepositHoldAccount(funding.UserID, funding.Currency)
	balance, err := gateway.Container.Ledger.ReadAccountBalance(ctx, transaction, depositHold)
	if err != nil {
		return err
	}
	amount := min(max(balance, 0), funding.GrossMinor-funding.ProviderFeeMinor-funding.DepositFeeMinor)
	if amount > 0 {
		if _, err := gateway.Container.Ledger.PostBalancedJournalEntry(ctx, transaction, ledgermodels.JournalEntryRequest{
			Reference: "hold-release:" + funding.ID.String(), Kind: "wallet.holdReleased", Description: "Money is now available to withdraw",
			Lines: []ledgermodels.JournalLineRequest{
				{Account: depositHold, Direction: ledgermodels.Debit, AmountMinor: amount},
				{Account: ledgermodels.WalletAvailableAccount(funding.UserID, funding.Currency), Direction: ledgermodels.Credit, AmountMinor: amount},
			},
		}); err != nil {
			return err
		}
	}
	return funding.Update().SetStatus(walletfunding.StatusAvailable).SetHoldReleasedAt(gateway.Container.Now().UTC()).AddVersion(1).Exec(ctx)
}
