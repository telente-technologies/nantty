package services

import (
	"context"
	"errors"
	"fmt"
	"strconv"

	ledgermodels "nantty/modules/ledger/src/modules/journal/models"
	paymentmodels "nantty/modules/payments/src/modules/gateway/models"
	paymentservices "nantty/modules/payments/src/modules/gateway/services"
	"nantty/modules/wallet/src/generated/ent/adbalanceearningstransfer"
	"nantty/modules/wallet/src/generated/ent/adbalancetopup"
	"nantty/modules/wallet/src/modules/payouts/dtos"
)

type walletLineDefinition struct {
	key, label, description string
}

var walletLineDefinitions = []walletLineDefinition{
	{"available", "Available to withdraw", "Sales and creator earnings you can withdraw now, after anything you owe."},
	{"pending", "Pending (escrow)", "Order money held until the buyer confirms delivery."},
	{"locked", "Locked", "Released order money in its short safety hold before it becomes available."},
	{"earningsPayable", "Creator earnings", "Gift, subscription and ad-share earnings waiting to move to your available balance."},
	{"adCredit", "Ad credit", "Prepaid credit for Zudomart ads and boosts. It cannot be withdrawn."},
	{"coins", "Coins", "Coins to send as gifts, plus coins you earned. Coins are not cash."},
	{"debts", "Owed to Zudomart", "Refunds or chargebacks taken from your next earnings."},
}

func (overview WalletOverview) completeWalletSummary(ctx context.Context, summary *dtos.WalletSummaryDto, userId, currency string, withdrawableMinor int64) error {
	adCredit, err := overview.readAdCreditMinor(ctx, userId, currency)
	if err != nil {
		return err
	}
	coinAccounts := []ledgermodels.AccountRef{ledgermodels.UserSpendableCoinsAccount(userId), ledgermodels.CreatorEarnedCoinsAccount(userId)}
	coins, err := overview.Container.Ledger.ReadAccountBalances(ctx, overview.Container.Resources.Database, coinAccounts)
	if err != nil {
		return err
	}
	summary.AdCredit = dtos.MoneyDto{AmountMinor: adCredit, Currency: currency}
	summary.Coins = dtos.CoinHoldingsDto{Spendable: max(coins[coinAccounts[0].Key()], 0), Earned: max(coins[coinAccounts[1].Key()], 0)}
	amounts := map[string]dtos.MoneyDto{
		"available": summary.Available, "pending": summary.InEscrow, "locked": summary.Locked, "earningsPayable": summary.EarningsPayable,
		"adCredit": summary.AdCredit, "coins": {AmountMinor: summary.Coins.Spendable + summary.Coins.Earned, Currency: ledgermodels.CoinUnit}, "debts": summary.Debts,
	}
	summary.Lines = make([]dtos.WalletLineDto, 0, len(walletLineDefinitions))
	for _, definition := range walletLineDefinitions {
		summary.Lines = append(summary.Lines, dtos.WalletLineDto{Key: definition.key, Label: definition.label, Description: definition.description, Amount: amounts[definition.key]})
	}
	summary.Verification = overview.readWalletVerification(ctx, userId, dtos.MoneyDto{AmountMinor: withdrawableMinor + max(summary.EarningsPayable.AmountMinor, 0), Currency: currency})
	return nil
}

func (overview WalletOverview) readAdCreditMinor(ctx context.Context, userId, currency string) (int64, error) {
	client := overview.Container.Client(overview.Container.Resources.Database)
	topUpAccounts, err := client.AdBalanceTopUp.Query().Where(adbalancetopup.FundedByUserID(userId), adbalancetopup.Currency(currency), adbalancetopup.StatusEQ(adbalancetopup.StatusSucceeded)).
		Unique(true).Select(adbalancetopup.FieldAdAccountID).Strings(ctx)
	if err != nil {
		return 0, err
	}
	earningsAccounts, err := client.AdBalanceEarningsTransfer.Query().Where(adbalanceearningstransfer.UserID(userId), adbalanceearningstransfer.Currency(currency)).
		Unique(true).Select(adbalanceearningstransfer.FieldAdAccountID).Strings(ctx)
	if err != nil {
		return 0, err
	}
	seen := map[string]bool{}
	accounts := []ledgermodels.AccountRef{}
	for _, adAccountId := range append(append([]string{"user-" + userId}, topUpAccounts...), earningsAccounts...) {
		if !seen[adAccountId] {
			seen[adAccountId] = true
			accounts = append(accounts, ledgermodels.AdvertiserPrepaidBalanceAccount(adAccountId, currency))
		}
	}
	balances, err := overview.Container.Ledger.ReadAccountBalances(ctx, overview.Container.Resources.Database, accounts)
	if err != nil {
		return 0, err
	}
	var total int64
	for _, account := range accounts {
		total += max(balances[account.Key()], 0)
	}
	return total, nil
}

func (overview WalletOverview) readWalletVerification(ctx context.Context, userId string, waiting dtos.MoneyDto) dtos.WalletVerificationDto {
	result := dtos.WalletVerificationDto{WaitingForVerification: dtos.MoneyDto{Currency: waiting.Currency}}
	payments := overview.Container.Payments
	level, err := payments.ReadVerificationLevel(ctx, userId)
	if err != nil {
		overview.Container.Resources.Logger.WarnContext(ctx, "wallet verification read failed", "userId", userId, "error", err)
		return result
	}
	result.Level, result.NextStep = level.Level, level.NextStep
	blocked := level.Level < paymentmodels.VerificationLevelPayout
	if err := payments.RequireSellerVerifiedForWithdrawal(ctx, userId); errors.Is(err, paymentservices.ErrSellerVerificationRequired) {
		blocked = true
		if level.Level >= paymentmodels.VerificationLevelPayout {
			step := "business_verification"
			result.NextStep = &step
		}
	} else if err != nil {
		overview.Container.Resources.Logger.WarnContext(ctx, "seller verification read failed", "userId", userId, "error", err)
		return result
	}
	result.WithdrawalsUnlocked = !blocked
	if blocked {
		result.WaitingForVerification = waiting
		message := "Verify to withdraw " + FormatMoneyForPeople(waiting)
		if waiting.AmountMinor <= 0 {
			message = "Verify to withdraw your earnings"
		}
		result.Message = &message
	}
	return result
}

func FormatMoneyForPeople(money dtos.MoneyDto) string {
	symbol := map[string]string{"NGN": "₦", "GHS": "GH₵", "KES": "KSh", "USD": "$", "GBP": "£", "EUR": "€"}[money.Currency]
	if symbol == "" {
		symbol = money.Currency + " "
	}
	whole, fraction := money.AmountMinor/100, money.AmountMinor%100
	digits := strconv.FormatInt(whole, 10)
	grouped := ""
	for index, digit := range digits {
		if index > 0 && (len(digits)-index)%3 == 0 {
			grouped += ","
		}
		grouped += string(digit)
	}
	if fraction != 0 {
		return fmt.Sprintf("%s%s.%02d", symbol, grouped, fraction)
	}
	return symbol + grouped
}
