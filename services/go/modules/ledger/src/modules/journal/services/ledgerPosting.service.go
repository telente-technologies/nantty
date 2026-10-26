package services

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"time"

	"nantty/modules/ledger/src/modules/journal/models"
	"nantty/modules/ledger/src/modules/journal/validators"

	"nantty/modules/ledger/src/databases"
	"nantty/modules/ledger/src/generated/ent"
	"nantty/modules/ledger/src/generated/ent/journalentry"
	"nantty/modules/ledger/src/generated/ent/journalline"
	"nantty/modules/ledger/src/generated/ent/ledgeraccount"
	_ "nantty/modules/ledger/src/generated/ent/runtime"
)

type Ledger struct {
	schemaConfig ent.SchemaConfig
	now          func() time.Time
}

func NewLedgerInSchema(schema string) *Ledger {
	return &Ledger{schemaConfig: SchemaConfigForLedgerTables(schema), now: time.Now}
}

func SchemaConfigForLedgerTables(schema string) ent.SchemaConfig {
	return ent.SchemaConfig{
		JournalEntry: schema, JournalLine: schema, LedgerAccount: schema, OutboxEvent: schema,
		ReconciliationBreak: schema, ReconciliationRun: schema, SellerCreditMaturity: schema,
	}
}

func (ledger *Ledger) clientFor(executor databases.ExecutorQuerier) *ent.Client {
	return ent.NewClient(ent.Driver(databases.EntDriverForExecutor(executor)), ent.AlternateSchema(ledger.schemaConfig))
}

func (ledger *Ledger) PostBalancedJournalEntry(ctx context.Context, transaction *sql.Tx, request models.JournalEntryRequest) (models.PostedJournalEntry, error) {
	request.Lines = stripePlatformAccountLines(request.Lines, request.Reference)
	if err := validators.ValidateJournalEntryRequest(request); err != nil {
		return models.PostedJournalEntry{}, err
	}
	return ledger.postValidatedJournalEntry(ctx, transaction, request, nil)
}

func (ledger *Ledger) postValidatedJournalEntry(ctx context.Context, transaction *sql.Tx, request models.JournalEntryRequest, reversedEntry *ent.JournalEntry) (models.PostedJournalEntry, error) {
	client := ledger.clientFor(transaction)
	if _, err := client.ExecContext(ctx, "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", "ledger-reference:"+request.Reference); err != nil {
		return models.PostedJournalEntry{}, fmt.Errorf("lock journal reference: %w", err)
	}
	existing, err := client.JournalEntry.Query().Where(journalentry.Reference(request.Reference)).WithLines(func(query *ent.JournalLineQuery) {
		query.WithAccount().Order(ent.Asc(journalline.FieldLineNumber))
	}).Only(ctx)
	if err == nil {
		return replayExistingJournalEntry(existing, request)
	}
	if !ent.IsNotFound(err) {
		return models.PostedJournalEntry{}, err
	}
	accounts, err := ledger.lockAccountsCreatingMissingOnes(ctx, client, request.Lines)
	if err != nil {
		return models.PostedJournalEntry{}, err
	}
	return ledger.applyLinesAndInsertEntry(ctx, client, request, accounts, reversedEntry)
}

func (ledger *Ledger) lockAccountsCreatingMissingOnes(ctx context.Context, client *ent.Client, lines []models.JournalLineRequest) (map[models.AccountKey]*ent.LedgerAccount, error) {
	definitions := map[models.AccountKey]models.AccountRef{}
	for _, line := range lines {
		definitions[line.Account.Key()] = line.Account
	}
	keys := make([]models.AccountKey, 0, len(definitions))
	for key := range definitions {
		keys = append(keys, key)
	}
	sort.Slice(keys, func(left, right int) bool {
		if keys[left].Code == keys[right].Code {
			return keys[left].Currency < keys[right].Currency
		}
		return keys[left].Code < keys[right].Code
	})
	for _, key := range keys {
		definition := definitions[key]
		err := client.LedgerAccount.Create().
			SetCode(definition.Code).SetCurrency(definition.Currency).
			SetKind(ledgeraccount.Kind(definition.Kind)).SetNormalSide(ledgeraccount.NormalSide(definition.Kind.NormalSide())).
			SetOwnerType(definition.OwnerType).SetOwnerID(definition.OwnerId).
			SetAllowNegativeBalance(definition.AllowNegativeBalance).
			OnConflictColumns(ledgeraccount.FieldCode, ledgeraccount.FieldCurrency).DoNothing().
			Exec(ctx)
		if err != nil && !errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("create ledger account %s: %w", definition.Code, err)
		}
	}
	locked := map[models.AccountKey]*ent.LedgerAccount{}
	for _, key := range keys {
		account, err := client.LedgerAccount.Query().
			Where(ledgeraccount.Code(key.Code), ledgeraccount.Currency(key.Currency)).
			ForUpdate().Only(ctx)
		if err != nil {
			return nil, fmt.Errorf("lock ledger account %s: %w", key.Code, err)
		}
		if err := assertStoredAccountMatchesDefinition(account, definitions[key]); err != nil {
			return nil, err
		}
		locked[key] = account
	}
	return locked, nil
}

func assertStoredAccountMatchesDefinition(account *ent.LedgerAccount, definition models.AccountRef) error {
	if string(account.Kind) != string(definition.Kind) || account.AllowNegativeBalance != definition.AllowNegativeBalance {
		return fmt.Errorf("%w: %s", models.ErrAccountDefinitionConflict, definition.Code)
	}
	return nil
}

func (ledger *Ledger) applyLinesAndInsertEntry(ctx context.Context, client *ent.Client, request models.JournalEntryRequest, accounts map[models.AccountKey]*ent.LedgerAccount, reversedEntry *ent.JournalEntry) (models.PostedJournalEntry, error) {
	type runningTotals struct{ balance, debits, credits int64 }
	totals := map[models.AccountKey]*runningTotals{}
	for key, account := range accounts {
		totals[key] = &runningTotals{balance: account.BalanceMinor, debits: account.DebitsTotalMinor, credits: account.CreditsTotalMinor}
	}
	postedLines := make([]models.PostedJournalLine, len(request.Lines))
	for index, line := range request.Lines {
		key := line.Account.Key()
		running := totals[key]
		change := models.SignedChangeForAccount(line.Account, line.Direction, line.AmountMinor)
		nextBalance, overflowed := models.AddWithoutOverflow(running.balance, change)
		if overflowed {
			return models.PostedJournalEntry{}, models.NewInvalidJournalEntryError("balance of %s overflows", line.Account.Code)
		}
		if line.Direction == models.Debit {
			running.debits, overflowed = models.AddWithoutOverflow(running.debits, line.AmountMinor)
		} else {
			running.credits, overflowed = models.AddWithoutOverflow(running.credits, line.AmountMinor)
		}
		if overflowed {
			return models.PostedJournalEntry{}, models.NewInvalidJournalEntryError("totals of %s overflow", line.Account.Code)
		}
		running.balance = nextBalance
		postedLines[index] = models.PostedJournalLine{AccountCode: line.Account.Code, Currency: line.Account.Currency, Direction: line.Direction, AmountMinor: line.AmountMinor, BalanceAfterMinor: nextBalance}
	}
	balances := map[models.AccountKey]int64{}
	for key, running := range totals {
		account := accounts[key]
		if running.balance < 0 && !account.AllowNegativeBalance {
			return models.PostedJournalEntry{}, &models.InsufficientBalanceError{AccountCode: account.Code, Currency: account.Currency, BalanceMinor: account.BalanceMinor, RequestedMinor: account.BalanceMinor - running.balance}
		}
		updated, err := client.LedgerAccount.Update().
			Where(ledgeraccount.ID(account.ID), ledgeraccount.Version(account.Version)).
			SetBalanceMinor(running.balance).SetDebitsTotalMinor(running.debits).SetCreditsTotalMinor(running.credits).
			AddVersion(1).Save(ctx)
		if err != nil {
			return models.PostedJournalEntry{}, fmt.Errorf("update ledger account %s: %w", account.Code, err)
		}
		if updated != 1 {
			return models.PostedJournalEntry{}, fmt.Errorf("ledger account %s changed while locked", account.Code)
		}
		balances[key] = running.balance
	}
	metadata, err := json.Marshal(nonNilMetadata(request.Metadata))
	if err != nil {
		return models.PostedJournalEntry{}, models.NewInvalidJournalEntryError("metadata is not JSON serialisable")
	}
	postedAt := ledger.now().UTC()
	entryCreate := client.JournalEntry.Create().
		SetReference(request.Reference).SetKind(request.Kind).SetDescription(request.Description).
		SetExternalReference(request.ExternalReference).SetMetadata(metadata).SetPostedAt(postedAt).SetCreatedAt(postedAt)
	if reversedEntry != nil {
		entryCreate.SetReversesEntryID(reversedEntry.ID)
	}
	entry, err := entryCreate.Save(ctx)
	if err != nil {
		if ent.IsConstraintError(err) && reversedEntry != nil {
			return models.PostedJournalEntry{}, models.ErrJournalEntryAlreadyReversed
		}
		return models.PostedJournalEntry{}, fmt.Errorf("insert journal entry: %w", err)
	}
	lineCreates := make([]*ent.JournalLineCreate, len(request.Lines))
	for index, line := range request.Lines {
		lineCreates[index] = client.JournalLine.Create().
			SetEntryID(entry.ID).SetAccountID(accounts[line.Account.Key()].ID).
			SetDirection(journalline.Direction(line.Direction)).SetAmountMinor(line.AmountMinor).
			SetCurrency(line.Account.Currency).SetLineNumber(index).
			SetBalanceAfterMinor(postedLines[index].BalanceAfterMinor).SetCreatedAt(postedAt)
	}
	if err := client.JournalLine.CreateBulk(lineCreates...).Exec(ctx); err != nil {
		return models.PostedJournalEntry{}, fmt.Errorf("insert journal lines: %w", err)
	}
	return models.PostedJournalEntry{
		Id: entry.ID, Reference: entry.Reference, Kind: entry.Kind, Description: entry.Description,
		ReversesEntry: entry.ReversesEntryID, PostedAt: postedAt, Lines: postedLines, BalancesAfter: balances,
	}, nil
}

func nonNilMetadata(metadata map[string]any) map[string]any {
	if metadata == nil {
		return map[string]any{}
	}
	return metadata
}

func stripePlatformAccountLines(lines []models.JournalLineRequest, reference string) []models.JournalLineRequest {
	striped := make([]models.JournalLineRequest, len(lines))
	for index, line := range lines {
		line.Account = models.PlatformAccountStripeForReference(line.Account, reference)
		striped[index] = line
	}
	return striped
}
