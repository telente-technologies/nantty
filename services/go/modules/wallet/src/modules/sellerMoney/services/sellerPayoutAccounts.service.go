package services

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/google/uuid"

	"nantty/modules/payments/src/interfaces"
	bankservices "nantty/modules/payments/src/modules/banks/services"
	"nantty/modules/wallet/src/generated/ent"
	"nantty/modules/wallet/src/generated/ent/payoutaccount"
	"nantty/modules/wallet/src/generated/ent/payoutaccountresolution"
	"nantty/modules/wallet/src/generated/ent/withdrawal"
	"nantty/modules/wallet/src/modules/payouts"
	"nantty/modules/wallet/src/modules/sellerMoney/dtos"
	"nantty/platform/httpserver"
)

const resolutionLifetime = 10 * time.Minute

var (
	ErrAccountNotResolved    = httpserver.NewApiError(http.StatusUnprocessableEntity, "ACCOUNT_NOT_RESOLVED", "We could not find that account. Check the number and bank.")
	ErrResolutionExpired     = httpserver.NewApiError(http.StatusUnprocessableEntity, "RESOLUTION_EXPIRED", "That account check has expired. Look the account up again.")
	ErrAccountExists         = httpserver.NewApiError(http.StatusConflict, "ACCOUNT_EXISTS", "That account is already saved.")
	ErrAccountNotFound       = httpserver.NewApiError(http.StatusNotFound, "ACCOUNT_NOT_FOUND", "That payout account could not be found.")
	ErrDefaultAccount        = httpserver.NewApiError(http.StatusConflict, "DEFAULT_ACCOUNT", "Make another account the default first.")
	ErrPayoutInProgress      = httpserver.NewApiError(http.StatusConflict, "PAYOUT_IN_PROGRESS", "A payout to this account is still in progress.")
	ErrBankLookupUnavailable = httpserver.NewApiError(http.StatusBadGateway, "BANK_LOOKUP_UNAVAILABLE", "We could not confirm this account right now. Try again shortly.")
)

type SellerPayoutAccounts struct {
	Payouts *payouts.Application
}

func (accounts SellerPayoutAccounts) client() *ent.Client {
	return accounts.Payouts.Container.Client(accounts.Payouts.Container.Resources.Database)
}

func PayoutAccountViewOf(row *ent.PayoutAccount) dtos.PayoutAccountView {
	return dtos.PayoutAccountView{Id: row.ID.String(), BankName: row.BankName, BankCode: row.BankCode, AccountNameMasked: MaskAccountName(row.AccountName),
		AccountNumberMasked: MaskAccountNumber(row.AccountNumberLast4), IsDefault: row.IsDefault, Verified: row.NameMatchStatus != payoutaccount.NameMatchStatusMismatched}
}

func (accounts SellerPayoutAccounts) List(ctx context.Context, seller dtos.SellerContext) ([]dtos.PayoutAccountView, error) {
	rows, err := accounts.client().PayoutAccount.Query().Where(payoutaccount.UserID(seller.SellerId), payoutaccount.DeletedAtIsNil()).
		Order(ent.Desc(payoutaccount.FieldIsDefault), ent.Asc(payoutaccount.FieldCreatedAt)).All(ctx)
	if err != nil {
		return nil, err
	}
	views := make([]dtos.PayoutAccountView, 0, len(rows))
	for _, row := range rows {
		views = append(views, PayoutAccountViewOf(row))
	}
	return views, nil
}

func (accounts SellerPayoutAccounts) ListBanks(ctx context.Context, seller dtos.SellerContext) []dtos.BankView {
	banks := accounts.Payouts.Accounts.Banks.ListBanksForCountry(ctx, seller.CountryCode)
	views := make([]dtos.BankView, 0, len(banks))
	for _, bank := range banks {
		views = append(views, dtos.BankView{Code: bank.Code, Name: bank.Name})
	}
	return views
}

func (accounts SellerPayoutAccounts) Resolve(ctx context.Context, seller dtos.SellerContext, body dtos.ResolvePayoutAccountBody) (dtos.ResolvedPayoutAccountView, error) {
	bank, known := bankservices.IsBankKnownInCountry(accounts.Payouts.Accounts.Banks.ListBanksForCountry(ctx, seller.CountryCode), body.BankCode)
	if !known {
		return dtos.ResolvedPayoutAccountView{}, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "bankCode", Message: "must be a bank from the list"}})
	}
	name, err := accounts.Payouts.Accounts.ResolveAccountName(ctx, body.BankCode, body.AccountNumber)
	if errors.Is(err, interfaces.ErrBankAccountNotFound) || (err == nil && name == "") {
		return dtos.ResolvedPayoutAccountView{}, ErrAccountNotResolved
	}
	if err != nil {
		return dtos.ResolvedPayoutAccountView{}, ErrBankLookupUnavailable
	}
	identifier := uuid.Must(uuid.NewV7())
	ciphertext, err := accounts.Payouts.Container.Encryptor.Encrypt(body.AccountNumber, identifier.String())
	if err != nil {
		return dtos.ResolvedPayoutAccountView{}, err
	}
	now := accounts.Payouts.Container.Now().UTC()
	lastFour := body.AccountNumber[len(body.AccountNumber)-4:]
	err = accounts.client().PayoutAccountResolution.Create().SetID(identifier).SetUserID(seller.SellerId).SetCountryCode(seller.CountryCode).SetBankCode(bank.Code).
		SetBankName(bank.Name).SetAccountNumberCiphertext(ciphertext).SetAccountNumberLast4(lastFour).SetAccountName(name).SetCreatedAt(now).SetExpiresAt(now.Add(resolutionLifetime)).Exec(ctx)
	if err != nil {
		return dtos.ResolvedPayoutAccountView{}, err
	}
	return dtos.ResolvedPayoutAccountView{ResolutionId: identifier.String(), BankCode: bank.Code, BankName: bank.Name, AccountNameMasked: MaskAccountName(name), AccountNumberMasked: MaskAccountNumber(lastFour)}, nil
}

func (accounts SellerPayoutAccounts) AddFromResolution(ctx context.Context, seller dtos.SellerContext, resolutionId uuid.UUID) (dtos.PayoutAccountView, error) {
	now := accounts.Payouts.Container.Now().UTC()
	claimed, err := accounts.client().PayoutAccountResolution.Update().Where(payoutaccountresolution.ID(resolutionId), payoutaccountresolution.UserID(seller.SellerId),
		payoutaccountresolution.UsedAtIsNil(), payoutaccountresolution.ExpiresAtGT(now)).SetUsedAt(now).Save(ctx)
	if err != nil {
		return dtos.PayoutAccountView{}, err
	}
	if claimed == 0 {
		return dtos.PayoutAccountView{}, ErrResolutionExpired
	}
	resolution, err := accounts.client().PayoutAccountResolution.Get(ctx, resolutionId)
	if err != nil {
		return dtos.PayoutAccountView{}, err
	}
	number, err := accounts.Payouts.Container.Encryptor.Decrypt(resolution.AccountNumberCiphertext, resolution.ID.String())
	if err != nil {
		return dtos.PayoutAccountView{}, err
	}
	fingerprint := accounts.Payouts.Container.Encryptor.Fingerprint(resolution.BankCode + ":" + number)
	exists, err := accounts.client().PayoutAccount.Query().Where(payoutaccount.UserID(seller.SellerId), payoutaccount.DeletedAtIsNil(), payoutaccount.AccountNumberFingerprint(fingerprint), payoutaccount.BankCode(resolution.BankCode)).Exist(ctx)
	if err != nil {
		return dtos.PayoutAccountView{}, err
	}
	if exists {
		return dtos.PayoutAccountView{}, ErrAccountExists
	}
	added, err := accounts.Payouts.Accounts.AddPayoutAccount(ctx, seller.SellerId, resolution.CountryCode, resolution.BankCode, number)
	if err != nil {
		return dtos.PayoutAccountView{}, err
	}
	row, err := accounts.client().PayoutAccount.Get(ctx, uuid.MustParse(added.Id))
	if err != nil {
		return dtos.PayoutAccountView{}, err
	}
	return PayoutAccountViewOf(row), nil
}

func (accounts SellerPayoutAccounts) MakeDefault(ctx context.Context, seller dtos.SellerContext, accountId uuid.UUID) (dtos.PayoutAccountView, error) {
	tx, err := accounts.Payouts.Container.Resources.Database.BeginTx(ctx, nil)
	if err != nil {
		return dtos.PayoutAccountView{}, err
	}
	defer func() { _ = tx.Rollback() }()
	client := accounts.Payouts.Container.Client(tx)
	target, err := client.PayoutAccount.Query().Where(payoutaccount.ID(accountId), payoutaccount.UserID(seller.SellerId), payoutaccount.DeletedAtIsNil()).ForUpdate().Only(ctx)
	if ent.IsNotFound(err) {
		return dtos.PayoutAccountView{}, ErrAccountNotFound
	}
	if err != nil {
		return dtos.PayoutAccountView{}, err
	}
	if err := client.PayoutAccount.Update().Where(payoutaccount.UserID(seller.SellerId), payoutaccount.IDNEQ(target.ID)).SetIsDefault(false).Exec(ctx); err != nil {
		return dtos.PayoutAccountView{}, err
	}
	updated, err := target.Update().SetIsDefault(true).Save(ctx)
	if err != nil {
		return dtos.PayoutAccountView{}, err
	}
	if !target.IsDefault {
		if err := accounts.Payouts.Accounts.EnqueuePayoutAccountChanged(ctx, tx, "payoutAccount.defaultChanged", updated, accounts.Payouts.Container.Now().UTC()); err != nil {
			return dtos.PayoutAccountView{}, err
		}
	}
	return PayoutAccountViewOf(updated), tx.Commit()
}

func (accounts SellerPayoutAccounts) Remove(ctx context.Context, seller dtos.SellerContext, accountId uuid.UUID) error {
	client := accounts.client()
	target, err := client.PayoutAccount.Query().Where(payoutaccount.ID(accountId), payoutaccount.UserID(seller.SellerId), payoutaccount.DeletedAtIsNil()).Only(ctx)
	if ent.IsNotFound(err) {
		return ErrAccountNotFound
	}
	if err != nil {
		return err
	}
	inFlight, err := client.Withdrawal.Query().Where(withdrawal.PayoutAccountID(accountId), withdrawal.StatusIn(withdrawal.StatusPendingReview, withdrawal.StatusQueued, withdrawal.StatusProcessing)).Exist(ctx)
	if err != nil {
		return err
	}
	if inFlight {
		return ErrPayoutInProgress
	}
	if target.IsDefault {
		others, err := client.PayoutAccount.Query().Where(payoutaccount.UserID(seller.SellerId), payoutaccount.DeletedAtIsNil(), payoutaccount.IDNEQ(accountId)).Count(ctx)
		if err != nil {
			return err
		}
		if others > 0 {
			return ErrDefaultAccount
		}
	}
	return accounts.Payouts.Accounts.RemovePayoutAccount(ctx, seller.SellerId, accountId)
}
