package services

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"

	"nantty/modules/ads/src/container"
	adserrors "nantty/modules/ads/src/errors"
	"nantty/modules/ads/src/generated/ent"
	"nantty/modules/ads/src/generated/ent/adaccount"
	"nantty/modules/ads/src/generated/ent/adbalancewithdrawal"
	"nantty/modules/ads/src/generated/ent/adfundstransaction"
	"nantty/modules/ads/src/interfaces"
	boostdtos "nantty/modules/ads/src/modules/boosts/dtos"
	boostservices "nantty/modules/ads/src/modules/boosts/services"
	adsservices "nantty/modules/ads/src/services"
	"nantty/modules/ads/src/types"
	"nantty/platform/httpserver"
)

const WithdrawalDestinationWallet = "wallet"

func validateWithdrawalAmount(deployed *container.Container, amount types.Money, currency string) error {
	if amount.Currency != currency || amount.AmountMinor < MinimumWithdrawalMinor(deployed, currency) {
		return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "amount", Message: "Enter at least the minimum withdrawal, in your ad balance currency."}})
	}
	return nil
}

func aboveAvailable(withdrawableMinor int64, currency string) error {
	return adserrors.WithdrawalAboveAvailable.WithDetails(map[string]any{"withdrawable": types.Money{AmountMinor: withdrawableMinor, Currency: currency}})
}

func QuoteAdBalanceWithdrawal(ctx context.Context, deployed *container.Container, userId uuid.UUID, currency string, amount types.Money) (boostdtos.AdBalanceWithdrawalQuote, error) {
	if err := validateWithdrawalAmount(deployed, amount, currency); err != nil {
		return boostdtos.AdBalanceWithdrawalQuote{}, err
	}
	withdrawable := int64(0)
	account, err := boostservices.FindPersonalBoostAccount(ctx, deployed.Client, userId, currency)
	if err != nil {
		return boostdtos.AdBalanceWithdrawalQuote{}, err
	}
	if account != nil {
		position, err := adsservices.ReadAdFundsPosition(ctx, deployed.Client, account, deployed.Now())
		if err != nil {
			return boostdtos.AdBalanceWithdrawalQuote{}, err
		}
		withdrawable = position.WithdrawableMinor
	}
	if amount.AmountMinor > withdrawable {
		return boostdtos.AdBalanceWithdrawalQuote{}, aboveAvailable(withdrawable, currency)
	}
	fee := WithdrawalFeeMinor(deployed, amount.AmountMinor, currency)
	money := func(value int64) types.Money { return types.Money{AmountMinor: value, Currency: currency} }
	return boostdtos.AdBalanceWithdrawalQuote{Amount: amount, Fee: money(fee), Net: money(amount.AmountMinor - fee), Destination: WithdrawalDestinationWallet, Withdrawable: money(withdrawable)}, nil
}

func WithdrawAdBalance(ctx context.Context, deployed *container.Container, userId uuid.UUID, currency, idempotencyKey string, amount types.Money) (boostdtos.AdBalanceWithdrawalView, error) {
	if err := validateWithdrawalAmount(deployed, amount, currency); err != nil {
		return boostdtos.AdBalanceWithdrawalView{}, err
	}
	if err := adsservices.RequirePayoutVerified(ctx, deployed.Verification, userId.String()); err != nil {
		return boostdtos.AdBalanceWithdrawalView{}, err
	}
	existing, err := findWithdrawal(ctx, deployed.Client, userId, idempotencyKey)
	if err != nil {
		return boostdtos.AdBalanceWithdrawalView{}, err
	}
	if existing == nil {
		existing, err = reserveWithdrawal(ctx, deployed, userId, currency, idempotencyKey, amount)
		if ent.IsConstraintError(err) {
			existing, err = findWithdrawal(ctx, deployed.Client, userId, idempotencyKey)
		}
		if err != nil {
			return boostdtos.AdBalanceWithdrawalView{}, err
		}
	}
	if existing.GrossMinor != amount.AmountMinor || existing.Currency != amount.Currency {
		return boostdtos.AdBalanceWithdrawalView{}, adserrors.IdempotencyKeyReused
	}
	settled, err := SettleWithdrawal(ctx, deployed, existing)
	if err != nil {
		return boostdtos.AdBalanceWithdrawalView{}, err
	}
	return PresentWithdrawal(settled), nil
}

func findWithdrawal(ctx context.Context, client *ent.Client, userId uuid.UUID, key string) (*ent.AdBalanceWithdrawal, error) {
	row, err := client.AdBalanceWithdrawal.Query().Where(adbalancewithdrawal.UserID(userId), adbalancewithdrawal.IdempotencyKey(key)).Only(ctx)
	if ent.IsNotFound(err) {
		return nil, nil
	}
	return row, err
}

func reserveWithdrawal(ctx context.Context, deployed *container.Container, userId uuid.UUID, currency, key string, amount types.Money) (*ent.AdBalanceWithdrawal, error) {
	var reserved *ent.AdBalanceWithdrawal
	err := deployed.RunInTransaction(ctx, func(tx *ent.Tx) error {
		account, err := boostservices.FindPersonalBoostAccount(ctx, tx.Client(), userId, currency)
		if err != nil {
			return err
		}
		if account == nil {
			return aboveAvailable(0, currency)
		}
		if account, err = tx.AdAccount.Query().Where(adaccount.ID(account.ID)).ForUpdate().Only(ctx); err != nil {
			return err
		}
		position, err := adsservices.ReadAdFundsPosition(ctx, tx.Client(), account, deployed.Now())
		if err != nil {
			return err
		}
		if amount.AmountMinor > position.WithdrawableMinor {
			return aboveAvailable(position.WithdrawableMinor, currency)
		}
		fee := WithdrawalFeeMinor(deployed, amount.AmountMinor, currency)
		reserved, err = tx.AdBalanceWithdrawal.Create().SetAccountID(account.ID).SetUserID(userId).SetIdempotencyKey(key).SetCurrency(currency).
			SetGrossMinor(amount.AmountMinor).SetFeeMinor(fee).SetNetMinor(amount.AmountMinor - fee).Save(ctx)
		if err != nil {
			return err
		}
		if err := tx.AdAccount.UpdateOneID(account.ID).AddBalanceMinor(-amount.AmountMinor).Exec(ctx); err != nil {
			return err
		}
		return tx.AdFundsTransaction.Create().SetAccountID(account.ID).SetType(adfundstransaction.TypeWithdrawal).SetAmountMinor(-amount.AmountMinor).SetCurrency(currency).
			SetDescription("Withdrawn to your Nantty wallet").SetReference("withdrawal:" + reserved.ID.String()).Exec(ctx)
	})
	return reserved, err
}

func SettleWithdrawal(ctx context.Context, deployed *container.Container, row *ent.AdBalanceWithdrawal) (*ent.AdBalanceWithdrawal, error) {
	if row.Status != adbalancewithdrawal.StatusPending {
		if row.Status == adbalancewithdrawal.StatusFailed {
			return nil, adserrors.WithdrawalRefused
		}
		return row, nil
	}
	err := deployed.Withdrawals.MoveAdBalanceToWallet(ctx, interfaces.AdBalanceWithdrawalRequest{
		UserId: row.UserID.String(), AdAccountId: row.AccountID.String(), Currency: row.Currency, GrossMinor: row.GrossMinor, FeeMinor: row.FeeMinor, IdempotencyKey: "adWithdrawal:" + row.ID.String(),
	})
	if errors.Is(err, adserrors.UpstreamUnavailable) {
		return nil, err
	}
	if err != nil {
		if reverseErr := reverseWithdrawal(ctx, deployed, row.ID, err.Error()); reverseErr != nil {
			return nil, reverseErr
		}
		return nil, err
	}
	return deployed.Client.AdBalanceWithdrawal.UpdateOneID(row.ID).SetStatus(adbalancewithdrawal.StatusCompleted).SetCompletedAt(deployed.Now()).Save(ctx)
}

func reverseWithdrawal(ctx context.Context, deployed *container.Container, withdrawalId uuid.UUID, reason string) error {
	return deployed.RunInTransaction(ctx, func(tx *ent.Tx) error {
		row, err := tx.AdBalanceWithdrawal.Query().Where(adbalancewithdrawal.ID(withdrawalId)).ForUpdate().Only(ctx)
		if err != nil || row.Status != adbalancewithdrawal.StatusPending {
			return err
		}
		if len(reason) > 300 {
			reason = reason[:300]
		}
		if err := tx.AdBalanceWithdrawal.UpdateOneID(row.ID).SetStatus(adbalancewithdrawal.StatusFailed).SetFailureReason(reason).Exec(ctx); err != nil {
			return err
		}
		if err := tx.AdAccount.UpdateOneID(row.AccountID).AddBalanceMinor(row.GrossMinor).Exec(ctx); err != nil {
			return err
		}
		return tx.AdFundsTransaction.Create().SetAccountID(row.AccountID).SetType(adfundstransaction.TypeWithdrawalReversal).SetAmountMinor(row.GrossMinor).SetCurrency(row.Currency).
			SetDescription("Withdrawal didn't go through; returned to your ad balance").SetReference("withdrawalReversal:" + row.ID.String()).Exec(ctx)
	})
}

func RetryPendingWithdrawals(ctx context.Context, deployed *container.Container) error {
	pending, err := deployed.Client.AdBalanceWithdrawal.Query().Where(adbalancewithdrawal.StatusEQ(adbalancewithdrawal.StatusPending), adbalancewithdrawal.CreatedAtLT(deployed.Now().Add(-time.Minute))).Limit(100).All(ctx)
	if err != nil {
		return err
	}
	var failures []error
	for _, row := range pending {
		if _, err := SettleWithdrawal(ctx, deployed, row); err != nil && errors.Is(err, adserrors.UpstreamUnavailable) {
			failures = append(failures, err)
		}
	}
	return errors.Join(failures...)
}

func PresentWithdrawal(row *ent.AdBalanceWithdrawal) boostdtos.AdBalanceWithdrawalView {
	money := func(value int64) types.Money { return types.Money{AmountMinor: value, Currency: row.Currency} }
	return boostdtos.AdBalanceWithdrawalView{Id: row.ID.String(), Status: string(row.Status), Amount: money(row.GrossMinor), Fee: money(row.FeeMinor), Net: money(row.NetMinor),
		Destination: WithdrawalDestinationWallet, CreatedAt: row.CreatedAt.UTC().Format(time.RFC3339)}
}
