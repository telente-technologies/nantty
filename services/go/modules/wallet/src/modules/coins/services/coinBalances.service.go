package services

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"net/http"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	ledgermodels "nantty/modules/ledger/src/modules/journal/models"
	ledgerservices "nantty/modules/ledger/src/modules/journal/services"
	"nantty/modules/wallet/src/container"
	"nantty/modules/wallet/src/generated/ent/walletriskflag"
	"nantty/modules/wallet/src/modules/coins/dtos"
	"nantty/modules/wallet/src/modules/coins/models"
	"nantty/platform/httpserver"
	"nantty/platform/money"
)

type CoinBalances struct {
	Container *container.Container
}

var ErrCreatorProgramApprovalRequired = httpserver.NewApiError(http.StatusForbidden, "CREATOR_PROGRAM_APPROVAL_REQUIRED", "Only approved Creator Program members can convert creator-earned coins.")
var ErrCreatorMonetisationPaused = httpserver.NewApiError(http.StatusForbidden, "CREATOR_MONETISATION_PAUSED", "Creator monetisation is paused for this account.")
var ErrCreatorMonetisationReviewRequired = httpserver.NewApiError(http.StatusForbidden, "CREATOR_MONETISATION_REVIEW_REQUIRED", "Creator monetisation is unavailable while an account risk review is open.")

func (balances CoinBalances) RequireCreatorCashoutEligibility(ctx context.Context, transaction *sql.Tx, userId string) error {
	table := pgx.Identifier{balances.Container.Settings.CreatorsSchema, "creator_program_members"}.Sanitize()
	var status string
	err := transaction.QueryRowContext(ctx, "SELECT status FROM "+table+" WHERE user_id = $1 FOR UPDATE", userId).Scan(&status)
	if errors.Is(err, sql.ErrNoRows) || err == nil && status != "approved" {
		return ErrCreatorProgramApprovalRequired
	}
	if err != nil {
		return err
	}

	holdTable := pgx.Identifier{balances.Container.Settings.Money.DatabaseSchema, "monetisation_holds"}.Sanitize()
	var paused bool
	err = transaction.QueryRowContext(ctx, "SELECT is_paused FROM "+holdTable+" WHERE id = $1 FOR UPDATE", userId).Scan(&paused)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return err
	}
	if paused {
		return ErrCreatorMonetisationPaused
	}

	openRiskFlag, err := balances.Container.Client(transaction).WalletRiskFlag.Query().Where(
		walletriskflag.UserID(userId), walletriskflag.ResolvedAtIsNil(),
	).Exist(ctx)
	if err != nil {
		return err
	}
	if openRiskFlag {
		return ErrCreatorMonetisationReviewRequired
	}
	return nil
}

func (balances CoinBalances) ReadCoinBalance(ctx context.Context, userId string) (dtos.CoinBalanceDto, error) {
	spendable, earned := ledgermodels.UserSpendableCoinsAccount(userId), ledgermodels.CreatorEarnedCoinsAccount(userId)
	values, err := balances.Container.Ledger.ReadAccountBalances(ctx, balances.Container.Resources.Database, []ledgermodels.AccountRef{spendable, earned})
	if err != nil {
		return dtos.CoinBalanceDto{}, err
	}
	return dtos.CoinBalanceDto{Coins: values[spendable.Key()], EarnedCoins: values[earned.Key()]}, nil
}

func (balances CoinBalances) ListCoinActivity(ctx context.Context, userId string, afterLineId *uuid.UUID, limit int) (httpserver.CursorPage[dtos.CoinActivityEntryDto], error) {
	lines, next, err := balances.Container.Ledger.ListStatementLinesNewestFirst(ctx, balances.Container.Resources.Database, ledgerservices.StatementPageRequest{
		Accounts: []ledgermodels.AccountRef{ledgermodels.UserSpendableCoinsAccount(userId)}, AfterLineId: afterLineId, Limit: limit,
	})
	if err != nil {
		return httpserver.CursorPage[dtos.CoinActivityEntryDto]{}, err
	}
	entries := make([]dtos.CoinActivityEntryDto, len(lines))
	for index, line := range lines {
		entryType := "debit"
		if line.IncreasesBalance {
			entryType = "credit"
		}
		entries[index] = dtos.CoinActivityEntryDto{
			Id: line.LineId.String(), TransactionId: line.EntryId.String(), Type: entryType, Kind: line.EntryKind,
			Coins: line.AmountMinor, BalanceAfter: line.BalanceAfterMinor, CreatedAt: line.CreatedAt,
		}
	}
	nextCursor := ""
	if next != nil {
		nextCursor = next.String()
	}
	return httpserver.NewCursorPage(entries, nextCursor), nil
}

type EarnedCoinConversionInput struct {
	UserId            string
	Coins             int64
	Currency          string
	ExpectedCashMinor *int64
	IdempotencyKey    string
}

func (balances CoinBalances) ConvertEarnedCoinsToCashInTransaction(ctx context.Context, transaction *sql.Tx, input EarnedCoinConversionInput) (dtos.CoinConversionReceiptDto, error) {
	if err := balances.requireApprovedCreator(ctx, transaction, input.UserId); err != nil {
		return dtos.CoinConversionReceiptDto{}, err
	}
	settings := balances.Container.Settings
	valuePerCoin, supported := balances.Container.CoinCashValuesMinor(ctx)[input.Currency]
	minimum := settings.MinimumPayoutMinorByCurrency[input.Currency]
	if !supported {
		return dtos.CoinConversionReceiptDto{}, httpserver.NewApiError(http.StatusUnprocessableEntity, "CURRENCY_NOT_SUPPORTED", "Earned coins cannot be converted to this currency yet.")
	}
	cash, err := models.ConvertCoinsToCashMinor(input.Coins, valuePerCoin)
	if err != nil {
		return dtos.CoinConversionReceiptDto{}, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "coins", Message: "is out of range"}})
	}
	if input.ExpectedCashMinor != nil && *input.ExpectedCashMinor != cash {
		payout, formatErr := money.FormatMajorUnits(cash, input.Currency)
		if formatErr != nil {
			return dtos.CoinConversionReceiptDto{}, formatErr
		}
		return dtos.CoinConversionReceiptDto{}, httpserver.NewApiError(http.StatusConflict, "CONVERSION_RATE_CHANGED",
			fmt.Sprintf("The coin conversion payout is now %s %s. Review the updated payout and try again.", payout, input.Currency))
	}
	if cash < minimum {
		return dtos.CoinConversionReceiptDto{}, httpserver.NewApiError(http.StatusUnprocessableEntity, "BELOW_MINIMUM_PAYOUT",
			fmt.Sprintf("Convert at least %d minor units of %s; %d coins are worth %d.", minimum, input.Currency, input.Coins, cash))
	}
	client := balances.Container.Client(transaction)
	conversion, err := client.CoinConversion.Create().SetUserID(input.UserId).SetCoins(input.Coins).SetCashMinor(cash).SetCurrency(input.Currency).
		SetCoinCashValueMinor(valuePerCoin).SetCreatedAt(balances.Container.Now().UTC()).Save(ctx)
	if err != nil {
		return dtos.CoinConversionReceiptDto{}, err
	}
	earned := ledgermodels.CreatorEarnedCoinsAccount(input.UserId)
	posted, err := balances.Container.Ledger.PostBalancedJournalEntry(ctx, transaction, ledgermodels.JournalEntryRequest{
		Reference: "creator-coin-conversion:" + input.UserId + ":" + input.IdempotencyKey, Kind: "coins.convertedToCash",
		Description: "Earned coins converted to cash", Metadata: map[string]any{"coinConversionId": conversion.ID.String()},
		Lines: []ledgermodels.JournalLineRequest{
			{Account: earned, Direction: ledgermodels.Debit, AmountMinor: input.Coins},
			{Account: ledgermodels.CoinsInCirculationAccount(), Direction: ledgermodels.Credit, AmountMinor: input.Coins},
			{Account: ledgermodels.CreatorCoinPayoutExpenseAccount(input.Currency), Direction: ledgermodels.Debit, AmountMinor: cash},
			{Account: ledgermodels.CreatorEarningsPayableAccount(input.UserId, input.Currency), Direction: ledgermodels.Credit, AmountMinor: cash},
		},
	})
	if errors.Is(err, ledgermodels.ErrInsufficientBalance) {
		return dtos.CoinConversionReceiptDto{}, ErrInsufficientEarnedCoins
	}
	if err != nil {
		return dtos.CoinConversionReceiptDto{}, err
	}
	remaining, _ := posted.BalanceAfter(earned)
	if err := balances.Container.Outbox.EnqueueInTransaction(ctx, transaction, "earnedCoins.converted", conversion.ID.String(), conversion.CreatedAt, map[string]any{
		"coinConversionId": conversion.ID.String(), "userId": input.UserId, "coins": input.Coins, "cash": map[string]any{"amountMinor": cash, "currency": input.Currency},
	}); err != nil {
		return dtos.CoinConversionReceiptDto{}, err
	}
	return dtos.CoinConversionReceiptDto{
		Coins: input.Coins, Cash: dtos.MoneyDto{AmountMinor: cash, Currency: input.Currency}, EarnedCoinsRemaining: remaining,
		MinimumPayout: dtos.MoneyDto{AmountMinor: minimum, Currency: input.Currency},
	}, nil
}

func (balances CoinBalances) requireApprovedCreator(ctx context.Context, transaction *sql.Tx, userId string) error {
	approved, err := balances.Container.IsApprovedCreator(ctx, transaction, userId)
	if err != nil {
		return httpserver.NewApiError(http.StatusServiceUnavailable, "CREATOR_STATUS_UNAVAILABLE", "Creator eligibility could not be verified. Try again later.")
	}
	if !approved {
		return httpserver.NewApiError(http.StatusForbidden, "CREATOR_PROGRAM_REQUIRED", "Only currently approved Nantty creators can convert creator-earned coins.")
	}
	return nil
}
