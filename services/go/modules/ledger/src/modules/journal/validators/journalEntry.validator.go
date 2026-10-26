package validators

import (
	"fmt"
	"sort"

	"nantty/modules/ledger/src/modules/journal/models"
	"nantty/platform/viewerregion"
)

func ValidateJournalEntryRequest(request models.JournalEntryRequest) error {
	if request.Reference == "" || len(request.Reference) > 255 {
		return models.NewInvalidJournalEntryError("reference must be 1-255 characters")
	}
	if request.Kind == "" || len(request.Kind) > 80 {
		return models.NewInvalidJournalEntryError("kind must be 1-80 characters")
	}
	if len(request.Lines) < 2 {
		return models.NewInvalidJournalEntryError("a journal entry needs at least two lines")
	}
	debitsByCurrency := map[string]int64{}
	creditsByCurrency := map[string]int64{}
	definitions := map[models.AccountKey]models.AccountRef{}
	for index, line := range request.Lines {
		if err := validateJournalLine(index, line); err != nil {
			return err
		}
		if earlier, seen := definitions[line.Account.Key()]; seen && earlier != line.Account {
			return models.NewInvalidJournalEntryError("line %d redefines account %s", index, line.Account.Code)
		}
		definitions[line.Account.Key()] = line.Account
		totals := creditsByCurrency
		if line.Direction == models.Debit {
			totals = debitsByCurrency
		}
		sum, overflowed := models.AddWithoutOverflow(totals[line.Account.Currency], line.AmountMinor)
		if overflowed {
			return models.NewInvalidJournalEntryError("line totals overflow int64")
		}
		totals[line.Account.Currency] = sum
	}
	currencies := make([]string, 0, len(debitsByCurrency)+len(creditsByCurrency))
	for currency := range debitsByCurrency {
		currencies = append(currencies, currency)
	}
	for currency := range creditsByCurrency {
		currencies = append(currencies, currency)
	}
	sort.Strings(currencies)
	for _, currency := range currencies {
		if debitsByCurrency[currency] != creditsByCurrency[currency] {
			return fmt.Errorf("%w in %s: debits %d, credits %d", models.ErrUnbalancedJournalEntry, currency, debitsByCurrency[currency], creditsByCurrency[currency])
		}
	}
	return nil
}

func validateJournalLine(index int, line models.JournalLineRequest) error {
	switch {
	case line.Account.Code == "" || len(line.Account.Code) > 200:
		return models.NewInvalidJournalEntryError("line %d account code must be 1-200 characters", index)
	case !IsValidCurrencyOrCoinUnit(line.Account.Currency):
		return models.NewInvalidJournalEntryError("line %d currency must be an ISO 4217 code or COIN", index)
	case !line.Account.Kind.IsValid():
		return models.NewInvalidJournalEntryError("line %d account kind is invalid", index)
	case line.Direction != models.Debit && line.Direction != models.Credit:
		return models.NewInvalidJournalEntryError("line %d direction must be debit or credit", index)
	case line.AmountMinor <= 0:
		return models.NewInvalidJournalEntryError("line %d amount must be a positive whole number of minor units", index)
	}
	return nil
}

func IsValidCurrencyOrCoinUnit(currency string) bool {
	return currency == models.CoinUnit || viewerregion.IsSupportedCurrency(currency)
}
