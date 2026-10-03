package services

import (
	"context"
	"database/sql"
	"fmt"
	"sort"
	"strings"
	"time"

	"zudomart/modules/ledger/src/modules/journal/models"

	"github.com/google/uuid"

	"zudomart/modules/ledger/src/generated/ent"
	"zudomart/modules/ledger/src/generated/ent/journalentry"
	"zudomart/modules/ledger/src/generated/ent/journalline"
	"zudomart/modules/ledger/src/generated/ent/ledgeraccount"
	"zudomart/modules/ledger/src/generated/ent/reconciliationbreak"
	"zudomart/platform/events"
)

type ProviderSettlementItem struct {
	ProviderReference string
	AmountMinor       int64
	Currency          string
}

type ReconcileProviderSettlementsRequest struct {
	Provider       string
	WindowStartsAt time.Time
	WindowEndsAt   time.Time
	Items          []ProviderSettlementItem
}

type ReconciliationBreakSummary struct {
	Kind                string `json:"kind"`
	ProviderReference   string `json:"providerReference"`
	Currency            string `json:"currency"`
	ExpectedAmountMinor int64  `json:"expectedAmountMinor"`
	ProviderAmountMinor int64  `json:"providerAmountMinor"`
}

type ReconciliationReport struct {
	RunId        uuid.UUID                    `json:"runId"`
	Provider     string                       `json:"provider"`
	MatchedCount int                          `json:"matchedCount"`
	Breaks       []ReconciliationBreakSummary `json:"breaks"`
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
	collected, err := ledger.collectPlatformProviderBalanceDebitsByExternalReference(ctx, client, request.Provider, request.WindowStartsAt.Add(-reconciliationSettlementLag), request.WindowEndsAt.Add(reconciliationSettlementLag))
	if err != nil {
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
		if inWindow && !seen[reference] {
			report.Breaks = append(report.Breaks, ReconciliationBreakSummary{Kind: "missingAtProvider", ProviderReference: reference, Currency: ledgerAmount.currency, ExpectedAmountMinor: ledgerAmount.amountMinor})
		}
	}
	sort.Slice(report.Breaks, func(left, right int) bool {
		return report.Breaks[left].ProviderReference < report.Breaks[right].ProviderReference
	})
	return report, ledger.persistReconciliationRun(ctx, client, request, &report, collected)
}

const reconciliationSettlementLag = 72 * time.Hour

func (ledger *Ledger) collectPlatformProviderBalanceDebitsByExternalReference(ctx context.Context, client *ent.Client, provider string, from, to time.Time) (map[string]collectedAmount, error) {
	lines, err := client.JournalLine.Query().
		Where(
			journalline.DirectionEQ(journalline.DirectionDebit),
			journalline.HasAccountWith(ledgeraccount.CodeIn(models.PlatformAccountStripeCodes(models.PlatformProviderBalanceAccount(provider, "").Code)...)),
			journalline.HasEntryWith(journalentry.ExternalReferenceNEQ(""), journalentry.ReversesEntryIDIsNil(), journalentry.PostedAtGTE(from), journalentry.PostedAtLT(to)),
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
	event, err := events.BuildOutboxEventWithEnvelope(eventType, "zudomart.ledger", subject, 1, occurredAt, data)
	if err != nil {
		return err
	}
	return client.OutboxEvent.Create().SetID(uuid.MustParse(event.Id)).SetEventType(event.EventType).
		SetSubject(event.Subject).SetPayload(event.Payload).SetCreatedAt(occurredAt).Exec(ctx)
}
