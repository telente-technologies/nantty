package listjournalentries

import "github.com/google/uuid"

type Query struct {
	Currency    string
	AccountCode string
	Reference   string
	AfterId     *uuid.UUID
	Limit       int
}
