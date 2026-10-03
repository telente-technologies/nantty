package services

import (
	"context"
	"sort"
	"zudomart/modules/ledger/src/modules/journal/models"

	"github.com/google/uuid"

	"zudomart/modules/ledger/src/databases"
	"zudomart/modules/ledger/src/generated/ent"
	"zudomart/modules/ledger/src/generated/ent/journalline"
)

type CurrencyTrialBalance struct {
	Currency     string `json:"currency"`
	DebitsMinor  int64  `json:"debitsMinor"`
	CreditsMinor int64  `json:"creditsMinor"`
	Balanced     bool   `json:"balanced"`
}

type LedgerIntegrityReport struct {
	Currencies                     []CurrencyTrialBalance `json:"currencies"`
	AccountsWithDriftedBalances    []string               `json:"accountsWithDriftedBalances"`
	EveryCurrencyBalanced          bool                   `json:"everyCurrencyBalanced"`
	EveryCachedBalanceMatchesLines bool                   `json:"everyCachedBalanceMatchesLines"`
}

func (report LedgerIntegrityReport) Healthy() bool {
	return report.EveryCurrencyBalanced && report.EveryCachedBalanceMatchesLines
}

func (ledger *Ledger) VerifyTrialBalanceAndCachedBalances(ctx context.Context, executor databases.ExecutorQuerier) (LedgerIntegrityReport, error) {
	client := ledger.clientFor(executor)
	var currencyTotals []struct {
		Currency  string `json:"currency"`
		Direction string `json:"direction"`
		Sum       int64  `json:"sum"`
	}
	if err := client.JournalLine.Query().GroupBy(journalline.FieldCurrency, journalline.FieldDirection).
		Aggregate(ent.Sum(journalline.FieldAmountMinor)).Scan(ctx, &currencyTotals); err != nil {
		return LedgerIntegrityReport{}, err
	}
	byCurrency := map[string]*CurrencyTrialBalance{}
	for _, row := range currencyTotals {
		totals, exists := byCurrency[row.Currency]
		if !exists {
			totals = &CurrencyTrialBalance{Currency: row.Currency}
			byCurrency[row.Currency] = totals
		}
		if row.Direction == string(models.Debit) {
			totals.DebitsMinor = row.Sum
		} else {
			totals.CreditsMinor = row.Sum
		}
	}
	report := LedgerIntegrityReport{EveryCurrencyBalanced: true, EveryCachedBalanceMatchesLines: true, AccountsWithDriftedBalances: []string{}}
	for _, totals := range byCurrency {
		totals.Balanced = totals.DebitsMinor == totals.CreditsMinor
		report.EveryCurrencyBalanced = report.EveryCurrencyBalanced && totals.Balanced
		report.Currencies = append(report.Currencies, *totals)
	}
	sort.Slice(report.Currencies, func(left, right int) bool {
		return report.Currencies[left].Currency < report.Currencies[right].Currency
	})
	drifted, err := ledger.findAccountsWhoseCachedBalanceDisagreesWithLines(ctx, client)
	if err != nil {
		return LedgerIntegrityReport{}, err
	}
	report.AccountsWithDriftedBalances = drifted
	report.EveryCachedBalanceMatchesLines = len(drifted) == 0
	return report, nil
}

func (ledger *Ledger) findAccountsWhoseCachedBalanceDisagreesWithLines(ctx context.Context, client *ent.Client) ([]string, error) {
	var accountTotals []struct {
		AccountId uuid.UUID `json:"account_id"`
		Direction string    `json:"direction"`
		Sum       int64     `json:"sum"`
	}
	if err := client.JournalLine.Query().GroupBy(journalline.FieldAccountID, journalline.FieldDirection).
		Aggregate(ent.Sum(journalline.FieldAmountMinor)).Scan(ctx, &accountTotals); err != nil {
		return nil, err
	}
	debits := map[uuid.UUID]int64{}
	credits := map[uuid.UUID]int64{}
	for _, row := range accountTotals {
		if row.Direction == string(models.Debit) {
			debits[row.AccountId] = row.Sum
		} else {
			credits[row.AccountId] = row.Sum
		}
	}
	accounts, err := client.LedgerAccount.Query().All(ctx)
	if err != nil {
		return nil, err
	}
	drifted := []string{}
	for _, account := range accounts {
		expected := credits[account.ID] - debits[account.ID]
		if NormalSideIsDebit(models.AccountKind(account.Kind)) {
			expected = -expected
		}
		if account.BalanceMinor != expected || account.DebitsTotalMinor != debits[account.ID] || account.CreditsTotalMinor != credits[account.ID] {
			drifted = append(drifted, account.Code+" "+account.Currency)
		}
	}
	sort.Strings(drifted)
	return drifted, nil
}

func NormalSideIsDebit(kind models.AccountKind) bool { return kind.NormalSide() == models.Debit }
