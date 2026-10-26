package services

import (
	"context"
	"database/sql"
	"fmt"
	"slices"

	"nantty/modules/ledger/src/modules/journal/models"
	"nantty/modules/ledger/src/modules/journal/validators"

	"github.com/google/uuid"

	"nantty/modules/ledger/src/generated/ent"
	"nantty/modules/ledger/src/generated/ent/journalentry"
	"nantty/modules/ledger/src/generated/ent/journalline"
)

func replayExistingJournalEntry(existing *ent.JournalEntry, request models.JournalEntryRequest) (models.PostedJournalEntry, error) {
	if !journalLinesMatchRequest(existing.Edges.Lines, request.Lines) {
		return models.PostedJournalEntry{}, fmt.Errorf("%w: %s", models.ErrJournalReferenceReusedWithDifferentLines, request.Reference)
	}
	posted := convertStoredJournalEntry(existing)
	posted.Replayed = true
	return posted, nil
}

func journalLinesMatchRequest(stored []*ent.JournalLine, requested []models.JournalLineRequest) bool {
	if len(stored) != len(requested) {
		return false
	}
	describe := func(code, currency, direction string, amount int64) string {
		return fmt.Sprintf("%s|%s|%s|%d", code, currency, direction, amount)
	}
	storedDescriptions := make([]string, len(stored))
	for index, line := range stored {
		storedDescriptions[index] = describe(line.Edges.Account.Code, line.Currency, string(line.Direction), line.AmountMinor)
	}
	requestedDescriptions := make([]string, len(requested))
	for index, line := range requested {
		requestedDescriptions[index] = describe(line.Account.Code, line.Account.Currency, string(line.Direction), line.AmountMinor)
	}
	slices.Sort(storedDescriptions)
	slices.Sort(requestedDescriptions)
	return slices.Equal(storedDescriptions, requestedDescriptions)
}

func convertStoredJournalEntry(entry *ent.JournalEntry) models.PostedJournalEntry {
	lines := make([]models.PostedJournalLine, len(entry.Edges.Lines))
	balances := map[models.AccountKey]int64{}
	for index, line := range entry.Edges.Lines {
		code := ""
		if line.Edges.Account != nil {
			code = line.Edges.Account.Code
		}
		lines[index] = models.PostedJournalLine{AccountCode: code, Currency: line.Currency, Direction: models.Direction(line.Direction), AmountMinor: line.AmountMinor, BalanceAfterMinor: line.BalanceAfterMinor}
		balances[models.AccountKey{Code: code, Currency: line.Currency}] = line.BalanceAfterMinor
	}
	return models.PostedJournalEntry{
		Id: entry.ID, Reference: entry.Reference, Kind: entry.Kind, Description: entry.Description,
		ReversesEntry: entry.ReversesEntryID, PostedAt: entry.PostedAt, Lines: lines, BalancesAfter: balances,
	}
}

type ReverseJournalEntryRequest struct {
	OriginalEntryId   uuid.UUID
	ReversalReference string
	Reason            string
	Metadata          map[string]any
	StaffInitiated    bool
}

func (ledger *Ledger) ReverseJournalEntry(ctx context.Context, transaction *sql.Tx, request ReverseJournalEntryRequest) (models.PostedJournalEntry, error) {
	if request.Reason == "" || len(request.Reason) > 500 {
		return models.PostedJournalEntry{}, models.NewInvalidJournalEntryError("a reversal needs a reason of 1-500 characters")
	}
	client := ledger.clientFor(transaction)
	original, err := client.JournalEntry.Query().Where(journalentry.ID(request.OriginalEntryId)).WithLines(func(query *ent.JournalLineQuery) {
		query.WithAccount().Order(ent.Asc(journalline.FieldLineNumber))
	}).Only(ctx)
	if ent.IsNotFound(err) {
		return models.PostedJournalEntry{}, models.ErrJournalEntryNotFound
	}
	if err != nil {
		return models.PostedJournalEntry{}, err
	}
	if request.StaffInitiated && !models.IsStaffReversibleJournalKind(original.Kind) {
		return models.PostedJournalEntry{}, models.ErrJournalKindNotStaffReversible
	}
	reversedAlready, err := client.JournalEntry.Query().Where(journalentry.ReversesEntryID(original.ID)).Only(ctx)
	if err == nil && reversedAlready.Reference != request.ReversalReference {
		return models.PostedJournalEntry{}, models.ErrJournalEntryAlreadyReversed
	}
	if err != nil && !ent.IsNotFound(err) {
		return models.PostedJournalEntry{}, err
	}
	reversal := models.JournalEntryRequest{
		Reference: request.ReversalReference, Kind: original.Kind + ".reversal",
		Description: "Reversal: " + request.Reason, ExternalReference: original.ExternalReference,
		Metadata: mergeMetadata(request.Metadata, map[string]any{"reversesEntryId": original.ID.String(), "reason": request.Reason}),
	}
	for _, line := range original.Edges.Lines {
		account := convertStoredAccountToRef(line.Edges.Account)
		reversal.Lines = append(reversal.Lines, models.JournalLineRequest{Account: account, Direction: models.OppositeDirection(models.Direction(line.Direction)), AmountMinor: line.AmountMinor})
	}
	if err := validators.ValidateJournalEntryRequest(reversal); err != nil {
		return models.PostedJournalEntry{}, err
	}
	posted, err := ledger.postValidatedJournalEntry(ctx, transaction, reversal, original)
	if err != nil || posted.Replayed {
		return posted, err
	}
	eventData := map[string]any{"journalEntryId": posted.Id.String(), "reversesEntryId": original.ID.String(), "reference": posted.Reference, "kind": original.Kind, "reason": request.Reason}
	return posted, enqueueLedgerOutboxEvent(ctx, client, "journalEntry.reversed", original.ID.String(), posted.PostedAt, eventData)
}

func convertStoredAccountToRef(account *ent.LedgerAccount) models.AccountRef {
	return models.AccountRef{
		Code: account.Code, Currency: account.Currency, Kind: models.AccountKind(account.Kind),
		OwnerType: account.OwnerType, OwnerId: account.OwnerID, AllowNegativeBalance: account.AllowNegativeBalance,
	}
}

func mergeMetadata(base, extra map[string]any) map[string]any {
	merged := map[string]any{}
	for key, value := range base {
		merged[key] = value
	}
	for key, value := range extra {
		merged[key] = value
	}
	return merged
}
