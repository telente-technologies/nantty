package services

import (
	"context"
	"sort"

	"nantty/modules/ledger/src/modules/journal/models"

	"github.com/google/uuid"

	"nantty/modules/ledger/src/databases"
	"nantty/modules/ledger/src/generated/ent"
	"nantty/modules/ledger/src/generated/ent/journalline"
	"nantty/modules/ledger/src/generated/ent/ledgeraccount"
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

const integrityAccountPageSize = 500

func (ledger *Ledger) VerifyTrialBalanceAndCachedBalances(ctx context.Context, executor databases.ExecutorQuerier) (LedgerIntegrityReport, error) {
	client := ledger.clientFor(executor)
	byCurrency := map[string]*CurrencyTrialBalance{}
	report := LedgerIntegrityReport{EveryCurrencyBalanced: true, EveryCachedBalanceMatchesLines: true, AccountsWithDriftedBalances: []string{}}
	var after *uuid.UUID
	for {
		query := client.LedgerAccount.Query().Order(ent.Asc(ledgeraccount.FieldID)).Limit(integrityAccountPageSize)
		if after != nil {
			query = query.Where(ledgeraccount.IDGT(*after))
		}
		page, err := query.All(ctx)
		if err != nil {
			return LedgerIntegrityReport{}, err
		}
		if len(page) == 0 {
			break
		}
		drifted, err := ledger.findDriftedAccountsInPage(ctx, client, page)
		if err != nil {
			return LedgerIntegrityReport{}, err
		}
		report.AccountsWithDriftedBalances = append(report.AccountsWithDriftedBalances, drifted...)
		for _, account := range page {
			totals, exists := byCurrency[account.Currency]
			if !exists {
				totals = &CurrencyTrialBalance{Currency: account.Currency}
				byCurrency[account.Currency] = totals
			}
			totals.DebitsMinor += account.DebitsTotalMinor
			totals.CreditsMinor += account.CreditsTotalMinor
		}
		last := page[len(page)-1].ID
		after = &last
		if len(page) < integrityAccountPageSize {
			break
		}
	}
	for _, totals := range byCurrency {
		totals.Balanced = totals.DebitsMinor == totals.CreditsMinor
		report.EveryCurrencyBalanced = report.EveryCurrencyBalanced && totals.Balanced
		report.Currencies = append(report.Currencies, *totals)
	}
	sort.Slice(report.Currencies, func(left, right int) bool {
		return report.Currencies[left].Currency < report.Currencies[right].Currency
	})
	sort.Strings(report.AccountsWithDriftedBalances)
	report.EveryCachedBalanceMatchesLines = len(report.AccountsWithDriftedBalances) == 0
	return report, nil
}

func (ledger *Ledger) findDriftedAccountsInPage(ctx context.Context, client *ent.Client, page []*ent.LedgerAccount) ([]string, error) {
	identifiers := make([]uuid.UUID, len(page))
	for index, account := range page {
		identifiers[index] = account.ID
	}
	var accountTotals []struct {
		AccountId uuid.UUID `json:"account_id"`
		Direction string    `json:"direction"`
		Sum       int64     `json:"sum"`
	}
	if err := client.JournalLine.Query().Where(journalline.AccountIDIn(identifiers...)).GroupBy(journalline.FieldAccountID, journalline.FieldDirection).
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
	drifted := []string{}
	for _, account := range page {
		expected := credits[account.ID] - debits[account.ID]
		if NormalSideIsDebit(models.AccountKind(account.Kind)) {
			expected = -expected
		}
		if account.BalanceMinor != expected || account.DebitsTotalMinor != debits[account.ID] || account.CreditsTotalMinor != credits[account.ID] {
			drifted = append(drifted, account.Code+" "+account.Currency)
		}
	}
	return drifted, nil
}

func NormalSideIsDebit(kind models.AccountKind) bool { return kind.NormalSide() == models.Debit }
