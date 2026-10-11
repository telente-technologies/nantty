package services

import (
	"errors"
	"net/http"

	"zudomart/modules/ledger/src/databases"
	"zudomart/modules/ledger/src/generated/ent"

	"zudomart/modules/ledger/src/modules/journal/models"
	"zudomart/platform/httpserver"
)

func ConvertLedgerErrorToApiError(err error) error {
	var insufficient *models.InsufficientBalanceError
	switch {
	case err == nil:
		return nil
	case errors.As(err, &insufficient):
		return httpserver.NewApiError(http.StatusUnprocessableEntity, "INSUFFICIENT_FUNDS", "Insufficient funds.")
	case errors.Is(err, models.ErrJournalEntryNotFound):
		return httpserver.NewApiError(http.StatusNotFound, "JOURNAL_ENTRY_NOT_FOUND", "Journal entry was not found.")
	case errors.Is(err, models.ErrJournalEntryAlreadyReversed):
		return httpserver.NewApiError(http.StatusConflict, "JOURNAL_ENTRY_ALREADY_REVERSED", "This journal entry has already been reversed.")
	case errors.Is(err, models.ErrJournalKindNotStaffReversible):
		return httpserver.NewApiError(http.StatusConflict, "JOURNAL_KIND_NOT_REVERSIBLE", "This entry belongs to a payment, escrow or wallet flow. Use that flow's refund or adjustment action instead.")
	case errors.Is(err, models.ErrJournalReferenceReusedWithDifferentLines):
		return httpserver.NewApiError(http.StatusConflict, "IDEMPOTENCY_KEY_REUSED", "This Idempotency-Key was already used with a different request.")
	}
	return err
}

func (ledger *Ledger) EntClientForExecutorInLedgerSchema(executor databases.ExecutorQuerier) *ent.Client {
	return ledger.clientFor(executor)
}
