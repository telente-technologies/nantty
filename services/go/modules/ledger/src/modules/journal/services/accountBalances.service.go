package services

import (
	"context"
	"time"

	"zudomart/modules/ledger/src/modules/journal/models"

	"github.com/google/uuid"

	"zudomart/modules/ledger/src/databases"
	"zudomart/modules/ledger/src/generated/ent"
	"zudomart/modules/ledger/src/generated/ent/journalentry"
	"zudomart/modules/ledger/src/generated/ent/journalline"
	"zudomart/modules/ledger/src/generated/ent/ledgeraccount"
)

func (ledger *Ledger) ReadAccountBalance(ctx context.Context, executor databases.ExecutorQuerier, account models.AccountRef) (int64, error) {
	balances, err := ledger.ReadAccountBalances(ctx, executor, []models.AccountRef{account})
	return balances[account.Key()], err
}

func (ledger *Ledger) ReadAccountBalances(ctx context.Context, executor databases.ExecutorQuerier, accounts []models.AccountRef) (map[models.AccountKey]int64, error) {
	balances := make(map[models.AccountKey]int64, len(accounts))
	if len(accounts) == 0 {
		return balances, nil
	}
	codes := make([]string, 0, len(accounts))
	requestedKeyByStoredCode := map[string]string{}
	for _, account := range accounts {
		balances[account.Key()] = 0
		storedCodes := []string{account.Code}
		if account.IsStripedPlatformAccount() && !models.IsStripeCode(account.Code) {
			storedCodes = models.PlatformAccountStripeCodes(account.Code)
		}
		for _, code := range storedCodes {
			codes = append(codes, code)
			requestedKeyByStoredCode[code] = account.Code
		}
	}
	rows, err := ledger.clientFor(executor).LedgerAccount.Query().Where(ledgeraccount.CodeIn(codes...)).All(ctx)
	if err != nil {
		return nil, err
	}
	for _, row := range rows {
		key := models.AccountKey{Code: requestedKeyByStoredCode[row.Code], Currency: row.Currency}
		if _, requested := balances[key]; requested {
			balances[key] += row.BalanceMinor
		}
	}
	return balances, nil
}

type AccountBalance struct {
	Code              string `json:"code"`
	Currency          string `json:"currency"`
	BalanceMinor      int64  `json:"balanceMinor"`
	CreditsTotalMinor int64  `json:"-"`
}

func (ledger *Ledger) ListBalancesOfAccountsWithCode(ctx context.Context, executor databases.ExecutorQuerier, code string) ([]AccountBalance, error) {
	rows, err := ledger.clientFor(executor).LedgerAccount.Query().Where(ledgeraccount.CodeIn(models.PlatformAccountStripeCodes(models.PlatformAccountBaseCode(code))...)).Order(ent.Asc(ledgeraccount.FieldCurrency)).All(ctx)
	if err != nil {
		return nil, err
	}
	balances := []AccountBalance{}
	for _, row := range rows {
		if count := len(balances); count > 0 && balances[count-1].Currency == row.Currency {
			balances[count-1].BalanceMinor += row.BalanceMinor
			continue
		}
		balances = append(balances, AccountBalance{Code: models.PlatformAccountBaseCode(code), Currency: row.Currency, BalanceMinor: row.BalanceMinor})
	}
	return balances, nil
}

type StatementLine struct {
	LineId            uuid.UUID        `json:"id"`
	EntryId           uuid.UUID        `json:"transactionId"`
	EntryReference    string           `json:"reference"`
	EntryKind         string           `json:"kind"`
	Description       string           `json:"description"`
	Direction         models.Direction `json:"direction"`
	IncreasesBalance  bool             `json:"increasesBalance"`
	AmountMinor       int64            `json:"amountMinor"`
	Currency          string           `json:"currency"`
	BalanceAfterMinor int64            `json:"balanceAfterMinor"`
	CreatedAt         time.Time        `json:"createdAt"`
}

type StatementPageRequest struct {
	Accounts    []models.AccountRef
	AfterLineId *uuid.UUID
	Limit       int
}

func (ledger *Ledger) ListStatementLinesNewestFirst(ctx context.Context, executor databases.ExecutorQuerier, request StatementPageRequest) ([]StatementLine, *uuid.UUID, error) {
	if request.Limit <= 0 || request.Limit > 100 {
		request.Limit = 20
	}
	client := ledger.clientFor(executor)
	accountIds := []uuid.UUID{}
	normalSides := map[uuid.UUID]models.Direction{}
	for _, reference := range request.Accounts {
		account, err := client.LedgerAccount.Query().Where(ledgeraccount.Code(reference.Code), ledgeraccount.Currency(reference.Currency)).Only(ctx)
		if ent.IsNotFound(err) {
			continue
		}
		if err != nil {
			return nil, nil, err
		}
		accountIds = append(accountIds, account.ID)
		normalSides[account.ID] = models.Direction(account.NormalSide)
	}
	if len(accountIds) == 0 {
		return []StatementLine{}, nil, nil
	}
	query := client.JournalLine.Query().Where(journalline.AccountIDIn(accountIds...)).WithEntry()
	if request.AfterLineId != nil {
		query.Where(journalline.IDLT(*request.AfterLineId))
	}
	rows, err := query.Order(ent.Desc(journalline.FieldID)).Limit(request.Limit + 1).All(ctx)
	if err != nil {
		return nil, nil, err
	}
	var nextCursor *uuid.UUID
	if len(rows) > request.Limit {
		rows = rows[:request.Limit]
		last := rows[len(rows)-1].ID
		nextCursor = &last
	}
	lines := make([]StatementLine, len(rows))
	for index, row := range rows {
		lines[index] = StatementLine{
			LineId: row.ID, EntryId: row.EntryID, EntryReference: row.Edges.Entry.Reference, EntryKind: row.Edges.Entry.Kind,
			Description: row.Edges.Entry.Description, Direction: models.Direction(row.Direction),
			IncreasesBalance: models.Direction(row.Direction) == normalSides[row.AccountID],
			AmountMinor:      row.AmountMinor, Currency: row.Currency, BalanceAfterMinor: row.BalanceAfterMinor, CreatedAt: row.CreatedAt,
		}
	}
	return lines, nextCursor, nil
}

func (ledger *Ledger) FindJournalEntryByReference(ctx context.Context, executor databases.ExecutorQuerier, reference string) (models.PostedJournalEntry, bool, error) {
	entry, err := ledger.clientFor(executor).JournalEntry.Query().Where(journalentry.Reference(reference)).WithLines(func(query *ent.JournalLineQuery) {
		query.WithAccount().Order(ent.Asc(journalline.FieldLineNumber))
	}).Only(ctx)
	if ent.IsNotFound(err) {
		return models.PostedJournalEntry{}, false, nil
	}
	if err != nil {
		return models.PostedJournalEntry{}, false, err
	}
	return convertStoredJournalEntry(entry), true, nil
}

func (ledger *Ledger) SumBalancesOfAccountsWithCodePrefix(ctx context.Context, executor databases.ExecutorQuerier, codePrefix, currency string) (int64, error) {
	var sums []struct {
		Sum *int64 `json:"sum"`
	}
	err := ledger.clientFor(executor).LedgerAccount.Query().
		Where(ledgeraccount.CodeHasPrefix(codePrefix), ledgeraccount.Currency(currency)).
		Aggregate(ent.Sum(ledgeraccount.FieldBalanceMinor)).Scan(ctx, &sums)
	if err != nil || len(sums) == 0 || sums[0].Sum == nil {
		return 0, err
	}
	return *sums[0].Sum, nil
}

func (ledger *Ledger) ListBalancesOfAccountsWithCodePrefix(ctx context.Context, executor databases.ExecutorQuerier, codePrefix, currency string) ([]AccountBalance, error) {
	rows, err := ledger.clientFor(executor).LedgerAccount.Query().Where(ledgeraccount.CodeHasPrefix(codePrefix), ledgeraccount.Currency(currency)).
		Order(ent.Asc(ledgeraccount.FieldCode)).All(ctx)
	if err != nil {
		return nil, err
	}
	balances := make([]AccountBalance, len(rows))
	for index, row := range rows {
		balances[index] = AccountBalance{Code: row.Code, Currency: row.Currency, BalanceMinor: row.BalanceMinor, CreditsTotalMinor: row.CreditsTotalMinor}
	}
	return balances, nil
}
