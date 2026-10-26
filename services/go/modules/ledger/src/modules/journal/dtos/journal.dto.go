package dtos

import "nantty/modules/ledger/src/modules/journal/services"

type AccountStatementDto struct {
	Balances   []services.AccountBalance `json:"balances"`
	Data       []services.StatementLine  `json:"data"`
	NextCursor *string                   `json:"nextCursor"`
}

type ReverseJournalEntryRequestDto struct {
	Reason string `json:"reason"`
}
