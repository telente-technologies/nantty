package services

import (
	"context"
	"sort"

	"github.com/google/uuid"

	"zudomart/modules/ledger/src/databases"
	"zudomart/modules/ledger/src/generated/ent"
	"zudomart/modules/ledger/src/generated/ent/journalentry"
	"zudomart/modules/ledger/src/generated/ent/journalline"
	"zudomart/modules/ledger/src/generated/ent/ledgeraccount"
	"zudomart/modules/ledger/src/modules/journal/models"
)

type LedgerAccountSummary struct {
	Code         string
	Kind         string
	Currency     string
	OwnerType    string
	OwnerId      string
	BalanceMinor int64
	EntryCount   int64
}

type LedgerAccountPageRequest struct {
	Currency  string
	OwnerId   string
	AfterCode string
	Limit     int
}

func (ledger *Ledger) ListLedgerCurrencies(ctx context.Context, executor databases.ExecutorQuerier) ([]string, error) {
	currencies, err := ledger.clientFor(executor).LedgerAccount.Query().GroupBy(ledgeraccount.FieldCurrency).Strings(ctx)
	if err != nil {
		return nil, err
	}
	sort.Strings(currencies)
	return currencies, nil
}

func (ledger *Ledger) ListLedgerAccounts(ctx context.Context, executor databases.ExecutorQuerier, request LedgerAccountPageRequest) ([]LedgerAccountSummary, string, error) {
	client := ledger.clientFor(executor)
	summaries := []LedgerAccountSummary{}
	if request.AfterCode == "" && request.OwnerId == "" {
		platformRows, err := client.LedgerAccount.Query().Where(ledgeraccount.Currency(request.Currency), ledgeraccount.OwnerType(models.OwnerTypePlatform)).All(ctx)
		if err != nil {
			return nil, "", err
		}
		grouped, err := ledger.summariseAccountRows(ctx, client, platformRows)
		if err != nil {
			return nil, "", err
		}
		summaries = append(summaries, grouped...)
	}
	query := client.LedgerAccount.Query().Where(ledgeraccount.Currency(request.Currency), ledgeraccount.OwnerTypeNEQ(models.OwnerTypePlatform))
	if request.OwnerId != "" {
		query.Where(ledgeraccount.OwnerID(request.OwnerId))
	}
	if request.AfterCode != "" {
		query.Where(ledgeraccount.CodeGT(request.AfterCode))
	}
	rows, err := query.Order(ent.Asc(ledgeraccount.FieldCode)).Limit(request.Limit + 1).All(ctx)
	if err != nil {
		return nil, "", err
	}
	nextCode := ""
	if len(rows) > request.Limit {
		rows = rows[:request.Limit]
		nextCode = rows[len(rows)-1].Code
	}
	owned, err := ledger.summariseAccountRows(ctx, client, rows)
	if err != nil {
		return nil, "", err
	}
	return append(summaries, owned...), nextCode, nil
}

func (ledger *Ledger) summariseAccountRows(ctx context.Context, client *ent.Client, rows []*ent.LedgerAccount) ([]LedgerAccountSummary, error) {
	counts, err := countLinesPerAccount(ctx, client, rows)
	if err != nil {
		return nil, err
	}
	byBase := map[string]*LedgerAccountSummary{}
	order := []string{}
	for _, row := range rows {
		base := models.PlatformAccountBaseCode(row.Code)
		summary, seen := byBase[base]
		if !seen {
			summary = &LedgerAccountSummary{Code: base, Kind: string(row.Kind), Currency: row.Currency, OwnerType: row.OwnerType, OwnerId: row.OwnerID}
			byBase[base] = summary
			order = append(order, base)
		}
		summary.BalanceMinor += row.BalanceMinor
		summary.EntryCount += counts[row.ID]
	}
	sort.Strings(order)
	summaries := make([]LedgerAccountSummary, 0, len(order))
	for _, base := range order {
		summaries = append(summaries, *byBase[base])
	}
	return summaries, nil
}

func countLinesPerAccount(ctx context.Context, client *ent.Client, rows []*ent.LedgerAccount) (map[uuid.UUID]int64, error) {
	counts := map[uuid.UUID]int64{}
	if len(rows) == 0 {
		return counts, nil
	}
	identifiers := make([]uuid.UUID, len(rows))
	for index, row := range rows {
		identifiers[index] = row.ID
	}
	var totals []struct {
		AccountId uuid.UUID `json:"account_id"`
		Count     int64     `json:"count"`
	}
	if err := client.JournalLine.Query().Where(journalline.AccountIDIn(identifiers...)).GroupBy(journalline.FieldAccountID).Aggregate(ent.Count()).Scan(ctx, &totals); err != nil {
		return nil, err
	}
	for _, total := range totals {
		counts[total.AccountId] = total.Count
	}
	return counts, nil
}

type JournalEntryPageRequest struct {
	Currency    string
	AccountCode string
	Reference   string
	AfterId     *uuid.UUID
	Limit       int
}

func (ledger *Ledger) ListJournalEntriesNewestFirst(ctx context.Context, executor databases.ExecutorQuerier, request JournalEntryPageRequest) ([]*ent.JournalEntry, *uuid.UUID, error) {
	query := ledger.clientFor(executor).JournalEntry.Query().Where(journalentry.HasLinesWith(journalline.Currency(request.Currency)))
	if request.AccountCode != "" {
		codes := models.PlatformAccountStripeCodes(models.PlatformAccountBaseCode(request.AccountCode))
		query.Where(journalentry.HasLinesWith(journalline.HasAccountWith(ledgeraccount.CodeIn(codes...), ledgeraccount.Currency(request.Currency))))
	}
	if request.Reference != "" {
		query.Where(journalentry.Or(journalentry.Reference(request.Reference), journalentry.ExternalReference(request.Reference)))
	}
	if request.AfterId != nil {
		query.Where(journalentry.IDLT(*request.AfterId))
	}
	rows, err := query.WithLines(func(lines *ent.JournalLineQuery) {
		lines.WithAccount().Order(ent.Asc(journalline.FieldLineNumber))
	}).Order(ent.Desc(journalentry.FieldID)).Limit(request.Limit + 1).All(ctx)
	if err != nil {
		return nil, nil, err
	}
	var next *uuid.UUID
	if len(rows) > request.Limit {
		rows = rows[:request.Limit]
		last := rows[len(rows)-1].ID
		next = &last
	}
	return rows, next, nil
}
