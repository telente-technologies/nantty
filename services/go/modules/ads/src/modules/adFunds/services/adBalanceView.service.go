package services

import (
	"context"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/ads/src/container"
	"zudomart/modules/ads/src/generated/ent"
	"zudomart/modules/ads/src/generated/ent/adcashbacksetting"
	billingservices "zudomart/modules/ads/src/modules/billing/services"
	boostdtos "zudomart/modules/ads/src/modules/boosts/dtos"
	boostservices "zudomart/modules/ads/src/modules/boosts/services"
	adsservices "zudomart/modules/ads/src/services"
	"zudomart/modules/ads/src/types"
)

func reasonPointers(code, reason string) (*string, *string) {
	if code == "" {
		return nil, nil
	}
	return &code, &reason
}

func verificationReason(ctx context.Context, deployed *container.Container, userId uuid.UUID, purpose string) (string, string) {
	status, err := deployed.Verification.ReadVerificationLevel(ctx, userId.String())
	if err != nil {
		return "VERIFICATION_UNAVAILABLE", "We couldn't check your verification. Try again in a moment."
	}
	if status.Level < adsservices.PayoutVerifiedLevel {
		return "VERIFICATION_REQUIRED", "Verify payouts to " + purpose + "."
	}
	return "", ""
}

func ReadAdBalanceView(ctx context.Context, deployed *container.Container, userId uuid.UUID, currency string) (boostdtos.AdBalanceView, error) {
	money := func(amount int64) types.Money { return types.Money{AmountMinor: amount, Currency: currency} }
	limits := billingservices.TopUpLimits(ctx, deployed, currency)
	view := boostdtos.AdBalanceView{
		Balance: money(0), Credit: money(0), Committed: money(0), Spendable: money(0), Withdrawable: money(0), PendingSettlement: money(0), CreditLots: []boostdtos.AdCreditLotView{},
		Cashback:   boostdtos.AdCashbackView{Percent: adsservices.DefaultCashbackPercent},
		TopUp:      boostdtos.AdBalanceTopUpOptions{Minimum: money(limits.Minimum), Maximum: money(limits.Maximum), Suggested: []types.Money{}},
		Withdrawal: boostdtos.AdBalanceWithdrawalOptions{Minimum: money(MinimumWithdrawalMinor(deployed, currency))},
	}
	for _, multiple := range []int64{1, 2, 5, 10} {
		if suggested := limits.Minimum * multiple; suggested <= limits.Maximum {
			view.TopUp.Suggested = append(view.TopUp.Suggested, money(suggested))
		}
	}
	topUpCode, topUpReason := verificationReason(ctx, deployed, userId, "add funds to your ad balance")
	view.TopUp.Available = topUpCode == ""
	view.TopUp.ReasonCode, view.TopUp.Reason = reasonPointers(topUpCode, topUpReason)
	if setting, err := deployed.Client.AdCashbackSetting.Query().Where(adcashbacksetting.UserID(userId)).Only(ctx); err == nil {
		view.Cashback = boostdtos.AdCashbackView{Enabled: setting.Enabled, Percent: setting.Percent}
	} else if !ent.IsNotFound(err) {
		return view, err
	}
	account, err := boostservices.FindPersonalBoostAccount(ctx, deployed.Client, userId, currency)
	if err != nil {
		return view, err
	}
	withdrawCode, withdrawReason := topUpCode, ""
	if withdrawCode != "" {
		withdrawReason = map[string]string{"VERIFICATION_REQUIRED": "Verify payouts to withdraw your ad balance.", "VERIFICATION_UNAVAILABLE": topUpReason}[withdrawCode]
	}
	if account != nil {
		if err := fillAccountPosition(ctx, deployed, account, &view); err != nil {
			return view, err
		}
	}
	if withdrawCode == "" && view.Withdrawable.AmountMinor < view.Withdrawal.Minimum.AmountMinor {
		withdrawCode, withdrawReason = "NOTHING_TO_WITHDRAW", "There's no ad balance you can withdraw right now."
	}
	view.Withdrawal.Available = withdrawCode == ""
	view.Withdrawal.ReasonCode, view.Withdrawal.Reason = reasonPointers(withdrawCode, withdrawReason)
	return view, nil
}

func fillAccountPosition(ctx context.Context, deployed *container.Container, account *ent.AdAccount, view *boostdtos.AdBalanceView) error {
	now := deployed.Now()
	position, err := adsservices.ReadAdFundsPosition(ctx, deployed.Client, account, now)
	if err != nil {
		return err
	}
	accountId := account.ID.String()
	view.AccountId = &accountId
	view.Balance.AmountMinor, view.Credit.AmountMinor, view.Committed.AmountMinor = position.BalanceMinor, position.CreditMinor, position.CommittedMinor
	view.Spendable.AmountMinor, view.Withdrawable.AmountMinor, view.PendingSettlement.AmountMinor = position.SpendableMinor, position.WithdrawableMinor, position.PendingSettlementMinor
	lots, err := adsservices.SpendableCreditLots(ctx, deployed.Client, account.ID, now)
	if err != nil {
		return err
	}
	for _, lot := range lots {
		presented := boostdtos.AdCreditLotView{Id: lot.ID.String(), Source: string(lot.Source), Remaining: types.Money{AmountMinor: lot.RemainingMinor, Currency: lot.Currency}, CreatedAt: lot.CreatedAt.UTC().Format(time.RFC3339)}
		if lot.ExpiresAt != nil {
			formatted := lot.ExpiresAt.UTC().Format(time.RFC3339)
			presented.ExpiresAt = &formatted
		}
		if lot.Reason != "" {
			reason := lot.Reason
			presented.Reason = &reason
		}
		view.CreditLots = append(view.CreditLots, presented)
	}
	return nil
}

func MinimumWithdrawalMinor(deployed *container.Container, currency string) int64 {
	if minimum := deployed.Settings.WithdrawalMinimumMinor[currency]; minimum > 0 {
		return minimum
	}
	return 1
}

func WithdrawalFeeMinor(deployed *container.Container, grossMinor int64, currency string) int64 {
	fee := (grossMinor*deployed.Settings.WithdrawalFeeBps + 9_999) / 10_000
	if limit, capped := deployed.Settings.WithdrawalFeeCapMinor[currency]; capped && fee > limit {
		fee = limit
	}
	return min(max(fee, 0), grossMinor)
}
