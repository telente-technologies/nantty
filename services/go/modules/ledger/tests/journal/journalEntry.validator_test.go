package journal_test

import (
	"errors"
	"math"
	"testing"

	"nantty/modules/ledger/src/modules/journal/models"
	"nantty/modules/ledger/src/modules/journal/validators"
)

func TestValidateJournalEntryRequestRejectsEveryMalformedEntry(t *testing.T) {
	sender := models.UserSpendableCoinsAccount("sender")
	creator := models.CreatorEarnedCoinsAccount("creator")
	platform := models.PlatformGiftRevenueCoinsAccount()
	wallet := models.SellerAvailableAccount("seller", "NGN")
	clearing := models.PlatformProviderBalanceAccount("flutterwave", "NGN")
	line := func(account models.AccountRef, direction models.Direction, amount int64) models.JournalLineRequest {
		return models.JournalLineRequest{Account: account, Direction: direction, AmountMinor: amount}
	}
	cases := []struct {
		name    string
		request models.JournalEntryRequest
		want    error
	}{
		{"balanced gift split", models.JournalEntryRequest{Reference: "r", Kind: "gift", Lines: []models.JournalLineRequest{line(sender, models.Debit, 100), line(creator, models.Credit, 70), line(platform, models.Credit, 30)}}, nil},
		{"balanced in two units at once", models.JournalEntryRequest{Reference: "r", Kind: "purchase", Lines: []models.JournalLineRequest{line(clearing, models.Debit, 150000), line(models.CoinSalesRevenueAccount("NGN"), models.Credit, 150000), line(models.CoinsInCirculationAccount(), models.Debit, 70), line(sender, models.Credit, 70)}}, nil},
		{"debits exceed credits", models.JournalEntryRequest{Reference: "r", Kind: "gift", Lines: []models.JournalLineRequest{line(sender, models.Debit, 100), line(creator, models.Credit, 69), line(platform, models.Credit, 30)}}, models.ErrUnbalancedJournalEntry},
		{"balanced in total but not per currency", models.JournalEntryRequest{Reference: "r", Kind: "x", Lines: []models.JournalLineRequest{line(clearing, models.Debit, 100), line(sender, models.Credit, 100)}}, models.ErrUnbalancedJournalEntry},
		{"single line", models.JournalEntryRequest{Reference: "r", Kind: "x", Lines: []models.JournalLineRequest{line(sender, models.Debit, 100)}}, models.ErrInvalidJournalEntry},
		{"zero amount", models.JournalEntryRequest{Reference: "r", Kind: "x", Lines: []models.JournalLineRequest{line(sender, models.Debit, 0), line(creator, models.Credit, 0)}}, models.ErrInvalidJournalEntry},
		{"negative amount", models.JournalEntryRequest{Reference: "r", Kind: "x", Lines: []models.JournalLineRequest{line(sender, models.Debit, -5), line(creator, models.Credit, -5)}}, models.ErrInvalidJournalEntry},
		{"missing reference", models.JournalEntryRequest{Kind: "x", Lines: []models.JournalLineRequest{line(sender, models.Debit, 5), line(creator, models.Credit, 5)}}, models.ErrInvalidJournalEntry},
		{"missing kind", models.JournalEntryRequest{Reference: "r", Lines: []models.JournalLineRequest{line(sender, models.Debit, 5), line(creator, models.Credit, 5)}}, models.ErrInvalidJournalEntry},
		{"lowercase currency", models.JournalEntryRequest{Reference: "r", Kind: "x", Lines: []models.JournalLineRequest{line(models.SellerAvailableAccount("u", "ngn"), models.Debit, 5), line(wallet, models.Credit, 5)}}, models.ErrInvalidJournalEntry},
		{"unsupported currency", models.JournalEntryRequest{Reference: "r", Kind: "x", Lines: []models.JournalLineRequest{line(models.SellerAvailableAccount("u", "XYZ"), models.Debit, 5), line(models.AccountRef{Code: "other", Currency: "XYZ", Kind: models.AccountKindLiability}, models.Credit, 5)}}, models.ErrInvalidJournalEntry},
		{"bad direction", models.JournalEntryRequest{Reference: "r", Kind: "x", Lines: []models.JournalLineRequest{line(sender, "sideways", 5), line(creator, models.Credit, 5)}}, models.ErrInvalidJournalEntry},
		{"account redefined in one entry", models.JournalEntryRequest{Reference: "r", Kind: "x", Lines: []models.JournalLineRequest{line(sender, models.Debit, 5), line(models.AccountRef{Code: sender.Code, Currency: models.CoinUnit, Kind: models.AccountKindAsset}, models.Credit, 5)}}, models.ErrInvalidJournalEntry},
		{"overflowing totals", models.JournalEntryRequest{Reference: "r", Kind: "x", Lines: []models.JournalLineRequest{line(sender, models.Debit, math.MaxInt64), line(sender, models.Debit, 1), line(creator, models.Credit, 1)}}, models.ErrInvalidJournalEntry},
	}
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			err := validators.ValidateJournalEntryRequest(testCase.request)
			if testCase.want == nil && err != nil {
				t.Fatalf("expected valid, got %v", err)
			}
			if testCase.want != nil && !errors.Is(err, testCase.want) {
				t.Fatalf("expected %v, got %v", testCase.want, err)
			}
		})
	}
}

func TestSignedChangeFollowsTheNormalSideOfEachAccountKind(t *testing.T) {
	cases := []struct {
		account   models.AccountRef
		direction models.Direction
		want      int64
	}{
		{models.UserSpendableCoinsAccount("u"), models.Credit, 10},
		{models.UserSpendableCoinsAccount("u"), models.Debit, -10},
		{models.PlatformProviderBalanceAccount("flutterwave", "NGN"), models.Debit, 10},
		{models.PlatformProviderBalanceAccount("flutterwave", "NGN"), models.Credit, -10},
		{models.PlatformGiftRevenueCoinsAccount(), models.Credit, 10},
		{models.CreatorCoinPayoutExpenseAccount("NGN"), models.Debit, 10},
	}
	for _, testCase := range cases {
		if got := models.SignedChangeForAccount(testCase.account, testCase.direction, 10); got != testCase.want {
			t.Errorf("%s %s: got %d want %d", testCase.account.Code, testCase.direction, got, testCase.want)
		}
	}
}
