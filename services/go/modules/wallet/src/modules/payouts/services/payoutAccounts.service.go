package services

import (
	"context"
	"errors"
	"net/http"

	"github.com/google/uuid"

	"zudomart/modules/payments/src/interfaces"
	bankservices "zudomart/modules/payments/src/modules/banks/services"
	"zudomart/modules/wallet/src/container"
	"zudomart/modules/wallet/src/generated/ent"
	"zudomart/modules/wallet/src/generated/ent/payoutaccount"
	"zudomart/modules/wallet/src/modules/payouts/dtos"
	"zudomart/platform/httpserver"
)

var (
	ErrPayoutAccountNotFound = httpserver.NewApiError(http.StatusNotFound, "PAYOUT_ACCOUNT_NOT_FOUND", "Choose a payout account.")
	ErrUnknownBank           = httpserver.NewApiError(http.StatusUnprocessableEntity, "UNKNOWN_BANK", "Choose your bank.")
	ErrBankAccountNotFound   = httpserver.NewApiError(http.StatusUnprocessableEntity, "ACCOUNT_NOT_FOUND", "We could not find that account. Check the number and bank.")
	ErrTooManyPayoutAccounts = httpserver.NewApiError(http.StatusConflict, "TOO_MANY_PAYOUT_ACCOUNTS", "You can save up to 5 payout accounts.")
)

type PayoutAccounts struct {
	Container *container.Container
	Banks     *bankservices.BankDirectory
}

func (accounts PayoutAccounts) AddPayoutAccount(ctx context.Context, userId, countryCode, bankCode, accountNumber string) (dtos.PayoutAccountDto, error) {
	bank, known := bankservices.IsBankKnownInCountry(accounts.Banks.ListBanksForCountry(ctx, countryCode), bankCode)
	if !known {
		return dtos.PayoutAccountDto{}, ErrUnknownBank
	}
	accountName, err := accounts.Banks.Provider.ResolveBankAccountName(ctx, bankCode, accountNumber)
	if errors.Is(err, interfaces.ErrBankAccountNotFound) {
		return dtos.PayoutAccountDto{}, ErrBankAccountNotFound
	}
	if err != nil {
		return dtos.PayoutAccountDto{}, httpserver.NewApiError(http.StatusBadGateway, "BANK_LOOKUP_UNAVAILABLE", "We could not confirm this account right now. Try again shortly.")
	}
	client := accounts.Container.Client(accounts.Container.Resources.Database)
	fingerprint := accounts.Container.Encryptor.Fingerprint(bankCode + ":" + accountNumber)
	existing, err := client.PayoutAccount.Query().Where(payoutaccount.UserID(userId), payoutaccount.DeletedAtIsNil(), payoutaccount.AccountNumberFingerprint(fingerprint), payoutaccount.BankCode(bankCode)).Only(ctx)
	if err == nil {
		return ConvertPayoutAccount(existing), nil
	}
	if !ent.IsNotFound(err) {
		return dtos.PayoutAccountDto{}, err
	}
	count, err := client.PayoutAccount.Query().Where(payoutaccount.UserID(userId), payoutaccount.DeletedAtIsNil()).Count(ctx)
	if err != nil {
		return dtos.PayoutAccountDto{}, err
	}
	if count >= 5 {
		return dtos.PayoutAccountDto{}, ErrTooManyPayoutAccounts
	}
	identifier := uuid.Must(uuid.NewV7())
	ciphertext, err := accounts.Container.Encryptor.Encrypt(accountNumber, identifier.String())
	if err != nil {
		return dtos.PayoutAccountDto{}, err
	}
	created, err := client.PayoutAccount.Create().SetID(identifier).SetUserID(userId).SetCountryCode(countryCode).SetBankCode(bankCode).
		SetBankName(bank.Name).SetAccountNumberCiphertext(ciphertext).SetAccountNumberFingerprint(fingerprint).
		SetAccountNumberLast4(accountNumber[len(accountNumber)-4:]).SetAccountName(accountName).SetIsDefault(count == 0).
		SetCreatedAt(accounts.Container.Now().UTC()).Save(ctx)
	if err != nil {
		return dtos.PayoutAccountDto{}, err
	}
	if err := accounts.Container.Payments.RequestPayoutAccountWhenMissing(ctx, userId); err != nil {
		accounts.Container.Resources.Logger.WarnContext(ctx, "requesting the payout account failed", "error", err)
	}
	return ConvertPayoutAccount(created), nil
}

func (accounts PayoutAccounts) ListPayoutAccounts(ctx context.Context, userId string) ([]dtos.PayoutAccountDto, error) {
	rows, err := accounts.Container.Client(accounts.Container.Resources.Database).PayoutAccount.Query().
		Where(payoutaccount.UserID(userId), payoutaccount.DeletedAtIsNil()).Order(ent.Desc(payoutaccount.FieldIsDefault), ent.Asc(payoutaccount.FieldCreatedAt)).All(ctx)
	if err != nil {
		return nil, err
	}
	converted := make([]dtos.PayoutAccountDto, len(rows))
	for index, row := range rows {
		converted[index] = ConvertPayoutAccount(row)
	}
	return converted, nil
}

func (accounts PayoutAccounts) RemovePayoutAccount(ctx context.Context, userId string, accountId uuid.UUID) error {
	updated, err := accounts.Container.Client(accounts.Container.Resources.Database).PayoutAccount.Update().
		Where(payoutaccount.ID(accountId), payoutaccount.UserID(userId), payoutaccount.DeletedAtIsNil()).
		SetDeletedAt(accounts.Container.Now().UTC()).SetIsDefault(false).Save(ctx)
	if err != nil {
		return err
	}
	if updated == 0 {
		return ErrPayoutAccountNotFound
	}
	return nil
}

func ConvertPayoutAccount(account *ent.PayoutAccount) dtos.PayoutAccountDto {
	return dtos.PayoutAccountDto{
		Id: account.ID.String(), BankCode: account.BankCode, BankName: account.BankName, AccountNumberMasked: "••••" + account.AccountNumberLast4,
		AccountName: account.AccountName, CountryCode: account.CountryCode, IsDefault: account.IsDefault, NameMatchStatus: string(account.NameMatchStatus),
	}
}
