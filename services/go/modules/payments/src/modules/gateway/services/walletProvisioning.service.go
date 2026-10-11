package services

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"zudomart/modules/ledger/src/databases"
	"zudomart/modules/payments/src/generated/ent"
	"zudomart/modules/payments/src/generated/ent/payoutonboarding"
	"zudomart/modules/payments/src/generated/ent/providerwallet"
	"zudomart/modules/payments/src/generated/ent/providerwalletnumber"
	"zudomart/modules/payments/src/generated/ent/verificationlevelrecord"
	"zudomart/modules/payments/src/interfaces"
	"zudomart/modules/payments/src/modules/gateway/models"
	"zudomart/platform/httpserver"
)

var (
	ErrProviderWalletMissing     = httpserver.NewApiError(http.StatusConflict, "WALLET_NOT_READY", "Your wallet is not ready yet. Finish verification first.")
	ErrProviderWalletFrozen      = httpserver.NewApiError(http.StatusConflict, "WALLET_ON_HOLD", "Your wallet is on hold while we check it. Contact support if this lasts.")
	ErrProviderWalletUnavailable = httpserver.NewApiError(http.StatusServiceUnavailable, "WALLET_UNAVAILABLE", "We couldn't open your wallet right now. Try again shortly.")
)

const walletCurrency = "NGN"

func (gateway *PaymentGateway) walletProviderName() string {
	return gateway.Container.Settings.DefaultProvider
}

func (gateway *PaymentGateway) FindProviderWallet(ctx context.Context, executor databases.ExecutorQuerier, userId string) (*ent.ProviderWallet, error) {
	wallet, err := gateway.Container.Client(executor).ProviderWallet.Query().
		Where(providerwallet.Provider(gateway.walletProviderName()), providerwallet.UserID(userId), providerwallet.Currency(walletCurrency)).Only(ctx)
	if ent.IsNotFound(err) {
		return nil, ErrProviderWalletMissing
	}
	return wallet, err
}

func (gateway *PaymentGateway) FindActiveProviderWallet(ctx context.Context, executor databases.ExecutorQuerier, userId string) (*ent.ProviderWallet, error) {
	wallet, err := gateway.FindProviderWallet(ctx, executor, userId)
	if err != nil {
		return nil, err
	}
	if wallet.Status != providerwallet.StatusActive {
		return nil, ErrProviderWalletFrozen
	}
	return wallet, nil
}

func (gateway *PaymentGateway) aliasEmailFor(userId string) string {
	return fmt.Sprintf("u+%s@%s", strings.ReplaceAll(userId, "-", ""), gateway.Container.Settings.Wallets.AliasEmailDomain)
}

func (gateway *PaymentGateway) EnsureProviderWalletAtLevelOne(ctx context.Context, userId string) (*ent.ProviderWallet, error) {
	if existing, err := gateway.FindProviderWallet(ctx, gateway.Container.Resources.Database, userId); err == nil || !errors.Is(err, ErrProviderWalletMissing) {
		return existing, err
	}
	view, err := gateway.ReadVerificationLevel(ctx, userId)
	if err != nil {
		return nil, err
	}
	if view.Level < models.VerificationLevelPayout {
		return nil, ErrVerificationRequired
	}
	if !gateway.Container.Settings.Wallets.UsesProviderWallets(view.Country) {
		return nil, ErrProviderWalletMissing
	}
	onboarding, err := gateway.Container.Client(gateway.Container.Resources.Database).PayoutOnboarding.Query().Where(payoutonboarding.UserID(userId)).Only(ctx)
	if err != nil || onboarding.LegalName == "" {
		return nil, ErrVerificationRequired
	}
	return gateway.createProviderWallet(ctx, userId, onboarding.LegalName, view.Country)
}

func (gateway *PaymentGateway) EnsureProviderWalletForCardBuyer(ctx context.Context, userId string) (*ent.ProviderWallet, error) {
	if existing, err := gateway.FindProviderWallet(ctx, gateway.Container.Resources.Database, userId); err == nil || !errors.Is(err, ErrProviderWalletMissing) {
		return existing, err
	}
	if !gateway.Container.Settings.Wallets.CardBuyerWalletAtCheckout {
		return nil, ErrProviderWalletMissing
	}
	contact, err := gateway.requireVerifiedContact(ctx, userId)
	if err != nil {
		return nil, err
	}
	return gateway.createProviderWallet(ctx, userId, customerDisplayName(contact), "NG")
}

func (gateway *PaymentGateway) createProviderWallet(ctx context.Context, userId, accountName, country string) (*ent.ProviderWallet, error) {
	provider, err := gateway.Container.DefaultWallets()
	if err != nil {
		return nil, err
	}
	alias := gateway.aliasEmailFor(userId)
	created, err := provider.CreateWallet(ctx, interfaces.WalletOwner{UserId: userId, AccountName: accountName, AliasEmail: alias, Country: country})
	if err != nil {
		gateway.Container.Resources.Logger.WarnContext(ctx, "provider wallet creation failed; it is retried by the provisioning worker", "userId", userId, "error", err)
		return nil, ErrProviderWalletUnavailable
	}
	numbers, err := provider.ListFundingAccounts(ctx, created.AccountRef, walletCurrency)
	if err != nil {
		gateway.Container.Resources.Logger.WarnContext(ctx, "could not list the wallet's funding numbers; only the NUBAN is mapped", "userId", userId, "error", err)
	}
	numbers = append(numbers, interfaces.FundingAccount{AccountNumber: created.Nuban, BankCode: created.BankCode, BankName: created.BankName, Currency: walletCurrency})
	var stored *ent.ProviderWallet
	err = databases.RunInMoneyTransaction(ctx, gateway.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		client := gateway.Container.Client(transaction)
		err := client.ProviderWallet.Create().SetUserID(userId).SetProvider(gateway.walletProviderName()).SetCurrency(walletCurrency).
			SetAccountRef(created.AccountRef).SetBarterID(created.BarterId).SetNuban(created.Nuban).SetBankCode(created.BankCode).SetBankName(created.BankName).
			SetAccountName(truncate(accountName, 160)).SetAliasEmail(alias).SetCreatedAt(gateway.Container.Now()).
			OnConflictColumns(providerwallet.FieldProvider, providerwallet.FieldUserID, providerwallet.FieldCurrency).DoNothing().Exec(ctx)
		if err != nil && !errors.Is(err, sql.ErrNoRows) {
			return err
		}
		if stored, err = gateway.FindProviderWallet(ctx, transaction, userId); err != nil {
			return err
		}
		for _, number := range numbers {
			if number.AccountNumber == "" {
				continue
			}
			err := client.ProviderWalletNumber.Create().SetWalletID(stored.ID).SetProvider(stored.Provider).SetAccountNumber(number.AccountNumber).
				SetBankCode(number.BankCode).SetBankName(truncate(number.BankName, 120)).SetCreatedAt(gateway.Container.Now()).
				OnConflictColumns(providerwalletnumber.FieldProvider, providerwalletnumber.FieldAccountNumber).DoNothing().Exec(ctx)
			if err != nil && !errors.Is(err, sql.ErrNoRows) {
				return err
			}
		}
		return gateway.Container.Outbox.EnqueueInTransaction(ctx, transaction, "providerWallet.created", userId, gateway.Container.Now().UTC(), map[string]any{
			"userId": userId, "provider": stored.Provider, "currency": stored.Currency, "accountNumberLast4": lastFour(stored.Nuban),
		})
	})
	return stored, err
}

func (gateway *PaymentGateway) ProvisionMissingProviderWallets(ctx context.Context, limit int) int {
	if !gateway.Container.UsesProviderWallets() {
		return 0
	}
	database := gateway.Container.Resources.Database
	records, err := gateway.Container.Client(database).VerificationLevelRecord.Query().Where(verificationlevelrecord.LevelGTE(models.VerificationLevelPayout)).
		Order(ent.Desc(verificationlevelrecord.FieldUpdatedAt)).Limit(limit * 4).All(ctx)
	if err != nil {
		gateway.Container.Resources.Logger.WarnContext(ctx, "could not list verified users for wallet provisioning", "error", err)
		return 0
	}
	created := 0
	for _, record := range records {
		if created >= limit {
			break
		}
		exists, err := gateway.Container.Client(database).ProviderWallet.Query().Where(providerwallet.UserID(record.UserID), providerwallet.Provider(gateway.walletProviderName())).Exist(ctx)
		if err != nil || exists {
			continue
		}
		if _, err := gateway.EnsureProviderWalletAtLevelOne(ctx, record.UserID); err == nil {
			created++
		}
	}
	return created
}

func (gateway *PaymentGateway) FindProviderWalletByAccountNumber(ctx context.Context, executor databases.ExecutorQuerier, accountNumber string) (*ent.ProviderWallet, error) {
	client := gateway.Container.Client(executor)
	number, err := client.ProviderWalletNumber.Query().Where(providerwalletnumber.Provider(gateway.walletProviderName()), providerwalletnumber.AccountNumber(accountNumber)).Only(ctx)
	if ent.IsNotFound(err) {
		return nil, ErrProviderWalletMissing
	}
	if err != nil {
		return nil, err
	}
	return client.ProviderWallet.Get(ctx, number.WalletID)
}

func ConvertProviderWalletToView(wallet *ent.ProviderWallet, numbers []*ent.ProviderWalletNumber) models.ProviderWalletView {
	view := models.ProviderWalletView{
		Provider: wallet.Provider, Currency: wallet.Currency, Status: string(wallet.Status), AccountName: wallet.AccountName, AccountNumber: wallet.Nuban,
		BankName: wallet.BankName, BankCode: wallet.BankCode, CreatedAt: wallet.CreatedAt, FrozenAt: wallet.FrozenAt, FundingNumbers: []models.FundingNumberView{},
	}
	for _, number := range numbers {
		view.FundingNumbers = append(view.FundingNumbers, models.FundingNumberView{AccountNumber: number.AccountNumber, BankName: number.BankName})
	}
	return view
}
