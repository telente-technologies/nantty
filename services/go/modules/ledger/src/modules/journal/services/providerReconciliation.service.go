package services

import (
	"context"
	"database/sql"
	"fmt"
	"sort"
	"strings"
	"time"

	"nantty/modules/ledger/src/modules/journal/models"

	"github.com/google/uuid"

	"nantty/modules/ledger/src/generated/ent"
	"nantty/modules/ledger/src/generated/ent/journalentry"
	"nantty/modules/ledger/src/generated/ent/journalline"
	"nantty/modules/ledger/src/generated/ent/ledgeraccount"
	"nantty/modules/ledger/src/generated/ent/predicate"
	"nantty/modules/ledger/src/generated/ent/reconciliationbreak"
	"nantty/platform/events"
)

type ProviderSettlementItem struct {
	ProviderReference string
	AmountMinor       int64
	Currency          string
}

type ReconcileProviderSettlementsRequest struct {
	Provider        string
	WindowStartsAt  time.Time
	WindowEndsAt    time.Time
	Items           []ProviderSettlementItem
	SettlementGrace time.Duration
}

type ReconciliationBreakSummary struct {
	Kind                string `json:"kind"`
	ProviderReference   string `json:"providerReference"`
	Currency            string `json:"currency"`
	ExpectedAmountMinor int64  `json:"expectedAmountMinor"`
	ProviderAmountMinor int64  `json:"providerAmountMinor"`
}

type ReconciliationReport struct {
	RunId              uuid.UUID                    `json:"runId"`
	Provider           string                       `json:"provider"`
	MatchedCount       int                          `json:"matchedCount"`
	AwaitingSettlement int                          `json:"awaitingSettlement"`
	Breaks             []ReconciliationBreakSummary `json:"breaks"`
}

type collectedAmount struct {
	currency    string
	amountMinor int64
	entryId     uuid.UUID
	postedAt    time.Time
}

func (ledger *Ledger) ReconcileProviderSettlements(ctx context.Context, transaction *sql.Tx, request ReconcileProviderSettlementsRequest) (ReconciliationReport, error) {
	if request.Provider == "" || !request.WindowEndsAt.After(request.WindowStartsAt) {
		return ReconciliationReport{}, models.NewInvalidJournalEntryError("reconciliation needs a provider and a window that ends after it starts")
	}
	client := ledger.clientFor(transaction)
	collected, err := ledger.collectPlatformProviderBalanceDebits(ctx, client, request.Provider, journalentry.PostedAtGTE(request.WindowStartsAt), journalentry.PostedAtLT(request.WindowEndsAt))
	if err != nil {
		return ReconciliationReport{}, err
	}
	if err := ledger.collectProviderReferencesPostedOutsideTheWindow(ctx, client, request, collected); err != nil {
		return ReconciliationReport{}, err
	}
	report := ReconciliationReport{Provider: request.Provider, Breaks: []ReconciliationBreakSummary{}}
	seen := map[string]bool{}
	for _, item := range request.Items {
		seen[item.ProviderReference] = true
		ledgerAmount, found := collected[item.ProviderReference]
		switch {
		case !found:
			report.Breaks = append(report.Breaks, ReconciliationBreakSummary{Kind: "missingInLedger", ProviderReference: item.ProviderReference, Currency: item.Currency, ProviderAmountMinor: item.AmountMinor})
		case ledgerAmount.currency != item.Currency:
			report.Breaks = append(report.Breaks, ReconciliationBreakSummary{Kind: "currencyMismatch", ProviderReference: item.ProviderReference, Currency: ledgerAmount.currency, ExpectedAmountMinor: ledgerAmount.amountMinor, ProviderAmountMinor: item.AmountMinor})
		case ledgerAmount.amountMinor != item.AmountMinor:
			report.Breaks = append(report.Breaks, ReconciliationBreakSummary{Kind: "amountMismatch", ProviderReference: item.ProviderReference, Currency: item.Currency, ExpectedAmountMinor: ledgerAmount.amountMinor, ProviderAmountMinor: item.AmountMinor})
		default:
			report.MatchedCount++
		}
	}
	for reference, ledgerAmount := range collected {
		inWindow := !ledgerAmount.postedAt.Before(request.WindowStartsAt) && ledgerAmount.postedAt.Before(request.WindowEndsAt)
		if inWindow && !seen[reference] && ledger.now().Sub(ledgerAmount.postedAt) < request.SettlementGrace {
			report.AwaitingSettlement++
			continue
		}
		if inWindow && !seen[reference] {
			report.Breaks = append(report.Breaks, ReconciliationBreakSummary{Kind: "missingAtProvider", ProviderReference: reference, Currency: ledgerAmount.currency, ExpectedAmountMinor: ledgerAmount.amountMinor})
		}
	}
	sort.Slice(report.Breaks, func(left, right int) bool {
		return report.Breaks[left].ProviderReference < report.Breaks[right].ProviderReference
	})
	return report, ledger.persistReconciliationRun(ctx, client, request, &report, collected)
}

const referencesPerLookup = 500

func (ledger *Ledger) collectProviderReferencesPostedOutsideTheWindow(ctx context.Context, client *ent.Client, request ReconcileProviderSettlementsRequest, collected map[string]collectedAmount) error {
	var missing []string
	for _, item := range request.Items {
		if _, found := collected[item.ProviderReference]; !found && item.ProviderReference != "" {
			missing = append(missing, item.ProviderReference)
		}
	}
	for start := 0; start < len(missing); start += referencesPerLookup {
		batch := missing[start:min(start+referencesPerLookup, len(missing))]
		found, err := ledger.collectPlatformProviderBalanceDebits(ctx, client, request.Provider, journalentry.ExternalReferenceIn(batch...))
		if err != nil {
			return err
		}
		for reference, amount := range found {
			collected[reference] = amount
		}
	}
	return nil
}

func (ledger *Ledger) collectPlatformProviderBalanceDebits(ctx context.Context, client *ent.Client, provider string, entryFilters ...predicate.JournalEntry) (map[string]collectedAmount, error) {
	filters := append([]predicate.JournalEntry{journalentry.ExternalReferenceNEQ(""), journalentry.ReversesEntryIDIsNil()}, entryFilters...)
	lines, err := client.JournalLine.Query().
		Where(
			journalline.DirectionEQ(journalline.DirectionDebit),
			journalline.HasAccountWith(ledgeraccount.CodeIn(models.PlatformAccountStripeCodes(models.PlatformProviderBalanceAccount(provider, "").Code)...)),
			journalline.HasEntryWith(filters...),
		).
		WithEntry().All(ctx)
	if err != nil {
		return nil, err
	}
	collected := map[string]collectedAmount{}
	for _, line := range lines {
		if strings.HasSuffix(line.Edges.Entry.Kind, ".reversal") {
			continue
		}
		reference := line.Edges.Entry.ExternalReference
		current := collected[reference]
		current.currency = line.Currency
		current.amountMinor += line.AmountMinor
		current.entryId = line.EntryID
		current.postedAt = line.Edges.Entry.PostedAt
		collected[reference] = current
	}
	return collected, nil
}

func (ledger *Ledger) persistReconciliationRun(ctx context.Context, client *ent.Client, request ReconcileProviderSettlementsRequest, report *ReconciliationReport, collected map[string]collectedAmount) error {
	now := ledger.now().UTC()
	run, err := client.ReconciliationRun.Create().
		SetProvider(request.Provider).SetWindowStartsAt(request.WindowStartsAt).SetWindowEndsAt(request.WindowEndsAt).
		SetMatchedCount(report.MatchedCount).SetBreakCount(len(report.Breaks)).SetCreatedAt(now).Save(ctx)
	if err != nil {
		return fmt.Errorf("insert reconciliation run: %w", err)
	}
	report.RunId = run.ID
	for _, summary := range report.Breaks {
		create := client.ReconciliationBreak.Create().
			SetRunID(run.ID).SetKind(reconciliationbreak.Kind(summary.Kind)).SetProviderReference(summary.ProviderReference).
			SetCurrency(summary.Currency).SetExpectedAmountMinor(summary.ExpectedAmountMinor).
			SetProviderAmountMinor(summary.ProviderAmountMinor).SetCreatedAt(now)
		if ledgerAmount, found := collected[summary.ProviderReference]; found {
			create.SetJournalEntryID(ledgerAmount.entryId)
		}
		if err := create.Exec(ctx); err != nil {
			return fmt.Errorf("insert reconciliation break: %w", err)
		}
		eventData := map[string]any{"runId": run.ID.String(), "provider": request.Provider, "kind": summary.Kind, "providerReference": summary.ProviderReference,
			"currency": summary.Currency, "expectedAmountMinor": summary.ExpectedAmountMinor, "providerAmountMinor": summary.ProviderAmountMinor}
		if err := enqueueLedgerOutboxEvent(ctx, client, "reconciliationBreak.found", summary.ProviderReference, now, eventData); err != nil {
			return err
		}
	}
	return nil
}

func enqueueLedgerOutboxEvent(ctx context.Context, client *ent.Client, eventType, subject string, occurredAt time.Time, data any) error {
	event, err := events.BuildOutboxEventWithEnvelope(eventType, "nantty.ledger", subject, 1, occurredAt, data)
	if err != nil {
		return err
	}
	return client.OutboxEvent.Create().SetID(uuid.MustParse(event.Id)).SetEventType(event.EventType).
		SetSubject(event.Subject).SetPayload(event.Payload).SetCreatedAt(occurredAt).Exec(ctx)
}
