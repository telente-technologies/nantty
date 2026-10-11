package models

import (
	"errors"
	"fmt"
	"math"
	"time"

	"github.com/google/uuid"
)

type JournalLineRequest struct {
	Account     AccountRef
	Direction   Direction
	AmountMinor int64
}

type JournalEntryRequest struct {
	Reference         string
	Kind              string
	Description       string
	ExternalReference string
	Metadata          map[string]any
	Lines             []JournalLineRequest
}

type PostedJournalLine struct {
	AccountCode       string    `json:"accountCode"`
	Currency          string    `json:"currency"`
	Direction         Direction `json:"direction"`
	AmountMinor       int64     `json:"amountMinor"`
	BalanceAfterMinor int64     `json:"balanceAfterMinor"`
}

type PostedJournalEntry struct {
	Id            uuid.UUID            `json:"id"`
	Reference     string               `json:"reference"`
	Kind          string               `json:"kind"`
	Description   string               `json:"description"`
	ReversesEntry *uuid.UUID           `json:"reversesEntryId"`
	PostedAt      time.Time            `json:"postedAt"`
	Lines         []PostedJournalLine  `json:"lines"`
	Replayed      bool                 `json:"-"`
	BalancesAfter map[AccountKey]int64 `json:"-"`
}

func (entry PostedJournalEntry) BalanceAfter(account AccountRef) (int64, bool) {
	balance, found := entry.BalancesAfter[account.Key()]
	return balance, found
}

var (
	ErrInvalidJournalEntry                      = errors.New("invalid journal entry")
	ErrUnbalancedJournalEntry                   = errors.New("journal entry debits and credits differ")
	ErrInsufficientBalance                      = errors.New("insufficient balance")
	ErrJournalReferenceReusedWithDifferentLines = errors.New("journal reference already posted with different lines")
	ErrJournalEntryNotFound                     = errors.New("journal entry not found")
	ErrJournalEntryAlreadyReversed              = errors.New("journal entry already reversed")
	ErrJournalKindNotStaffReversible            = errors.New("this journal kind belongs to a module; reverse it with that module's compensating command")
	ErrAccountDefinitionConflict                = errors.New("ledger account exists with a different definition")
)

type InsufficientBalanceError struct {
	AccountCode    string
	Currency       string
	BalanceMinor   int64
	RequestedMinor int64
}

func (failure *InsufficientBalanceError) Error() string {
	return fmt.Sprintf("insufficient balance on %s (%s): balance %d, requested %d", failure.AccountCode, failure.Currency, failure.BalanceMinor, failure.RequestedMinor)
}

func (failure *InsufficientBalanceError) Unwrap() error { return ErrInsufficientBalance }

func NewInvalidJournalEntryError(format string, arguments ...any) error {
	return fmt.Errorf("%w: %s", ErrInvalidJournalEntry, fmt.Sprintf(format, arguments...))
}

func AddWithoutOverflow(left, right int64) (int64, bool) {
	if (right > 0 && left > math.MaxInt64-right) || (right < 0 && left < math.MinInt64-right) {
		return 0, true
	}
	return left + right, false
}

func SignedChangeForAccount(account AccountRef, direction Direction, amountMinor int64) int64 {
	if direction == account.Kind.NormalSide() {
		return amountMinor
	}
	return -amountMinor
}

func OppositeDirection(direction Direction) Direction {
	if direction == Debit {
		return Credit
	}
	return Debit
}

var staffReversibleJournalKinds = map[string]bool{"ledger.correction": true, "staff.adjustment": true, "reconciliation.correction": true}

func IsStaffReversibleJournalKind(kind string) bool {
	return staffReversibleJournalKinds[kind]
}
